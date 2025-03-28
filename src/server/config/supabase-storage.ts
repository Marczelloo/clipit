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
 * Ensures the URL is correctly formatted with proper domain and path structure
 */
export function getPublicUrl(bucket: string, path: string) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  
  // Ensure the URL is properly formatted by validating it
  try 
  {
    new URL(data.publicUrl);
    console.log(`Generated URL for ${bucket}/${path}: ${data.publicUrl}`);
    return data.publicUrl;
  } 
  catch (e) 
  {
    // If URL parsing fails, construct it manually using the Supabase URL
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    const manualUrl = `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
    console.log(`Fallback URL for ${bucket}/${path}: ${manualUrl}`);
    return manualUrl;
  }
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
  console.log(`Downloading file from ${bucket}/${path}`);
  
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(path);

    if (error) {
      console.error(`Error downloading file from ${bucket}/${path}:`, error);
      throw error;
    }

    if (!data) {
      console.error(`No data returned when downloading file from ${bucket}/${path}`);
      throw new Error('No data returned from Supabase');
    }

    console.log(`Successfully downloaded ${bucket}/${path}, size: ${data.size} bytes`);
    return data;
  } catch (e) {
    console.error(`Exception downloading file from ${bucket}/${path}:`, e);
    throw e;
  }
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

/**
 * List files in a Supabase Storage bucket with optional prefix
 */
export async function listFiles(bucket: string, path?: string) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(path || '');

  if (error) {
    console.error("Error listing files:", error);
    throw error;
  }

  return data || [];
}

export { STORAGE_BUCKETS };