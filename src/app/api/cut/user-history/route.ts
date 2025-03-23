import { NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

export async function GET() {
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
            }
        });
        
        return NextResponse.json({ cuts });
    } catch (error) {
        console.error("Error fetching user cut history:", error);
        return NextResponse.json({ error: "Failed to fetch cut history" }, { status: 500 });
    }
}