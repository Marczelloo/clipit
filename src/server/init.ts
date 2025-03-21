import { Scheduler } from "./services/scheduler";

/**
 * Initialize server-side services
 * This file contains startup logic for server-side services
 */
export function initializeServer() {
  // Start scheduled tasks
  initializeScheduledTasks();
}

/**
 * Initialize any scheduled tasks that need to run periodically
 */
function initializeScheduledTasks() {
  if (process.env.NODE_ENV !== 'development' || process.env.ENABLE_SCHEDULER_IN_DEV === 'true') {
    // Configure storage cleanup to run every 30 minutes
    // Cron format: minute hour day-of-month month day-of-week
    const cronSchedule = process.env.CLEANUP_CRON_SCHEDULE ?? '*/30 * * * *';
    
    try {
      Scheduler.initCleanupJob(cronSchedule);
      console.log(`Scheduled storage cleanup initialized with schedule: ${cronSchedule}`);
    } catch (error) {
      console.error('Failed to initialize scheduled tasks:', error);
    }
  } else {
    console.log('Scheduled tasks not enabled in development mode');
  }
}