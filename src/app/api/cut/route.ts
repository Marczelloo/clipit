import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "~/server/auth";
import path from "path";
import { writeFile, mkdir, unlink, readdir, readFile } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import { v4 as uuidv4 } from "uuid";
import { db } from "~/server/db";
import os from "os";
import fs from "fs";
import { 
  uploadFile, 
  getPublicUrl,
  STORAGE_BUCKETS 
} from "~/server/config/supabase-storage";
import { join } from "path";

const execPromise = promisify(exec);

// Temporary directory for storing chunk files
const TEMP_CHUNKS_DIR = join(os.tmpdir(), 'clipit-chunks');

// Configure the API route
export const config = {
  api: {
    responseLimit: false,
  },
  maxDuration: 60, // 60 seconds (Vercel free tier limit)
};

export async function POST(req: NextRequest) {
    const session = await auth();

    try 
    {
        // Check if the request is JSON (chunked upload) or FormData (legacy direct upload)
        const contentType = req.headers.get("content-type") || "";
        let file: File | null = null;
        let fileName: string | null = null;
        let fileType: string | null = null;
        let startTime: number = 0;
        let endTime: number = 0;
        let duration: number = 0;
        let completeFileBuffer: Buffer | null = null;
        let fileId: string | null = null;
        
        if (contentType.includes("application/json")) {
            // Handle chunked upload request - store the body since we can only read it once
            const body = await req.json();
            fileId = body.fileId;
            const { fileName: name, fileType: type, startTime: start, endTime: end, duration: dur } = body;
            
            if (!fileId || !name) {
                return NextResponse.json({ error: "Missing fileId or fileName" }, { status: 400 });
            }
            
            fileName = name;
            fileType = type;
            
            if (typeof start === 'number') startTime = start;
            if (typeof end === 'number') endTime = end;
            if (typeof dur === 'number') duration = dur;
            
            // Validate times
            if (isNaN(startTime) || isNaN(endTime)) {
                return NextResponse.json({ error: "Invalid start or end time" }, { status: 400 });
            }
            
            // Build path to user's chunk directory for this file
            const userDir = session?.user?.id ? session.user.id : "anonymous";
            const userChunkDir = join(TEMP_CHUNKS_DIR, userDir, fileId);
            
            // Check if directory exists
            try {
                await fs.promises.access(userChunkDir);
            } catch (err) {
                return NextResponse.json({ error: "No uploaded chunks found" }, { status: 404 });
            }
            
            // Read all chunks from the temp directory
            const chunkFiles = await readdir(userChunkDir);
            
            if (chunkFiles.length === 0) {
                return NextResponse.json({ error: "No chunks found" }, { status: 400 });
            }
            
            // Sort chunk files by index for proper ordering
            chunkFiles.sort((a, b) => {
                const indexA = parseInt(a.split('-')[1]);
                const indexB = parseInt(b.split('-')[1]);
                return indexA - indexB;
            });
            
            // Combine all chunks into one buffer
            completeFileBuffer = Buffer.alloc(0);
            for (const chunkFile of chunkFiles) {
                const chunkPath = join(userChunkDir, chunkFile);
                const chunkData = await readFile(chunkPath);
                completeFileBuffer = Buffer.concat([completeFileBuffer, chunkData]);
            }
        } else {
            // Handle legacy direct upload
            const formData = await req.formData();
            file = formData.get("file") as File;
            startTime = parseFloat(formData.get("startTime") as string);
            endTime = parseFloat(formData.get("endTime") as string);
            duration = parseFloat(formData.get("duration") as string);

            if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
            if (isNaN(startTime) || isNaN(endTime)) {
                return NextResponse.json({ error: "Invalid start or end time" }, { status: 400 });
            }
            
            fileName = file.name;
            fileType = file.type;
            
            // Convert file to buffer
            const bytes = await file.arrayBuffer();
            completeFileBuffer = Buffer.from(bytes);
        }
        
        if (!fileName || !completeFileBuffer) {
            return NextResponse.json({ error: "Missing file data" }, { status: 400 });
        }

        const processId = uuidv4();

        // Use OS temp directory instead of local storage
        const tempDir = path.join(os.tmpdir(), 'clipit-cuts', processId);
        await mkdir(tempDir, { recursive: true });

        const fileExt = path.extname(fileName).toLowerCase();
        const format = fileExt.replace(".", "");

        const inputPath = path.join(tempDir, `input${fileExt}`);
        const outputPath = path.join(tempDir, `output${fileExt}`);

        // Write input file to temp directory
        await writeFile(inputPath, completeFileBuffer);

        // Calculate duration in seconds and format for ffmpeg
        const clipDuration = endTime - startTime;
        
        // FFmpeg command to cut video
        // -ss: start time, -t: duration, -c copy: copy codecs without re-encoding for speed
        const ffmpegCmd = `ffmpeg -ss ${startTime} -t ${clipDuration} -i "${inputPath}" -c copy "${outputPath}" -y`;

        await execPromise(ffmpegCmd);

        // Define storage path in Supabase based on user session
        const storagePath = session?.user?.id 
            ? `${session.user.id}/${processId}${fileExt}`
            : `anonymous/${processId.substring(0, 8)}/${processId}${fileExt}`;

        // Read the output file
        const outputBuffer = await fs.promises.readFile(outputPath);
        
        // Upload the cut file to Supabase storage
        await uploadFile(
            STORAGE_BUCKETS.CUTS,
            storagePath,
            outputBuffer,
            `video/${format}`
        );

        // Get the public URL
        const fileUrl = getPublicUrl(STORAGE_BUCKETS.CUTS, storagePath);

        // Get file sizes for stats
        const originalSize = fs.statSync(inputPath).size;
        const cutSize = fs.statSync(outputPath).size;

        // Clean up temp files
        await unlink(inputPath).catch(() => {});
        await unlink(outputPath).catch(() => {});
        await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        
        // Clean up chunk files if this was a chunked upload
        if (contentType.includes("application/json") && session?.user?.id && fileId) {
            const userDir = session.user.id;
            const userChunkDir = join(TEMP_CHUNKS_DIR, userDir, fileId);
            
            try {
                await fs.promises.rm(userChunkDir, { recursive: true, force: true });
            } catch (err) {
                console.error("Error cleaning up chunk files:", err);
            }
        }

        // Set expiration time to 6 hours from now
        const expirationTime = new Date();
        expirationTime.setHours(expirationTime.getHours() + 6);

        // Save record to database
        await db.cut.create({
            data: {
                userId: session?.user?.id ?? undefined,
                anonymousId: !session?.user?.id ? processId : null,
                originalName: fileName,
                originalSize,
                cutSize,
                startTime,
                endTime,
                originalDuration: duration,
                format,
                filePath: storagePath, // Store Supabase path instead of local path
                expiresAt: expirationTime,
            }
        });

        return NextResponse.json({
            success: true,
            fileUrl: fileUrl, // Return the Supabase URL directly
            originalSize,
            cutSize,
            startTime,
            endTime,
            duration: clipDuration,
            anonymousId: !session?.user?.id ? processId : null
        });
    } 
    catch (error) 
    {
        console.error("Video cutting error: ", error);
        return NextResponse.json({ 
            error: "Video cutting failed",
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}