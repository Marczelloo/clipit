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
import { unlink, mkdir, writeFile, readFile } from "fs/promises";
import { join } from "path";
import os from "os";

// Remove the edge runtime to ensure full Node.js compatibility
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

    console.log(`Starting finalization for file: ${fileName}, fileId: ${fileId}`);

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
    
    console.log(`Listing chunks from path: ${chunksBasePath}`);
    
    // List all chunks from Supabase storage
    const chunkFiles = await listFiles(CHUNKS_BUCKET, chunksBasePath);
    
    console.log(`Found ${chunkFiles?.length || 0} chunks`);
    
    if (!chunkFiles || chunkFiles.length === 0) {
      return NextResponse.json(
        { error: "No chunks found for this file", path: chunksBasePath },
        { status: 404 }
      );
    }
    
    // Sort chunks by index for proper ordering
    const sortedChunks = chunkFiles
      .filter(file => file.name && file.name.includes('chunk-')) // Filter only chunk files
      .map(file => {
        // Extract chunk index from filename
        const indexMatch = file.name.match(/chunk-(\d+)$/);
        return {
          path: `${chunksBasePath}/chunk-${indexMatch ? indexMatch[1] : '0'}`,
          index: indexMatch ? parseInt(indexMatch[1]) : 0
        };
      })
      .sort((a, b) => a.index - b.index); // Sort by chunk index
      
    console.log(`Sorted ${sortedChunks.length} chunks for processing`);
    
    // Generate unique ID for the clip
    const clipId = uuidv4();
    
    // Create a filename with original extension
    const fileExt = extname(fileName) || '.mp4';
    const outputFilename = `${clipId}${fileExt}`;
    
    // Define storage paths for Supabase
    const clipStoragePath = `${serverId}/${outputFilename}`;
    const thumbnailStoragePath = `${serverId}/${clipId}.jpg`;

    // Download and combine all chunks
    console.log('Combining chunks into complete file...');
    
    const allChunks = [];
    let totalSize = 0;
    
    for (const [index, chunk] of sortedChunks.entries()) {
      console.log(`Processing chunk ${index + 1}/${sortedChunks.length}: ${chunk.path}`);
      
      try {
        // Download the chunk from Supabase as a blob
        const chunkBlob = await downloadFile(CHUNKS_BUCKET, chunk.path);
        
        if (!chunkBlob) {
          console.error(`Chunk ${chunk.path} returned null or undefined data`);
          continue;
        }
        
        // Convert blob to array buffer
        const chunkArrayBuffer = await chunkBlob.arrayBuffer();
        
        // Convert array buffer to Buffer
        const chunkBuffer = Buffer.from(chunkArrayBuffer);
        
        console.log(`Chunk ${index + 1} size: ${chunkBuffer.length} bytes`);
        
        if (chunkBuffer.length === 0) {
          console.warn(`Chunk ${index + 1} has zero bytes, skipping`);
          continue;
        }
        
        allChunks.push(chunkBuffer);
        totalSize += chunkBuffer.length;
      } catch (chunkError) {
        console.error(`Error processing chunk ${chunk.path}:`, chunkError);
      }
    }
    
    if (allChunks.length === 0) {
      return NextResponse.json({ 
        error: "Failed to retrieve any valid chunks" 
      }, { status: 500 });
    }
    
    console.log(`Combined ${allChunks.length} chunks, total size: ${totalSize} bytes`);
    
    // Concatenate all chunks into one buffer
    const completeFileBuffer = Buffer.concat(allChunks);
    
    console.log(`Complete file size: ${completeFileBuffer.length} bytes`);
    
    if (completeFileBuffer.length === 0) {
      return NextResponse.json({ 
        error: "Created empty file buffer, upload failed" 
      }, { status: 500 });
    }
    
    // Upload the complete file to Supabase Storage
    console.log(`Uploading complete file to ${STORAGE_BUCKETS.CLIPS}/${clipStoragePath}`);
    
    try {
      await uploadFile(
        STORAGE_BUCKETS.CLIPS, 
        clipStoragePath, 
        completeFileBuffer,
        fileType || 'video/mp4'
      );
      
      console.log('Complete file upload successful');
    } catch (uploadError) {
      console.error('Error uploading complete file:', uploadError);
      return NextResponse.json({ 
        error: "Failed to upload complete file to storage",
        details: uploadError instanceof Error ? uploadError.message : String(uploadError)
      }, { status: 500 });
    }

    // Get the public URL for the clip
    const clipUrl = getPublicUrl(STORAGE_BUCKETS.CLIPS, clipStoragePath);
    console.log(`Generated clip URL: ${clipUrl}`);
    
    // Generate thumbnail
    let thumbnailUrl = null;
    
    try {
      console.log('Starting thumbnail generation...');
      
      // Check if ffmpeg is available - this is critical for Vercel deployment
      try {
        await execPromise('ffmpeg -version');
        console.log('FFmpeg is available');
      } catch (ffmpegError) {
        console.error('FFmpeg is not available:', ffmpegError);
        throw new Error('FFmpeg is not available in this environment');
      }
      
      // Create a temp directory for thumbnail generation
      const tempThumbnailDir = join(os.tmpdir(), 'clipit-thumbnails');
      await mkdir(tempThumbnailDir, { recursive: true });
      console.log(`Created temp directory: ${tempThumbnailDir}`);
      
      const tempVideoPath = join(tempThumbnailDir, outputFilename);
      const tempThumbnailPath = join(tempThumbnailDir, `${clipId}.jpg`);
      
      console.log(`Writing ${completeFileBuffer.length} bytes to temp file: ${tempVideoPath}`);
      await writeFile(tempVideoPath, completeFileBuffer);
      
      // Generate thumbnail using ffmpeg
      const ffmpegCommand = `ffmpeg -i "${tempVideoPath}" -ss 00:00:01.000 -vframes 1 -vf "scale=480:-1" "${tempThumbnailPath}" -y`;
      console.log(`Executing: ${ffmpegCommand}`);
      
      const { stdout, stderr } = await execPromise(ffmpegCommand);
      if (stderr) console.log('FFmpeg stderr:', stderr);
      
      // Verify the thumbnail was created
      try {
        const thumbnailStats = await import('fs/promises').then(fs => fs.stat(tempThumbnailPath));
        console.log(`Thumbnail created, size: ${thumbnailStats.size} bytes`);
        
        if (thumbnailStats.size === 0) {
          throw new Error('Generated thumbnail has zero bytes');
        }
      } catch (statError) {
        console.error('Error checking thumbnail:', statError);
        throw new Error('Thumbnail was not created properly');
      }
      
      // Read the generated thumbnail
      const thumbnailBuffer = await readFile(tempThumbnailPath);
      console.log(`Read thumbnail into buffer, size: ${thumbnailBuffer.length} bytes`);
      
      if (thumbnailBuffer.length === 0) {
        throw new Error('Thumbnail buffer is empty');
      }
      
      // Upload thumbnail to Supabase
      console.log(`Uploading thumbnail to ${STORAGE_BUCKETS.THUMBNAILS}/${thumbnailStoragePath}`);
      await uploadFile(
        STORAGE_BUCKETS.THUMBNAILS,
        thumbnailStoragePath,
        thumbnailBuffer,
        "image/jpeg"
      );
      
      // Get public URL for thumbnail
      thumbnailUrl = getPublicUrl(STORAGE_BUCKETS.THUMBNAILS, thumbnailStoragePath);
      console.log(`Generated thumbnail URL: ${thumbnailUrl}`);
      
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
    console.log('Creating database record for clip');
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
    console.log('Cleaning up chunks...');
    for (const chunk of sortedChunks) {
      await deleteFile(CHUNKS_BUCKET, chunk.path).catch(e => 
        console.error(`Error deleting chunk ${chunk.path}:`, e)
      );
    }
    
    console.log('Finalization completed successfully');
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