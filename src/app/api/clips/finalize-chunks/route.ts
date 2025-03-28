// src/app/api/clips/finalize-chunks/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { v4 as uuidv4 } from "uuid";
import { extname } from "path";
import { readdir, readFile, unlink, rmdir, mkdir, writeFile } from "fs/promises";
import { join } from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { 
  uploadFile, 
  getPublicUrl, 
  STORAGE_BUCKETS 
} from "~/server/config/supabase-storage";

// Configure the API route
export const config = {
  api: {
    responseLimit: false,
  },
  maxDuration: 60, // 60 seconds (Vercel free tier limit)
};

// Temporary directory for storing chunk files
const TEMP_DIR = join(os.tmpdir(), 'clipit-chunks');
const execPromise = promisify(exec);

export async function POST(request: NextRequest) {
  const session = await auth();
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    // Get details from request
    const body = await request.json();
    const { fileId, fileName, fileType, serverId, title, description, uploadType } = body;

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

    // Path to the user's chunk directory for this file
    const userChunkDir = join(TEMP_DIR, session.user.id, fileId);
    
    // Read all chunks from the temp directory
    const chunkFiles = await readdir(userChunkDir);
    
    // Sort chunk files by index for proper ordering
    chunkFiles.sort((a, b) => {
      const indexA = parseInt(a.split('-')[1]);
      const indexB = parseInt(b.split('-')[1]);
      return indexA - indexB;
    });
    
    // Generate unique ID for the clip
    const clipId = uuidv4();
    
    // Create a filename with original extension
    const fileExt = extname(fileName);
    const outputFilename = `${clipId}${fileExt}`;
    
    // Define storage paths for Supabase
    const clipStoragePath = `${serverId}/${outputFilename}`;
    const thumbnailStoragePath = `${serverId}/${clipId}.jpg`;

    // Combine all chunks into one buffer
    let completeFileBuffer = Buffer.alloc(0);
    for (const chunkFile of chunkFiles) {
      const chunkPath = join(userChunkDir, chunkFile);
      const chunkData = await readFile(chunkPath);
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
      const thumbnailBuffer = await readFile(tempThumbnailPath);
      
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
      await unlink(tempVideoPath);
      await unlink(tempThumbnailPath);
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
    
    // Clean up all chunk files
    for (const chunkFile of chunkFiles) {
      await unlink(join(userChunkDir, chunkFile));
    }
    
    // Remove the chunk directory
    await rmdir(userChunkDir);
    
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