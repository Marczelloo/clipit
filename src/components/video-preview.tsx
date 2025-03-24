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
      // Store a reference to the current value
      const video = videoRef.current;
      
      const handleLoad = () => {
        onVideoLoad(video);
      };
      
      video.addEventListener('loadedmetadata', handleLoad);
      
      return () => {
        video.removeEventListener('loadedmetadata', handleLoad);
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