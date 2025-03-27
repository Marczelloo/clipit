import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { mkdir, writeFile } from "fs/promises";
import { join, extname, dirname } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { v4 as uuidv4 } from "uuid";
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

    const clipRelativePath = join("clips", serverId, filename);
    const clipFullPath = join(storageConfig.getPath("uploads"), clipRelativePath);

    await mkdir(dirname(clipFullPath), { recursive: true });
    
    // Save the file to the clips directory
    const fileBuffer = await file.arrayBuffer();
    await writeFile(clipFullPath, Buffer.from(fileBuffer));

    const thumbnailRelativePath = join("thumbnails", serverId, `${clipId}.jpg`);
    const thumbnailFullPath = join(storageConfig.getPath("uploads"), thumbnailRelativePath);

    await mkdir(dirname(thumbnailFullPath), { recursive: true });
    
    // Generate thumbnail using ffmpeg
    try {
      await execPromise(
        `ffmpeg -i "${clipFullPath}" -ss 00:00:01.000 -vframes 1 -vf "scale=480:-1" "${thumbnailFullPath}" -y`
      );
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
        fileUrl: `/api/files/${clipRelativePath}`,
        thumbnailUrl: `/api/files/${thumbnailRelativePath}`,
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