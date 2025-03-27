import { createClient } from '@supabase/supabase-js';
import { env } from '~/env';

// Create a single supabase client for the lifecycle of the application
export const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

// Storage buckets that mirror your local folders
const STORAGE_BUCKETS = {
  CLIPS: 'clips',
  COMPRESSED: 'compressed',
  CUTS: 'cuts',
  THUMBNAILS: 'thumbnails',
  TEMP: 'temp',
};

/**
 * Upload a file to a specific bucket in Supabase Storage
 */
export async function uploadFile(bucket: string, path: string, file: Buffer | File | Blob, contentType?: string) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Get a public URL for a file in Supabase Storage
 */
export function getPublicUrl(bucket: string, path: string) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Extract the storage path from a Supabase URL
 * This is useful when you have a public URL and need to get the path for deletion
 */
export function getStoragePathFromUrl(url: string): string | null {
  try {
    // Parse the URL
    const urlObj = new URL(url);
    
    // Get the pathname
    const pathname = urlObj.pathname;
    
    // The path format is typically /storage/v1/object/public/[bucket]/[path]
    const parts = pathname.split('/');
    
    // Find the index of "public" which comes before the bucket name
    const publicIndex = parts.findIndex(part => part === 'public');
    
    if (publicIndex === -1 || publicIndex + 2 >= parts.length) {
      return null;
    }
    
    // Extract everything after the bucket name
    const storagePath = parts.slice(publicIndex + 2).join('/');
    
    return storagePath;
  } catch (error) {
    console.error("Error extracting storage path from URL:", error);
    return null;
  }
}

/**
 * Download a file from Supabase Storage
 */
export async function downloadFile(bucket: string, path: string) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .download(path);

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Delete a file from Supabase Storage
 */
export async function deleteFile(bucket: string, path: string) {
  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);

  if (error) {
    throw error;
  }

  return true;
}

/**
 * Copy a file between buckets or within the same bucket
 */
export async function copyFile(
  sourceBucket: string, 
  sourcePath: string,
  destinationBucket: string,
  destinationPath: string
) {
  // First download the file
  const fileData = await downloadFile(sourceBucket, sourcePath);
  
  // Then upload to destination
  await uploadFile(
    destinationBucket, 
    destinationPath, 
    fileData,
    fileData.type
  );
  
  return getPublicUrl(destinationBucket, destinationPath);
}

export { STORAGE_BUCKETS };