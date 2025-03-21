// src/app/api/compress/user-history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";
import { auth } from "~/server/auth";

export async function GET(request: NextRequest) {
  const session = await auth();
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const compressions = await db.compression.findMany({
      where: {
        userId: session.user.id,
        expiresAt: {
          gt: new Date() // Only return non-expired compressions
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5 // Only show the 5 most recent
    });
    
    return NextResponse.json({ compressions });
  } catch (error) {
    console.error('Error fetching user history:', error);
    return NextResponse.json({ error: 'Failed to fetch compression history' }, { status: 500 });
  }
}