import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "~/server/auth";
import { cleanupExpiredFiles } from "~/server/services/cleanup";
import { env } from "~/env";

interface CleanupRequest {
  action?: string;
}

// GET endpoint for Vercel Cron jobs
export async function GET(req: NextRequest) {
  // For Vercel Cron, verify using a secret token in the Authorization header
  const authHeader = req.headers.get("Authorization");
  const isCronRequest = authHeader === `Bearer ${env.CRON_SECRET}`;
  
  // If not a cron request, check if user is authenticated
  if (!isCronRequest) {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  console.log(`[${new Date().toISOString()}] Running scheduled storage cleanup via Vercel Cron`);
  
  try {
    const stats = await cleanupExpiredFiles();
    
    return NextResponse.json({
      success: true,
      message: "Cleanup completed successfully",
      stats,
    });
  } catch (error) {
    console.error("Storage cleanup error:", error);
    return NextResponse.json(
      { error: "Cleanup operation failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// POST endpoint for manual triggering
export async function POST(req: NextRequest) {
  // Check authorization
  const session = await auth();
  
  // This endpoint should only be accessible by admins
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const { action } = await req.json().catch(() => ({ action: "run" })) as CleanupRequest;
  
  if (action === "status") {
    // Return status of last run (can be improved to store this in DB)
    return NextResponse.json({
      success: true,
      message: "Vercel Cron handles scheduling automatically",
      vercel_cron: {
        schedule: "0 0 * * *", // Same as in vercel.json
        next_run: "Check Vercel Dashboard"
      }
    });
  }
  
  try {
    const stats = await cleanupExpiredFiles();
    
    return NextResponse.json({
      success: true,
      message: "Cleanup completed successfully",
      stats,
    });
  } catch (error) {
    console.error("Storage cleanup error:", error);
    return NextResponse.json(
      { error: "Cleanup operation failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}