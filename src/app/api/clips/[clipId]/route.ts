import { NextResponse } from "next/server";
import path from "path";

import { db } from "~/server/db";
import { auth } from "~/server/auth";
import { deleteFile, STORAGE_BUCKETS, getStoragePathFromUrl } from "~/server/config/supabase-storage";

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
    
    try 
    {
      // Delete the clip file from Supabase storage
      if (clip.fileUrl) 
      {
        // Extract the storage path from the URL
        const clipStoragePath = getStoragePathFromUrl(clip.fileUrl);
        
        if (clipStoragePath) {
          await deleteFile(STORAGE_BUCKETS.CLIPS, clipStoragePath).catch(err => {
            console.log("Error deleting clip file from storage:", err);
          });
        }
      }
      
      // Delete the thumbnail from Supabase storage
      if (clip.thumbnailUrl) 
      {
        // Extract the storage path from the URL
        const thumbnailStoragePath = getStoragePathFromUrl(clip.thumbnailUrl);
        
        if (thumbnailStoragePath) {
          await deleteFile(STORAGE_BUCKETS.THUMBNAILS, thumbnailStoragePath).catch(err => {
            console.log("Error deleting thumbnail from storage:", err);
          });
        }
      }
    } 
    catch (fileError) 
    {
      // Log file deletion errors but don't fail the request
      console.error("Error deleting clip files from Supabase:", fileError);
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