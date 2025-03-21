import fs from "fs";
import path from "path";
import { db } from "~/server/db";
import storageConfig from "~/server/config/storage";

export type CleanupStats = {
  filesDeleted: number;
  bytesFreed: number;
  recordsDeleted: number;
  errors: string[];
};

export async function cleanupExpiredFiles(): Promise<CleanupStats> {
  const stats: CleanupStats = {
    filesDeleted: 0,
    bytesFreed: 0,
    recordsDeleted: 0,
    errors: [],
  };

  try {
    // Get all expired compressions
    const now = new Date();
    const expiredCompressions = await db.compression.findMany({
      where: {
        expiresAt: {
          lt: now
        }
      }
    });

    // Process each expired record
    for (const compression of expiredCompressions) {
      try {
        // Construct the full file path
        const filePath = path.join(
          storageConfig.getPath("uploads"),
          compression.filePath
        );

        // Check if file exists before trying to delete
        if (fs.existsSync(filePath)) {
          // Get file size for stats
          const fileStats = fs.statSync(filePath);
          stats.bytesFreed += fileStats.size;
          
          // Delete the file
          fs.unlinkSync(filePath);
          stats.filesDeleted++;
        }

        // Delete the database record
        await db.compression.delete({
          where: {
            id: compression.id
          }
        });
        stats.recordsDeleted++;
      } catch (error) {
        stats.errors.push(`Error processing ${compression.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Optional: Clean up empty directories in the anonymous folder
    if (stats.filesDeleted > 0) {
      try {
        const anonymousDir = path.join(storageConfig.getPath("uploads"), "compressed", "anonymous");
        cleanEmptyDirs(anonymousDir);
      } catch (error) {
        stats.errors.push(`Error cleaning empty directories: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return stats;
  } catch (error) {
    stats.errors.push(`General cleanup error: ${error instanceof Error ? error.message : String(error)}`);
    return stats;
  }
}

// Helper function to remove empty directories
function cleanEmptyDirs(directory: string): void {
  if (!fs.existsSync(directory)) return;
  
  const items = fs.readdirSync(directory);
  
  // Process subdirectories first
  for (const item of items) {
    const fullPath = path.join(directory, item);
    if (fs.statSync(fullPath).isDirectory()) {
      cleanEmptyDirs(fullPath);
    }
  }
  
  // Check if directory is now empty after processing subdirectories
  const remainingItems = fs.readdirSync(directory);
  if (remainingItems.length === 0) {
    fs.rmdirSync(directory);
  }
}