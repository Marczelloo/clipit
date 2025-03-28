// src/app/api/clips/chunk-upload/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { 
  uploadFile, 
  getPublicUrl, 
  STORAGE_BUCKETS 
} from "~/server/config/supabase-storage";

// Configure the API route to handle chunked uploads
// Remove the edge runtime to ensure full Node.js compatibility
export const config = {
  maxDuration: 60, // 60 seconds limit
};

// Define a temporary bucket or folder for chunks
const CHUNKS_BUCKET = STORAGE_BUCKETS.TEMP || "temp";

export async function POST(request: NextRequest) {
  const session = await auth();
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const formData = await request.formData();
    const chunk = formData.get("chunk") as File;
    const index = formData.get("index") as string;
    const totalChunks = formData.get("totalChunks") as string;
    const fileId = formData.get("fileId") as string;
    const fileName = formData.get("fileName") as string;
    const fileType = formData.get("fileType") as string;
    const serverId = formData.get("serverId") as string;
    const uploadType = formData.get("uploadType") as string || "clip";
    
    // Add logging
    console.log(`Processing chunk ${index}/${totalChunks} for file ${fileId} (${fileName})`);
    
    // Validate required fields
    if (!chunk || !index || !totalChunks || !fileId || !fileName || !fileType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Only verify server access if this is a clip upload type
    if (uploadType === "clip") {
      // ServerId is required for clip uploads
      if (!serverId) {
        return NextResponse.json(
          { error: "Server ID required for clip uploads" },
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
        }
      });
      
      if (!clipServerUser) {
        return NextResponse.json(
          { error: "Server not found or access denied" },
          { status: 403 }
        );
      }
    }
    
    // Create a path that includes user ID, file ID, and chunk index to ensure uniqueness
    const chunkPath = `chunks/${session.user.id}/${fileId}/chunk-${index}`;
    
    // Convert the chunk to a buffer and verify it has content
    const arrayBuffer = await chunk.arrayBuffer();
    const chunkBuffer = Buffer.from(arrayBuffer);
    
    if (chunkBuffer.length === 0) {
      console.error(`Received empty chunk ${index}/${totalChunks} for file ${fileId}`);
      return NextResponse.json(
        { error: "Received empty chunk" },
        { status: 400 }
      );
    }
    
    console.log(`Uploading chunk ${index}, size: ${chunkBuffer.length} bytes`);
    
    // Upload the chunk to Supabase storage
    await uploadFile(
      CHUNKS_BUCKET, 
      chunkPath, 
      chunkBuffer, 
      'application/octet-stream'
    );
    
    // Check if this is the last chunk
    const isLastChunk = parseInt(index) === parseInt(totalChunks) - 1;
    
    if (isLastChunk) {
      console.log(`Received final chunk (${index}) for ${fileId}, ready for finalization`);
      return NextResponse.json({
        success: true,
        ready: true,
        fileId,
        fileName,
        fileType,
        serverId,
        uploadType,
        totalChunks: parseInt(totalChunks)
      });
    }
    
    return NextResponse.json({
      success: true,
      index: parseInt(index),
      fileId
    });
    
  } catch (error) {
    console.error("Error handling chunk upload:", error);
    return NextResponse.json(
      { error: "Failed to process chunk", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}