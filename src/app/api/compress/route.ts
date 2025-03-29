import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "~/server/auth";
import path from "path";
import { writeFile, mkdir, unlink, readdir } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import { v4 as uuidv4 } from "uuid";
import { db } from "~/server/db";
import os from "os";
import fs from "fs";
import { 
  uploadFile, 
  getPublicUrl,
  STORAGE_BUCKETS,
  downloadFile,
  listFiles,
  supabase 
} from "~/server/config/supabase-storage";

const execPromise = promisify(exec);

export const config = {
  api: {
    responseLimit: false,
  },
  // Maximum duration allowed on Vercel free tier
  maxDuration: 60, // 60 seconds (Vercel free tier limit)
};

export async function POST(req: NextRequest) {
  const session = await auth();

  try {
    // Check if the request is JSON (chunked upload) or FormData (legacy direct upload)
    const contentType = req.headers.get("content-type") || "";
    let file: File | null = null;
    let fileName: string | null = null;
    let fileType: string | null = null;
    let quality: string = "75";
    let format: string = "mp4";
    let resolution: string = "720p";
    let fps: string = "original";
    let completeFileBuffer: Buffer | null = null;
    let fileId: string | null = null;
    
    if (contentType.includes("application/json")) {
      // Handle chunked upload request - store the body since we can only read it once
      const body = await req.json();
      fileId = body.fileId;
      const { fileName: name, fileType: type, quality: q, format: f, resolution: r, fps: fp } = body;
      
      if (!fileId || !name) {
        return NextResponse.json({ error: "Missing fileId or fileName" }, { status: 400 });
      }
      
      fileName = name;
      fileType = type;
      if (q) quality = q;
      if (f) format = f;
      if (r) resolution = r;
      if (fp) fps = fp;
      
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
      quality = formData.get("quality") as string || "75";
      format = formData.get("format") as string || "mp4";
      resolution = formData.get("resolution") as string || "720p";
      fps = formData.get("fps") as string || "original";

      if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
      
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
    const tempDir = path.join(os.tmpdir(), 'clipit-compression', processId);
    await mkdir(tempDir, { recursive: true });

    const fileExt = path.extname(fileName).toLowerCase();
    const outputFormat = format || fileExt.replace(".", "");

    const inputPath = path.join(tempDir, `input${fileExt}`);
    const outputPath = path.join(tempDir, `output.${outputFormat}`);

    // Write the input file to temp directory
    await writeFile(inputPath, completeFileBuffer);

    // Build FFmpeg command
    let ffmpegCmd = `ffmpeg -i "${inputPath}" `;

    if (quality) {
      const crf = 51 - (parseInt(quality) / 2);
      ffmpegCmd += `-c:v libx264 -crf ${crf} `;
    }

    if (resolution && resolution != "original") {
      const height = parseInt(resolution.replace('p', ''));
      ffmpegCmd += `-vf scale=-1:${height} `;
    }

    if (fps && fps != "original") ffmpegCmd += `-r ${fps} `;

    if (format === "webm") {
      ffmpegCmd += `-c:v libvpx-vp9 `;
    } else if (format === "gif") {
      ffmpegCmd += `-vf "fps=10,scale=320:-1:flags=lanczos" `;
    }

    ffmpegCmd += `"${outputPath}" -y`;

    // Execute FFmpeg command
    await execPromise(ffmpegCmd);

    // Define storage path in Supabase
    const storagePath = session?.user?.id 
      ? `${session.user.id}/${processId}.${outputFormat}`
      : `anonymous/${processId.substring(0, 8)}/${processId}.${outputFormat}`;

    // Read the output file
    const outputBuffer = await fs.promises.readFile(outputPath);
    
    // Upload the compressed file to Supabase storage
    await uploadFile(
      STORAGE_BUCKETS.COMPRESSED,
      storagePath,
      outputBuffer,
      `video/${outputFormat === 'gif' ? 'gif' : outputFormat === 'webm' ? 'webm' : 'mp4'}`
    );

    // Get the public URL
    const fileUrl = getPublicUrl(STORAGE_BUCKETS.COMPRESSED, storagePath);

    // Get file sizes for stats
    const originalSize = fs.statSync(inputPath).size;
    const compressedSize = fs.statSync(outputPath).size;

    // Clean up temp files
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
    await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    
    // Clean up chunk files if this was a chunked upload
    if (contentType.includes("application/json") && fileId) {
      const userDir = session?.user?.id ? session.user.id : "anonymous";
      const chunkPrefix = `${userDir}/${fileId}`;
      
      try {
        // List all chunks
        const chunkFiles = await listFiles(STORAGE_BUCKETS.TEMP, chunkPrefix);
        
        // Delete each chunk
        for (const chunkFile of chunkFiles) {
          if (!chunkFile.id.endsWith('/')) {
            await supabase.storage
              .from(STORAGE_BUCKETS.TEMP)
              .remove([`${chunkPrefix}/${chunkFile.name}`]);
          }
        }
      } catch (err) {
        console.error("Error cleaning up chunk files from Supabase:", err);
      }
    }

    // Set expiration time to 6 hours from now
    const expirationTime = new Date();
    expirationTime.setHours(expirationTime.getHours() + 6);

    // Save record to database
    await db.compression.create({
      data: {
        userId: session?.user?.id ?? undefined,
        anonymousId: !session?.user?.id ? processId : null,
        originalName: fileName,
        originalSize,
        compressedSize,
        compressionRatio: parseFloat(((originalSize - compressedSize) / originalSize * 100).toFixed(2)),
        format: outputFormat,
        quality: parseInt(quality) || 75,
        filePath: storagePath,
        expiresAt: expirationTime,
      }
    });

    return NextResponse.json({
      success: true,
      fileUrl: fileUrl,
      originalSize,
      compressedSize,
      compressionRatio: ((originalSize - compressedSize) / originalSize * 100).toFixed(2),
      anonymousId: !session?.user?.id ? processId : null
    });
  } catch (error) {
    console.error("Compression error: ", error);
    return NextResponse.json({ 
      error: "Compression failed",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}