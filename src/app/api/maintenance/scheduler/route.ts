import { NextRequest, NextResponse } from "next/server";
import { auth } from "~/server/auth";
import { Scheduler } from "~/server/services/scheduler";

export async function GET(req: NextRequest) {
  // Check authorization
  const session = await auth();
  
  // This endpoint should only be accessible by admins
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const schedulerStatus = Scheduler.getJobsStatus();
    
    return NextResponse.json({
      success: true,
      status: schedulerStatus
    });
  } catch (error) {
    console.error("Failed to get scheduler status:", error);
    return NextResponse.json(
      { error: "Failed to get scheduler status", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  // Check authorization
  const session = await auth();
  
  // This endpoint should only be accessible by admins
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    const { action, cronExpression } = await req.json();
    
    if (action === "start") {
      const job = Scheduler.initCleanupJob(cronExpression);
      return NextResponse.json({
        success: true,
        message: "Cleanup job started",
        status: job ? "running" : "failed to start"
      });
    } 
    else if (action === "stop") {
      Scheduler.stopCleanupJob();
      return NextResponse.json({
        success: true,
        message: "Cleanup job stopped"
      });
    }
    else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Scheduler control error:", error);
    return NextResponse.json(
      { error: "Failed to control scheduler", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}