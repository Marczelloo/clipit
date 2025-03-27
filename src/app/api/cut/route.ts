import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "~/server/auth";
import path from "path";
import { writeFile, mkdir, unlink } from "fs/promises";
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

const execPromise = promisify(exec);

// Configure the API route to handle large file uploads
export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
  maxDuration: 60, // 60 seconds (Vercel free tier limit)
};

export async function POST(req: NextRequest) {
    const session = await auth();

    try 
    {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const startTime = parseFloat(formData.get("startTime") as string);
        const endTime = parseFloat(formData.get("endTime") as string);
        const duration = parseFloat(formData.get("duration") as string);

        if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
        if (isNaN(startTime) || isNaN(endTime)) {
            return NextResponse.json({ error: "Invalid start or end time" }, { status: 400 });
        }

        const processId = uuidv4();

        // Use OS temp directory instead of local storage
        const tempDir = path.join(os.tmpdir(), 'clipit-cuts', processId);
        await mkdir(tempDir, { recursive: true });

        const fileExt = path.extname(file.name).toLowerCase();
        const format = fileExt.replace(".", "");

        const inputPath = path.join(tempDir, `input${fileExt}`);
        const outputPath = path.join(tempDir, `output${fileExt}`);

        // Write input file to temp directory
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(inputPath, buffer);

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

        // Set expiration time to 6 hours from now
        const expirationTime = new Date();
        expirationTime.setHours(expirationTime.getHours() + 6);

        // Save record to database
        await db.cut.create({
            data: {
                userId: session?.user?.id ?? undefined,
                anonymousId: !session?.user?.id ? processId : null,
                originalName: file.name,
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
        return NextResponse.json({ error: "Video cutting failed" }, { status: 500 });
    }
}