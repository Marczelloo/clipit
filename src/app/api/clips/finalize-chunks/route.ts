// src/app/api/clips/finalize-chunks/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { v4 as uuidv4 } from "uuid";
import { extname } from "path";
import { promisify } from "util";
import { 
  uploadFile, 
  getPublicUrl, 
  downloadFile,
  listFiles,
  deleteFile,
  STORAGE_BUCKETS 
} from "~/server/config/supabase-storage";
import { exec } from "child_process";
import { unlink, mkdir, writeFile } from "fs/promises";
import { join } from "path";
import os from "os";

// Configure the API route
export const config = {
  maxDuration: 60, // 60 seconds (Vercel free tier limit)
};

// Define the chunks bucket/folder
const CHUNKS_BUCKET = STORAGE_BUCKETS.TEMP || "temp";
const execPromise = promisify(exec);

export async function POST(request: NextRequest) {
  const session = await auth();
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    // Get details from request
    const body = await request.json();
    const { fileId, fileName, fileType, serverId, title, description, uploadType, totalChunks } = body;

    // Check if this is a clip upload or another type (compress, cut)
    if (uploadType && uploadType !== 'clip') {
      return NextResponse.json({
        success: true,
        message: "Non-clip upload does not need finalization. Processing will happen in the specific tool's API route."
      });
    }

    if (!fileId || !fileName || !fileType || !serverId || !title) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    
    // Verify that the user has access to this ClipServer
    const clipServerUser = await db.clipServerUser.findUnique({
      where: {
        userId_serverId: {
          userId: session.user.id,
          serverId
        }
      }
    });
    
    if (!clipServerUser) {
      return NextResponse.json(
        { error: "Server not found or access denied" },
        { status: 403 }
      );
    }

    // Base path for the user's chunks in Supabase storage
    const chunksBasePath = `chunks/${session.user.id}/${fileId}`;
    
    // List all chunks from Supabase storage
    const chunkFiles = await listFiles(CHUNKS_BUCKET, chunksBasePath);
    
    if (!chunkFiles || chunkFiles.length === 0) {
      return NextResponse.json(
        { error: "No chunks found for this file" },
        { status: 404 }
      );
    }
    
    // Sort chunks by index for proper ordering
    const sortedChunks = chunkFiles
      .filter(file => file.name.startsWith(`${chunksBasePath}/chunk-`)) // Filter only chunk files
      .map(file => {
        // Extract chunk index from filename
        const indexMatch = file.name.match(/chunk-(\d+)$/);
        return {
          path: file.name,
          index: indexMatch ? parseInt(indexMatch[1]) : -1
        };
      })
      .sort((a, b) => a.index - b.index); // Sort by chunk index
    
    // Generate unique ID for the clip
    const clipId = uuidv4();
    
    // Create a filename with original extension
    const fileExt = extname(fileName);
    const outputFilename = `${clipId}${fileExt}`;
    
    // Define storage paths for Supabase
    const clipStoragePath = `${serverId}/${outputFilename}`;
    const thumbnailStoragePath = `${serverId}/${clipId}.jpg`;

    // Download and combine all chunks
    let completeFileBuffer = Buffer.alloc(0);
    for (const chunk of sortedChunks) {
      // Download the chunk from Supabase
      const chunkData = await downloadFile(CHUNKS_BUCKET, chunk.path);
      if (!chunkData) {
        throw new Error(`Failed to download chunk: ${chunk.path}`);
      }
      // Combine into complete file buffer
      completeFileBuffer = Buffer.concat([completeFileBuffer, chunkData]);
    }
    
    // Upload the complete file to Supabase Storage
    await uploadFile(
      STORAGE_BUCKETS.CLIPS, 
      clipStoragePath, 
      completeFileBuffer,
      fileType
    );

    // Get the public URL for the clip
    const clipUrl = getPublicUrl(STORAGE_BUCKETS.CLIPS, clipStoragePath);
    
    // Generate thumbnail
    let thumbnailUrl = null;
    
    try {
      // Create a temp directory for thumbnail generation
      const tempThumbnailDir = join(os.tmpdir(), 'clipit-thumbnails');
      const tempVideoPath = join(tempThumbnailDir, outputFilename);
      const tempThumbnailPath = join(tempThumbnailDir, `${clipId}.jpg`);
      
      // Ensure temp directory exists
      await mkdir(tempThumbnailDir, { recursive: true });
      
      // Write the video file temporarily to disk
      await writeFile(tempVideoPath, completeFileBuffer);
      
      // Generate thumbnail using ffmpeg
      await execPromise(
        `ffmpeg -i "${tempVideoPath}" -ss 00:00:01.000 -vframes 1 -vf "scale=480:-1" "${tempThumbnailPath}" -y`
      );
      
      // Read the generated thumbnail
      const thumbnailBuffer = await import("fs/promises").then(fs => 
        fs.readFile(tempThumbnailPath)
      );
      
      // Upload thumbnail to Supabase
      await uploadFile(
        STORAGE_BUCKETS.THUMBNAILS,
        thumbnailStoragePath,
        thumbnailBuffer,
        "image/jpeg"
      );
      
      // Get public URL for thumbnail
      thumbnailUrl = getPublicUrl(STORAGE_BUCKETS.THUMBNAILS, thumbnailStoragePath);
      
      // Clean up temp files
      await unlink(tempVideoPath).catch(e => console.error("Error deleting temp video:", e));
      await unlink(tempThumbnailPath).catch(e => console.error("Error deleting temp thumbnail:", e));
    } catch (thumbnailError) {
      console.error("Error generating thumbnail:", thumbnailError);
      // Continue without thumbnail if generation fails
    }
    
    // Extract format from file extension (without the dot)
    const format = fileExt.replace('.', '').toLowerCase();
    
    // Create record in database (fixed fields to match schema)
    const clip = await db.clip.create({
      data: {
        id: clipId,
        title,
        description: description || "",
        fileUrl: clipUrl,
        thumbnailUrl,
        userId: session.user.id,
        serverId,
        clipServerId: serverId, // Set clipServerId field which isn't the same as serverId
        fileSize: completeFileBuffer.length,
        originalName: fileName,
        format: format // Use the format field from the schema instead of mimeType
      }
    });
    
    // Clean up chunks from Supabase storage (delete each chunk)
    for (const chunk of sortedChunks) {
      await deleteFile(CHUNKS_BUCKET, chunk.path).catch(e => 
        console.error(`Error deleting chunk ${chunk.path}:`, e)
      );
    }
    
    return NextResponse.json({
      success: true,
      clip: {
        id: clip.id,
        title: clip.title,
        fileUrl: clip.fileUrl,
        thumbnailUrl: clip.thumbnailUrl,
        createdAt: clip.createdAt,
        updatedAt: clip.updatedAt
      }
    });
    
  } catch (error) {
    console.error("Error finalizing chunked upload:", error);
    return NextResponse.json(
      { error: "Failed to finalize upload", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}