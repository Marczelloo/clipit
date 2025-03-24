import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "~/server/db";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const ids = url.searchParams.get('ids');
    
    if (!ids) {
      return NextResponse.json({ cuts: [] });
    }
    
    const anonymousIds = ids.split(',');
    
    const cuts = await db.cut.findMany({
      where: {
        anonymousId: {
          in: anonymousIds
        },
        expiresAt: {
          gt: new Date() // Only return non-expired cuts
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return NextResponse.json({ cuts });
  } catch (error) {
    console.error('Error fetching anonymous history:', error);
    return NextResponse.json({ error: 'Failed to fetch cut history' }, { status: 500 });
  }
}