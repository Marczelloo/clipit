import { CronJob } from 'cron';
import { cleanupExpiredFiles } from '../services/cleanup';

// Store active jobs
const activeJobs: Record<string, CronJob> = {};

/**
 * Scheduler service for handling recurring tasks within the application
 */
export class Scheduler {
  /**
   * Initialize the cleanup job to run at specified intervals
   * @param cronExpression - Cron expression for scheduling (default: midnight every day)
   */
  static initCleanupJob(cronExpression = '0 0 * * *') {
    if (activeJobs['storage-cleanup']) {
      console.log('Storage cleanup job is already running');
      return;
    }

    try {
      // Create a new cron job for cleanup
      const job = new CronJob(
        cronExpression,
        async () => {
          console.log(`[${new Date().toISOString()}] Running scheduled storage cleanup`);
          
          try {
            const stats = await cleanupExpiredFiles();
            
            console.log(`Cleanup completed: ${stats.filesDeleted} files deleted, ${stats.bytesFreed} bytes freed`);
            
            if (stats.errors.length > 0) {
              console.warn('Cleanup warnings:', stats.errors);
            }
          } catch (error) {
            console.error('Scheduled cleanup error:', error);
          }
        },
        null, // onComplete
        true, // start
        'UTC' // timezone
      );
      
      // Store the job reference
      activeJobs['storage-cleanup'] = job;
      
      console.log(`Storage cleanup job scheduled with cron: ${cronExpression}`);
      return job;
    } catch (error) {
      console.error('Failed to initialize cleanup job:', error);
      throw error;
    }
  }

  /**
   * Stop the cleanup job if it's running
   */
  static stopCleanupJob() {
    const job = activeJobs['storage-cleanup'];
    if (job) {
      job.stop();
      delete activeJobs['storage-cleanup'];
      console.log('Storage cleanup job stopped');
    }
  }

  /**
   * Get status of all scheduled jobs
   */
  static getJobsStatus() {
    return Object.entries(activeJobs).map(([name, job]) => ({
      name,
      running: (job as unknown as { running: boolean }).running,
      cronTime: job.cronTime.toString(),
      lastDate: (job as unknown as { lastDate: Date }).lastDate,
      nextDate: (job as unknown as { nextDate: Date }).nextDate,
    }));
  }
}