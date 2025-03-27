import { db } from "~/server/db";
import { deleteFile, STORAGE_BUCKETS } from "~/server/config/supabase-storage";

export type CleanupStats = {
  filesDeleted: number;
  bytesFreed: number; // This will be approximated from database records
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

    // Process each expired compression record
    for (const compression of expiredCompressions) {
      try {
        if (compression.filePath) {
          // Determine the bucket (compressed files are in the COMPRESSED bucket)
          const bucket = STORAGE_BUCKETS.COMPRESSED;
          
          // Delete the file from Supabase storage
          await deleteFile(bucket, compression.filePath).catch(err => {
            stats.errors.push(`Storage deletion error for ${compression.id}: ${err.message}`);
          });
          
          // Count as deleted and add to bytes freed
          stats.filesDeleted++;
          stats.bytesFreed += compression.compressedSize || 0;
        }

        // Delete the database record
        await db.compression.delete({
          where: {
            id: compression.id
          }
        });
        stats.recordsDeleted++;
      } catch (error) {
        stats.errors.push(`Error processing compression ${compression.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // Get expired cut files
    const expiredCuts = await db.cut.findMany({
      where: {
        expiresAt: {
          lt: now
        }
      }
    });

    // Process each expired cut record
    for (const cut of expiredCuts) {
      try {
        if (cut.filePath) {
          // Delete the file from Supabase storage (cuts bucket)
          await deleteFile(STORAGE_BUCKETS.CUTS, cut.filePath).catch(err => {
            stats.errors.push(`Storage deletion error for cut ${cut.id}: ${err.message}`);
          });
          
          // Count as deleted and add to bytes freed
          stats.filesDeleted++;
          stats.bytesFreed += cut.cutSize || 0;
        }

        // Delete the database record
        await db.cut.delete({
          where: {
            id: cut.id
          }
        });
        stats.recordsDeleted++;
      } catch (error) {
        stats.errors.push(`Error processing cut ${cut.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return stats;
  } catch (error) {
    stats.errors.push(`General cleanup error: ${error instanceof Error ? error.message : String(error)}`);
    return stats;
  }
}