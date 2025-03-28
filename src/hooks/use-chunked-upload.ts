// src/hooks/use-chunked-upload.ts
import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

// Default chunk size: 2MB (adjust based on your needs)
const DEFAULT_CHUNK_SIZE = 2 * 1024 * 1024; // 2MB

interface ChunkedUploadOptions {
  chunkSize?: number; // Size of each chunk in bytes
  onProgress?: (progress: number) => void;
  onError?: (error: Error) => void;
  onComplete?: (result: ChunkedUploadResult) => void;
}

interface ChunkedUploadResult {
  fileId: string;
  fileName: string;
  fileType: string;
  serverId: string;
  uploadType?: string;
}

export function useChunkedUpload(options: ChunkedUploadOptions = {}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  
  const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE;
  
  const uploadFile = useCallback(async (
    file: File, 
    serverId: string,
    uploadType: string = 'clip'
  ) => {
    if (!file) return;
    
    setUploading(true);
    setProgress(0);
    setError(null);
    
    try {
      // Generate a unique file ID for this upload session
      const fileId = uuidv4();
      
      // Calculate number of chunks
      const totalChunks = Math.ceil(file.size / chunkSize);
      let uploadedChunks = 0;
      
      // Upload each chunk
      for (let index = 0; index < totalChunks; index++) {
        // Prepare the chunk
        const start = index * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        
        // Create form data for this chunk
        const formData = new FormData();
        formData.append("chunk", chunk);
        formData.append("index", index.toString());
        formData.append("totalChunks", totalChunks.toString());
        formData.append("fileId", fileId);
        formData.append("fileName", file.name);
        formData.append("fileType", file.type);
        formData.append("serverId", serverId);
        formData.append("uploadType", uploadType);
        
        // Upload chunk
        const response = await fetch('/api/clips/chunk-upload', {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to upload chunk');
        }
        
        // Update progress
        uploadedChunks++;
        const currentProgress = Math.floor((uploadedChunks / totalChunks) * 100);
        setProgress(currentProgress);
        
        if (options.onProgress) {
          options.onProgress(currentProgress);
        }
      }
      
      // All chunks uploaded successfully
      const result = {
        fileId,
        fileName: file.name,
        fileType: file.type,
        serverId,
        uploadType
      };
      
      if (options.onComplete) {
        options.onComplete(result);
      }
      
      return result;
    } catch (err) {
      console.error('Error during chunked upload:', err);
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      
      if (options.onError) {
        options.onError(error);
      }
      
      throw error;
    } finally {
      setUploading(false);
    }
  }, [chunkSize, options]);
  
  const finalizeUpload = useCallback(async (
    fileData: ChunkedUploadResult,
    title: string,
    description?: string
  ) => {
    try {
      const response = await fetch('/api/clips/finalize-chunks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...fileData,
          title,
          description
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to finalize upload');
      }
      
      return await response.json();
    } catch (err) {
      console.error('Error finalizing upload:', err);
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      
      if (options.onError) {
        options.onError(error);
      }
      
      throw error;
    }
  }, [options]);
  
  return {
    uploadFile,
    finalizeUpload,
    uploading,
    progress,
    error
  };
}