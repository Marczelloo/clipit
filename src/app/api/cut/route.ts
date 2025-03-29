import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "~/server/auth";
import path from "path";
import { writeFile, mkdir, unlink } from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import { db } from "~/server/db";
import os from "os";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import { 
  uploadFile, 
  getPublicUrl,
  STORAGE_BUCKETS,
  downloadFile,
  listFiles,
  supabase,
} from "~/server/config/supabase-storage";

const execPromise = promisify(exec);

export const config = {
  api: {
    responseLimit: false,
  },
  // Maximum duration allowed on Vercel free tier
  maxDuration: 60, // 60 seconds (Vercel free tier limit)
};

/**
 * Clean up chunk files from Supabase storage
 */
async function cleanupChunks(prefix: string) {
  try {
    console.log(`Cleaning up chunks from ${prefix}...`);
    
    // List all chunks
    const chunkFiles = await listFiles(STORAGE_BUCKETS.TEMP, prefix);
    
    if (chunkFiles.length === 0) {
      console.log(`No chunks found in ${prefix}`);
      return;
    }
    
    console.log(`Found ${chunkFiles.length} chunks to clean up`);
    
    // Delete each chunk individually
    for (const chunkFile of chunkFiles) {
      if (!chunkFile.id.endsWith('/')) {
        const chunkPath = `${prefix}/${chunkFile.name}`;
        console.log(`Deleting chunk: ${chunkPath}`);
        
        await supabase.storage
          .from(STORAGE_BUCKETS.TEMP)
          .remove([chunkPath]);
      }
    }
    
    // Try to remove the parent folder if possible
    try {
      await supabase.storage
        .from(STORAGE_BUCKETS.TEMP)
        .remove([prefix]);
    } catch (err) {
      // Folder deletion might fail if it's not empty or doesn't exist,
      // which is fine since we've already deleted the individual files
      console.log(`Note: Could not delete parent folder ${prefix}`, err);
    }
    
    console.log(`Successfully cleaned up chunks from ${prefix}`);
  } catch (err) {
    console.error(`Error cleaning up chunks from ${prefix}:`, err);
    // Log but don't throw - we don't want chunk cleanup to cause the main operation to fail
  }
}

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
            
            // Build path to user's chunk directory in Supabase storage
            const userDir = session?.user?.id ? session.user.id : "anonymous";
            const chunkPrefix = `chunks/${userDir}/${fileId}`;
            console.log(`Processing chunked upload from Supabase in directory: ${chunkPrefix}`);
            
            try {
                // List all chunks from Supabase storage
                const chunkFiles = await listFiles(STORAGE_BUCKETS.TEMP, chunkPrefix);
                
                if (chunkFiles.length === 0) {
                    return NextResponse.json({ error: "No chunks found in storage" }, { status: 400 });
                }
                
                // Create temp directory to store chunks while processing
                const tempProcessingDir = path.join(os.tmpdir(), 'clipit-processing', uuidv4());
                await mkdir(tempProcessingDir, { recursive: true });
                
                // Sort chunk files by index for proper ordering
                const sortedChunks = chunkFiles.filter(file => !file.id.endsWith('/')).sort((a, b) => {
                    // Extract the chunk index from the filename
                    const indexA = parseInt(a.name.split('-')[1]);
                    const indexB = parseInt(b.name.split('-')[1]);
                    return indexA - indexB;
                });
                
                // Download and combine all chunks
                completeFileBuffer = Buffer.alloc(0);
                
                for (const chunkFile of sortedChunks) {
                    const chunkPath = `${chunkPrefix}/${chunkFile.name}`;
                    const chunkData = await downloadFile(STORAGE_BUCKETS.TEMP, chunkPath);
                    
                    // Convert blob to buffer
                    const arrayBuffer = await chunkData.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);
                    
                    completeFileBuffer = Buffer.concat([completeFileBuffer, buffer]);
                }
                
                console.log(`Successfully combined ${sortedChunks.length} chunks into buffer of size ${completeFileBuffer.length}`);
            } catch (err) {
                console.error("Error retrieving chunks from Supabase:", err);
                return NextResponse.json({ 
                    error: "Failed to retrieve uploaded chunks", 
                    details: err instanceof Error ? err.message : String(err) 
                }, { status: 500 });
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

        // Read the output file
        const outputBuffer = await fs.promises.readFile(outputPath);

        // Define storage path in Supabase based on user session
        const storagePath = session?.user?.id 
            ? `${session.user.id}/${processId}${fileExt}`
            : `anonymous/${processId.substring(0, 8)}/${processId}${fileExt}`;

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
        if (contentType.includes("application/json") && fileId) {
            const userDir = session?.user?.id ? session.user.id : "anonymous";
            const chunkPrefix = `chunks/${userDir}/${fileId}`;
            
            // Use our enhanced cleanup function
            await cleanupChunks(chunkPrefix);
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
        
        // Even if processing failed, try to clean up chunks if we have enough info
        if (contentType?.includes("application/json") && fileId) {
            try {
                const userDir = session?.user?.id ? session.user.id : "anonymous";
                const chunkPrefix = `chunks/${userDir}/${fileId}`;
                await cleanupChunks(chunkPrefix);
            } catch (cleanupError) {
                console.error("Failed to clean up chunks after error:", cleanupError);
            }
        }
        
        return NextResponse.json({ 
            error: "Video cutting failed",
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}