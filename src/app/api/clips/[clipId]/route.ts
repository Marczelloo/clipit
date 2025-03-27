import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

import { db } from "~/server/db";
import { auth } from "~/server/auth";
import storageConfig from "~/server/config/storage";

// GET endpoint to fetch a specific clip by ID
export async function GET(
  request: Request,
  { params }: { params: { clipId: string } }
) {
  try {
    const { clipId } = params;
    
    const clip = await db.clip.findUnique({
      where: { id: clipId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });
    
    if (!clip) {
      return NextResponse.json({ error: "Clip not found" }, { status: 404 });
    }
    
    return NextResponse.json({ clip });
  } catch (error) {
    console.error("Error fetching clip:", error);
    return NextResponse.json(
      { error: "Failed to fetch clip" },
      { status: 500 }
    );
  }
}

// DELETE endpoint to delete a specific clip
export async function DELETE(
  request: Request,
  { params }: { params: { clipId: string } }
) {
  try {
    const session = await auth();
    
    // Check if user is authenticated
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    const { clipId } = params;
    
    // Get the clip to check ownership and get file paths
    const clip = await db.clip.findUnique({
      where: { id: clipId },
    });
    
    if (!clip) {
      return NextResponse.json({ error: "Clip not found" }, { status: 404 });
    }
    
    // Check if the user owns the clip
    if (clip.userId !== session.user.id) {
      return NextResponse.json(
        { error: "You don't have permission to delete this clip" },
        { status: 403 }
      );
    }
    
    // Delete the clip from the database
    await db.clip.delete({
      where: { id: clipId },
    });
    
    // Delete the associated files if they exist
    const storageDir = storageConfig.getPath("uploads");
    
    try 
    {
      // Try to delete the clip file
      if (clip.fileUrl) 
      {
        const clipFilename = path.basename(clip.fileUrl);
        const clipPath = path.join(storageDir, "clips", clip.clipServerId ?? "", clipFilename);
      
        await fs.unlink(clipPath).catch(() => {
          // Ignore errors if file doesn't exist
          console.log("Clip file not found for deletion:", clipPath);
        });
      }
      
      // Try to delete the thumbnail if it exists
      if (clip.thumbnailUrl) 
      {
        const thumbnailFilename = path.basename(clip.thumbnailUrl);
        const thumbnailPath = path.join(storageDir, "thumbnails", clip.clipServerId ?? "", thumbnailFilename);
        
        await fs.unlink(thumbnailPath).catch(() => {
          // Ignore errors if file doesn't exist
          console.log("Thumbnail file not found for deletion:", thumbnailPath);
        });
      }
    } 
    catch (fileError) 
    {
      // Log file deletion errors but don't fail the request
      console.error("Error deleting clip files:", fileError);
    }
    
    return NextResponse.json({ success: true, message: "Clip deleted successfully" });
  } catch (error) {
    console.error("Error deleting clip:", error);
    return NextResponse.json(
      { error: "Failed to delete clip" },
      { status: 500 }
    );
  }
}