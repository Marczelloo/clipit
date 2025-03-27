import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

export async function POST(request: NextRequest) {
  const session = await auth();
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    const { code } = body;
    
    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return NextResponse.json(
        { error: "Invite code is required" },
        { status: 400 }
      );
    }
    
    // Find the server with this invite code
    const server = await db.clipServer.findFirst({
      where: {
        inviteCode: code.trim()
      }
    });
    
    if (!server) {
      return NextResponse.json(
        { error: "Invalid invite code" },
        { status: 404 }
      );
    }
    
    // Check if user is already a member of this server
    const existingMembership = await db.clipServerUser.findUnique({
      where: {
        userId_serverId: {
          userId: session.user.id,
          serverId: server.id
        }
      }
    });
    
    if (existingMembership) {
      return NextResponse.json(
        { error: "You are already a member of this server" },
        { status: 400 }
      );
    }
    
    // Add user to server
    await db.clipServerUser.create({
      data: {
        userId: session.user.id,
        serverId: server.id,
        isOwner: false
      }
    });
    
    return NextResponse.json({
      success: true,
      server: {
        id: server.id,
        name: server.name,
        ownerId: server.ownerId,
        createdAt: server.createdAt
      }
    });
  } catch (error) {
    console.error('Error joining clip server:', error);
    return NextResponse.json({ error: 'Failed to join clip server' }, { status: 500 });
  }
}