import { NextRequest, NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { cleanupExpiredFiles } from "~/server/services/cleanup";
import { Scheduler } from "~/server/services/scheduler";

export async function POST(req: NextRequest) {
  // Check authorization
  const session = await auth();
  
  // This endpoint should only be accessible by admins
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  // Check if we want to run immediately or just check status
  const { action } = await req.json().catch(() => ({ action: "run" }));
  
  if (action === "status") {
    // Get the scheduler status
    try {
      const scheduledJobs = Scheduler.getJobsStatus();
      const cleanupJob = scheduledJobs.find(job => job.name === 'storage-cleanup');
      
      return NextResponse.json({
        success: true,
        scheduled: cleanupJob ? true : false,
        nextRun: cleanupJob?.nextDate,
        status: cleanupJob?.running ? "active" : "inactive"
      });
    } catch (error) {
      console.error("Failed to get scheduler status:", error);
      return NextResponse.json(
        { error: "Failed to get scheduler status" },
        { status: 500 }
      );
    }
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