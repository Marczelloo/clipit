// src/app/api/compress/anonymous-history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const ids = url.searchParams.get('ids');
    
    if (!ids) {
      return NextResponse.json({ compressions: [] });
    }
    
    const anonymousIds = ids.split(',');
    
    const compressions = await db.compression.findMany({
      where: {
        anonymousId: {
          in: anonymousIds
        },
        expiresAt: {
          gt: new Date() // Only return non-expired compressions
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return NextResponse.json({ compressions });
  } catch (error) {
    console.error('Error fetching anonymous history:', error);
    return NextResponse.json({ error: 'Failed to fetch compression history' }, { status: 500 });
  }
}