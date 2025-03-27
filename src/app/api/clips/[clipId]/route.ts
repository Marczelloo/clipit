import { NextResponse } from "next/server";
import { db } from "~/server/db";

export async function GET(_request: Request, { params }: { params: { clipId: string } }) {
  const clipId = params.clipId;
  
  try {
    const clip = await db.clip.findUnique({
      where: { id: clipId },
      select: {
        id: true,
        title: true,
        description: true,
        fileUrl: true,
        thumbnailUrl: true,
        userId: true,
        createdAt: true,
        fileSize: true,
        duration: true,
        format: true
      }
    });
    
    if (!clip) {
      return NextResponse.json({ error: "Clip not found" }, { status: 404 });
    }
    
    // Format dates for JSON serialization
    const formattedClip = {
      ...clip,
      createdAt: clip.createdAt.toISOString()
    };
    
    return NextResponse.json({ 
      clip: formattedClip 
    }, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=600",
      }
    });
  } catch (error) {
    console.error("Error fetching clip:", error);
    return NextResponse.json({ error: "Failed to fetch clip" }, { status: 500 });
  }
}