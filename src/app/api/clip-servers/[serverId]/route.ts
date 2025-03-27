import { NextRequest, NextResponse } from 'next/server';
import { auth } from '~/server/auth';
import { db } from '~/server/db';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { serverId: string } }
) {
  const serverId = params.serverId;
  const session = await auth();
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    // Verify that the user is a member of this server
    const membership = await db.clipServerUser.findUnique({
      where: {
        userId_serverId: {
          userId: session.user.id,
          serverId
        }
      }
    });
    
    if (!membership) {
      return NextResponse.json({ error: "Server not found or access denied" }, { status: 403 });
    }
    
    // Get server details
    const server = await db.clipServer.findUnique({
      where: {
        id: serverId
      }
    });
    
    if (!server) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }
    
    // Get all clips for this server
    const allClips = await db.clip.findMany({
      where: {
        clipServerId: serverId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // Get recent clips (limited to 10)
    const recentClips = await db.clip.findMany({
      where: {
        clipServerId: serverId
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });
    
    // Get all users in this server
    const serverUserMembers = await db.clipServerUser.findMany({
      where: {
        serverId
      },
      include: {
        user: true
      }
    });
    
    // Format server users
    const serverUsers = serverUserMembers.map(membership => ({
      id: membership.user.id,
      name: membership.user.name,
      image: membership.user.image,
      serverId,
      userId: membership.userId,
      isOwner: membership.isOwner
    }));
    
    // Get unique user IDs from clips
    const userIds = [...new Set(allClips.map(clip => clip.userId))];
    
    // Get user details
    const users = await db.user.findMany({
      where: {
        id: {
          in: userIds
        }
      },
      select: {
        id: true,
        name: true,
        image: true
      }
    });
    
    // Organize clips by user
    const usersWithClips = users.map(user => {
      const userClips = allClips.filter(clip => clip.userId === user.id);
      return {
        ...user,
        clips: userClips
      };
    });
    
    return NextResponse.json({
      success: true,
      server: {
        ...server,
        code: server.ownerId === session.user.id ? server.inviteCode : undefined
      },
      recentClips,
      serverUsers,
      users: usersWithClips
    });
  } catch (error) {
    console.error('Error fetching server data:', error);
    return NextResponse.json({ error: 'Failed to fetch server data' }, { status: 500 });
  }
}