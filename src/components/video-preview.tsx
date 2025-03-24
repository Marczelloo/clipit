"use client";

import { useRef, useEffect } from 'react';

interface VideoPreviewProps {
  videoUrl: string;
  onVideoLoad?: (video: HTMLVideoElement) => void;
  isProcessing?: boolean;
  progress?: number;
}

export function VideoPreview({ 
  videoUrl, 
  onVideoLoad,
  isProcessing = false,
  progress = 0
}: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && onVideoLoad) {
      const handleLoad = () => {
        if (videoRef.current) {
          onVideoLoad(videoRef.current);
        }
      };
      
      videoRef.current.addEventListener('loadedmetadata', handleLoad);
      
      return () => {
        videoRef.current?.removeEventListener('loadedmetadata', handleLoad);
      };
    }
  }, [onVideoLoad]);

  return (
    <div className="space-y-2">
      <div className="rounded-lg overflow-hidden bg-card border">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-auto"
          controls
        />
      </div>
      {isProcessing && (
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}