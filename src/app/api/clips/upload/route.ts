import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { extname } from "path";
import { v4 as uuidv4 } from "uuid";
import { 
  uploadFile, 
  getPublicUrl, 
  STORAGE_BUCKETS 
} from "~/server/config/supabase-storage";

// Temporary file handling for thumbnail generation (still needed)
import { mkdir, writeFile, unlink } from "fs/promises";
import { join, dirname } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import os from "os";
import storageConfig from "~/server/config/storage";

const execPromise = promisify(exec);

export async function POST(request: NextRequest) {
  const session = await auth();
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string || "";
    const serverId = formData.get("serverId") as string;
    
    if (!file || !title || !serverId) {
      return NextResponse.json(
        { error: "Missing required fields: file, title, and serverId" },
        { status: 400 }
      );
    }
    
    // Verify that the user has access to this ClipServer
    const clipServerUser = await db.clipServerUser.findUnique({
      where: {
        userId_serverId: {
          userId: session.user.id,
          serverId: serverId
        }
      },
      include: {
        server: true
      }
    });
    
    if (!clipServerUser) {
      return NextResponse.json(
        { error: "Server not found or access denied" },
        { status: 403 }
      );
    }
    
    // Generate unique ID for the clip
    const clipId = uuidv4();
    
    // Get file extension and create a filename
    const fileExt = extname(file.name);
    const filename = `${clipId}${fileExt}`;

    // Define storage paths for Supabase
    const clipStoragePath = `${serverId}/${filename}`;
    const thumbnailStoragePath = `${serverId}/${clipId}.jpg`;
    
    // Get file data
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    
    // Upload the video file to Supabase Storage
    await uploadFile(
      STORAGE_BUCKETS.CLIPS, 
      clipStoragePath, 
      fileBuffer,
      file.type
    );

    // Get the public URL for the clip
    const clipUrl = getPublicUrl(STORAGE_BUCKETS.CLIPS, clipStoragePath);
    
    // Thumbnail generation
    // Since ffmpeg processing can't be done directly in Supabase,
    // we'll temporarily save the file locally, generate the thumbnail, 
    // and then upload the thumbnail to Supabase
    
    let thumbnailUrl = null;
    
    try {
      // Create a temp directory path
      const tempDir = join(os.tmpdir(), 'clipit-thumbnails');
      const tempVideoPath = join(tempDir, filename);
      const tempThumbnailPath = join(tempDir, `${clipId}.jpg`);
      
      // Ensure temp directory exists
      await mkdir(tempDir, { recursive: true });
      
      // Write the video file temporarily to disk
      await writeFile(tempVideoPath, fileBuffer);
      
      // Generate thumbnail using ffmpeg
      await execPromise(
        `ffmpeg -i "${tempVideoPath}" -ss 00:00:01.000 -vframes 1 -vf "scale=480:-1" "${tempThumbnailPath}" -y`
      );
      
      // Read the generated thumbnail
      const thumbnailBuffer = await require('fs/promises').readFile(tempThumbnailPath);
      
      // Upload the thumbnail to Supabase Storage
      await uploadFile(
        STORAGE_BUCKETS.THUMBNAILS, 
        thumbnailStoragePath, 
        thumbnailBuffer, 
        'image/jpeg'
      );
      
      // Get the public URL for the thumbnail
      thumbnailUrl = getPublicUrl(STORAGE_BUCKETS.THUMBNAILS, thumbnailStoragePath);
      
      // Clean up temporary files
      await unlink(tempVideoPath).catch(() => {});
      await unlink(tempThumbnailPath).catch(() => {});
      
    } catch (thumbnailError) {
      console.error("Error generating thumbnail:", thumbnailError);
      // Continue without thumbnail if it fails
    }
    
    // Create the clip record in the database
    const clip = await db.clip.create({
      data: {
        id: clipId,
        title,
        description,
        fileUrl: clipUrl,
        thumbnailUrl: thumbnailUrl,
        userId: session.user.id,
        serverId: "default", // Using a placeholder for the required field
        clipServerId: serverId, // This is the ClipServer ID we actually want to use
        originalName: file.name,
        fileSize: file.size,
        format: fileExt.replace(".", ""),
      }
    });
    
    return NextResponse.json({
      success: true,
      clipId: clip.id,
      fileUrl: clip.fileUrl,
      thumbnailUrl: clip.thumbnailUrl,
      server: clipServerUser.server.name
    });
  } catch (error) {
    console.error("Error uploading clip:", error);
    return NextResponse.json(
      { error: "Failed to upload clip", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}