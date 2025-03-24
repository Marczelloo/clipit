import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "~/server/db";
import { auth } from "~/server/auth";

export async function GET(_request: NextRequest) {
  const session = await auth();
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const cuts = await db.cut.findMany({
      where: {
        userId: session.user.id,
        expiresAt: {
          gt: new Date() // Only return non-expired cuts
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
    });
    
    return NextResponse.json({ 
      success: true,
      cuts 
    },{
      headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    console.error('Error fetching user history:', error);
    return NextResponse.json({ error: 'Failed to fetch cut history' }, { status: 500 });
  }
}