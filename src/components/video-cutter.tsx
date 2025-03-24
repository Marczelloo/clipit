"use client";

import { useRef } from "react";
import { Button } from "~/components/ui/button";
import { Play, Pause } from "lucide-react";

interface VideoCutterProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  videoUrl: string;
  startTime: number;
  endTime: number;
  duration: number;
  currentTime: number;
  thumbnails: string[];
  isGeneratingThumbnails: boolean;
  isPlaying: boolean;
  setStartTime: (time: number) => void;
  setEndTime: (time: number) => void;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  onVideoLoaded: () => void;
}

export function VideoCutter({
  videoRef,
  videoUrl,
  startTime,
  endTime,
  duration,
  currentTime,
  thumbnails,
  isGeneratingThumbnails,
  isPlaying,
  setStartTime,
  setEndTime,
  setIsPlaying,
  onVideoLoaded
}: VideoCutterProps) {
  const timelineRef = useRef<HTMLDivElement>(null);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Update video position when clicking on timeline
  const updateVideoPosition = (clientX: number) => {
    if (!timelineRef.current || !videoRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const position = (clientX - rect.left) / rect.width;
    const newTime = position * duration;
    
    if (newTime >= 0 && newTime <= duration) {
      videoRef.current.currentTime = newTime;
    }
  };

  // Toggle play/pause
  const togglePlayPause = () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      previewSelection();
    }
    
    setIsPlaying(!isPlaying);
  };
  
  // Preview the current selection
  const previewSelection = () => {
    if (!videoRef.current) return;
    
    videoRef.current.currentTime = startTime;
    videoRef.current.play()
      .then(() => setIsPlaying(true))
      .catch(error => {
        console.error("Error playing video:", error);
        setIsPlaying(false);
      });
  };

  return (
    <div className="space-y-8">
      <div className="rounded-lg overflow-hidden bg-card border relative">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-auto"
          controls={false}
          onLoadedMetadata={onVideoLoaded}
        />
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4">
          <Button 
            variant="secondary" 
            className="rounded-full" 
            size="icon"
            onClick={togglePlayPause}
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>
        </div>
      </div>
      
      <div className="space-y-4 p-4 border rounded-lg bg-card">
        <h2 className="text-xl font-semibold">Cut Settings</h2>
        
        {/* Video Timeline with Thumbnails */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>00:00</span>
            <span>{formatTime(duration)}</span>
          </div>
          
          <div className="relative">
            {/* Timeline Track */}
            <div 
              ref={timelineRef}
              className="h-16 bg-muted rounded-md overflow-hidden cursor-pointer relative"
              onClick={(e) => updateVideoPosition(e.clientX)}
            >
              {/* Thumbnails */}
              {thumbnails.length > 0 ? (
                <div className="absolute inset-0 flex">
                  {thumbnails.map((thumb, index) => (
                    <div 
                      key={index} 
                      className="h-full flex-grow border-r border-gray-400/20"
                      style={{ 
                        backgroundImage: `url(${thumb})`, 
                        backgroundSize: 'cover', 
                        backgroundPosition: 'center',
                        minWidth: '50px'
                      }}
                    />
                  ))}
                </div>
              ) : isGeneratingThumbnails ? (
                <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
                  <p className="text-xs font-medium">Generating thumbnails...</p>
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
                  <p className="text-xs">No thumbnails available</p>
                </div>
              )}
              
              {/* Darken cut parts */}
              <div 
                className="absolute top-0 bottom-0 left-0 bg-black/80 pointer-events-none"
                style={{ width: `${(startTime / duration) * 100}%` }}
              />
              <div 
                className="absolute top-0 bottom-0 right-0 bg-black/80 pointer-events-none"
                style={{ width: `${((duration - endTime) / duration) * 100}%` }}
              />
              
              {/* Selection handles - Start handle */}
              <div className="absolute top-0 bottom-0 flex items-center justify-center cursor-ew-resize z-10"
                style={{ 
                  left: `calc(${(startTime / duration) * 100}% - 8px)`,
                  width: '16px' 
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  const handleDrag = (moveEvent: MouseEvent) => {
                    if (!timelineRef.current) return;
                    const rect = timelineRef.current.getBoundingClientRect();
                    const position = (moveEvent.clientX - rect.left) / rect.width;
                    const newStartTime = position * duration;
                    
                    if (newStartTime >= 0 && newStartTime < endTime) {
                      setStartTime(newStartTime);
                      if (videoRef.current) {
                        videoRef.current.currentTime = newStartTime;
                      }
                    }
                  };
                  
                  const handleMouseUp = () => {
                    document.removeEventListener('mousemove', handleDrag);
                    document.removeEventListener('mouseup', handleMouseUp);
                  };
                  
                  document.addEventListener('mousemove', handleDrag);
                  document.addEventListener('mouseup', handleMouseUp);
                }}
              >
                <div className="h-full w-3 bg-primary rounded-sm relative">
                  {/* Visual indicator for draggable handle */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-1 h-8 bg-white rounded-full opacity-80"></div>
                  </div>
                </div>
              </div>

              {/* Selection handles - End handle */}
              <div className="absolute top-0 bottom-0 flex items-center justify-center cursor-ew-resize z-10"
                style={{ 
                  left: `calc(${(endTime / duration) * 100}% - 8px)`, 
                  width: '16px' 
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  const handleDrag = (moveEvent: MouseEvent) => {
                    if (!timelineRef.current) return;
                    const rect = timelineRef.current.getBoundingClientRect();
                    const position = (moveEvent.clientX - rect.left) / rect.width;
                    const newEndTime = position * duration;
                    
                    if (newEndTime <= duration && newEndTime > startTime) {
                      setEndTime(newEndTime);
                      if (videoRef.current) {
                        videoRef.current.currentTime = newEndTime;
                      }
                    }
                  };
                  
                  const handleMouseUp = () => {
                    document.removeEventListener('mousemove', handleDrag);
                    document.removeEventListener('mouseup', handleMouseUp);
                  };
                  
                  document.addEventListener('mousemove', handleDrag);
                  document.addEventListener('mouseup', handleMouseUp);
                }}
              >
                <div className="h-full w-3 bg-primary rounded-sm relative">
                  {/* Visual indicator for draggable handle */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-1 h-8 bg-white rounded-full opacity-80"></div>
                  </div>
                </div>
              </div>
              
              {/* Playhead */}
              <div 
                className="absolute top-0 h-full w-0.5 bg-red-500 pointer-events-none"
                style={{ 
                  left: `${(currentTime / duration) * 100}%`,
                  display: duration > 0 ? 'block' : 'none'
                }}
              />
            </div>
          </div>
          
          {/* Time indicator */}
          <div className="flex justify-between mt-2">
            <span className="text-sm font-medium">Start: {formatTime(startTime)}</span>
            <span className="text-sm font-medium">End: {formatTime(endTime)}</span>
          </div>
          
          {/* Duration indicator */}
          <div className="text-center text-sm text-muted-foreground">
            Selected duration: {formatTime(endTime - startTime)}
          </div>
        </div>
      </div>
    </div>
  );
}