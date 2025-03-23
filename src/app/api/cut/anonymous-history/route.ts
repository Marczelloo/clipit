import { NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";

export async function GET(req: NextRequest) {
    const ids = req.nextUrl.searchParams.get("ids");
    
    if (!ids) {
        return NextResponse.json({ cuts: [] });
    }
    
    const idArray = ids.split(",");
    
    try {
        const cuts = await db.cut.findMany({
            where: {
                anonymousId: {
                    in: idArray
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
        console.error("Error fetching anonymous cut history:", error);
        return NextResponse.json({ error: "Failed to fetch cut history" }, { status: 500 });
    }
}