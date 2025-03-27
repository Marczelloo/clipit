import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { v4 as uuidv4 } from "uuid";
import { randomBytes } from "crypto";

// Function to generate a unique invite code
function generateInviteCode(): string {
  // Create a 6 character alphanumeric code
  return randomBytes(4).toString('hex').substring(0, 6).toUpperCase();
}

export async function GET(_request: NextRequest) {
  const session = await auth();
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    // Find all clip servers this user is a member of
    const userClipServers = await db.clipServerUser.findMany({
      where: {
        userId: session.user.id
      },
      include: {
        server: true
      },
      orderBy: {
        server: {
          createdAt: 'desc'
        }
      }
    });
    
    // Format the response
    const servers = userClipServers.map(membership => ({
      id: membership.server.id,
      name: membership.server.name,
      imageUrl: membership.server.imageUrl,
      ownerId: membership.server.ownerId,
      createdAt: membership.server.createdAt,
      // Only include the code if user is the owner
      code: membership.server.ownerId === session.user.id ? membership.server.inviteCode : undefined
    }));
    
    return NextResponse.json({ 
      success: true,
      servers
    }, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    console.error('Error fetching clip servers:', error);
    return NextResponse.json({ error: 'Failed to fetch clip servers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    const { name } = body;
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Server name is required" },
        { status: 400 }
      );
    }
    
    // Generate a unique server ID and invite code
    const serverId = uuidv4();
    const inviteCode = generateInviteCode();
    
    // Create the clip server
    const server = await db.clipServer.create({
      data: {
        id: serverId,
        name: name.trim(),
        ownerId: session.user.id,
        inviteCode,
        users: {
          create: {
            userId: session.user.id,
            isOwner: true
          }
        }
      }
    });
    
    return NextResponse.json({
      success: true,
      server: {
        id: server.id,
        name: server.name,
        ownerId: server.ownerId,
        code: server.inviteCode,
        createdAt: server.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating clip server:', error);
    return NextResponse.json({ error: 'Failed to create clip server' }, { status: 500 });
  }
}