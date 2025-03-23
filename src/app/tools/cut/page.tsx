"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { ScissorsLineDashed, ArrowLeft, Upload, Play, Pause, Download, Clock} from "lucide-react";
import { useToast } from "~/hooks/use-toast";
import { formatBytes } from "~/lib/utils";
import { useSession } from "next-auth/react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";

export default function CutPage() {
  const [video, setVideo] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [isGeneratingThumbnails, setIsGeneratingThumbnails] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [cutUrl, setCutUrl] = useState<string | null>(null);
  const [recentCuts, setRecentCuts] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const { data: session } = useSession();

  // Update current time for playhead position
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    let animationFrameId: number;
    
    const updateTimeSmooth = () => {
      if (video) {
        setCurrentTime(video.currentTime);
      }
      animationFrameId = requestAnimationFrame(updateTimeSmooth);
    };
    
    // Start the animation frame loop
    animationFrameId = requestAnimationFrame(updateTimeSmooth);
    
    // Also listen for seeking events to update time during scrubbing
    const handleSeeking = () => {
      setCurrentTime(video.currentTime);
    };
    
    video.addEventListener('seeking', handleSeeking);
    
    // Clean up
    return () => {
      cancelAnimationFrame(animationFrameId);
      video.removeEventListener('seeking', handleSeeking);
    };
  }, [videoUrl]);

  useEffect(() => {
    if (videoRef.current && duration > 0 && thumbnails.length === 0 && !isGeneratingThumbnails) {
      console.log("Triggering thumbnail generation from useEffect");
      generateThumbnails();
    }
  }, [duration, thumbnails.length, isGeneratingThumbnails]);

  useEffect(() => {
    if (!videoRef.current) return;
    
    // Only auto-preview if the selection has been manually changed
    // This prevents auto-playing when the video first loads
    if (startTime > 0 || endTime < duration) {
      previewSelection();
    }
  }, [startTime, endTime]);

  // Combined precise time tracking and end time checking
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    let animationFrameId: number;
    
    const updateTimeAndCheckBounds = () => {
      if (video) {
        // Update current time for playhead
        setCurrentTime(video.currentTime);
        
        // Check if we've reached end time with high precision
        if (isPlaying && video.currentTime >= endTime - 0.02) {
          video.pause();
          video.currentTime = endTime; // Ensure exact position
          setIsPlaying(false);
        }
      }
      animationFrameId = requestAnimationFrame(updateTimeAndCheckBounds);
    };
    
    // Start the animation frame loop
    animationFrameId = requestAnimationFrame(updateTimeAndCheckBounds);
    
    // Also listen for seeking events to update time during scrubbing
    const handleSeeking = () => {
      setCurrentTime(video.currentTime);
    };
    
    video.addEventListener('seeking', handleSeeking);
    
    // Clean up
    return () => {
      cancelAnimationFrame(animationFrameId);
      video.removeEventListener('seeking', handleSeeking);
    };
  }, [videoUrl, endTime, isPlaying]);

  useEffect(() => {
    const fetchCutHistory = async () => {
      setLoadingHistory(true);
      try {
        if (session?.user) {
          // For logged-in users
          const res = await fetch('/api/cut/user-history');
          const data = await res.json();
          setRecentCuts(data.cuts);
        } else {
          // For anonymous users
          const anonymousIds = JSON.parse(localStorage.getItem("anonymousCuts") || "[]");
          if (anonymousIds.length > 0) {
            const res = await fetch(`/api/cut/anonymous-history?ids=${anonymousIds.join(",")}`);
            const data = await res.json();
            setRecentCuts(data.cuts);
          }
        }
      } catch (error) {
        console.error("Failed to fetch cut history:", error);
      } finally {
        setLoadingHistory(false);
      }
    };
  
    void fetchCutHistory();
  }, [session?.user?.id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.includes("video")) {
      setVideo(file);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      // Reset thumbnails when new video is uploaded
      setThumbnails([]);
    } else {
      toast({
        title: "Invalid file",
        description: "Please upload a valid video file.",
        variant: "destructive",
      });
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const videoDuration = videoRef.current.duration;
      setDuration(videoDuration);
      setEndTime(videoDuration);
      // Generate thumbnails when video is loaded
      generateThumbnails();
    }
  };

  // Replace the current generateThumbnails function with this improved version
const generateThumbnails = async () => {
  if (!videoRef.current || duration === 0) return;

  setIsGeneratingThumbnails(true);
  const video = videoRef.current;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const thumbnailCount = 10; // Number of thumbnails to generate
  const newThumbnails: string[] = [];

  // Make thumbnails larger for better visibility
  canvas.width = 160;
  canvas.height = 90;

  try {
    console.log("Starting thumbnail generation");
    // Save original time to restore later
    const originalTime = video.currentTime;
    
    for (let i = 0; i < thumbnailCount; i++) {
      const timePoint = (duration / thumbnailCount) * i;
      console.log(`Generating thumbnail at time: ${timePoint}`);
      video.currentTime = timePoint;
      
      // Wait for the video to seek to the specified time
      await new Promise<void>((resolve) => {
        const seekHandler = () => {
          if (context) {
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const thumbnail = canvas.toDataURL('image/jpeg', 0.8); // Better quality
            newThumbnails.push(thumbnail);
            console.log(`Thumbnail ${i+1}/${thumbnailCount} generated`);
          }
          video.removeEventListener('seeked', seekHandler);
          resolve();
        };
        
        video.addEventListener('seeked', seekHandler);
      });
    }
    
    console.log(`Generated ${newThumbnails.length} thumbnails`);
    setThumbnails(newThumbnails);
    
    // Restore original position
    video.currentTime = originalTime;
  } catch (error) {
    console.error("Error generating thumbnails:", error);
    // Create a basic fallback thumbnail if generation fails
    const fallbackThumbnails = Array(thumbnailCount).fill('').map((_, i) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 160;
      canvas.height = 90;
      if (ctx) {
        // Create a gradient background as fallback
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
        gradient.addColorStop(0, '#ccc');
        gradient.addColorStop(1, '#999');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add time text
        const timePoint = (duration / thumbnailCount) * i;
        ctx.fillStyle = '#000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(formatTime(timePoint), canvas.width/2, canvas.height/2);
      }
      return canvas.toDataURL();
    });
    
      setThumbnails(fallbackThumbnails);
      toast({
        title: "Using basic thumbnails",
        description: "Could not generate video thumbnails, using simplified view instead.",
        variant: "warning",
      });
    } finally {
      setIsGeneratingThumbnails(false);
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCut = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!video || isProcessing) return;

    setIsProcessing(true);
    console.debug("Starting cut process");

    try {
        const formData = new FormData();
        formData.append("file", video);
        formData.append("startTime", startTime.toString());
        formData.append("endTime", endTime.toString());
        formData.append("duration", duration.toString());

        const response = await fetch("/api/cut", {
            method: "POST",
            body: formData,
        });

        if (!response.ok) throw new Error(`Video cutting failed: ${response.status}`);

        const result = await response.json();
        if (result.success) {
            console.debug("Cut successful, setting URL:", result.fileUrl);
            setCutUrl(result.fileUrl);

            toast({
                title: "Video cut successfully",
                description: `Cut from ${formatTime(startTime)} to ${formatTime(endTime)}`,
            });
        } else {
            throw new Error(result.error || "Video cutting failed");
        }
    } catch (error) {
        console.error("Video cutting error: ", error);
        toast({
            title: "Video cutting failed",
            description: "An error occurred while cutting your video.",
            variant: "destructive",
        });
    } finally {
        setIsProcessing(false);
    }
  };

  const updateVideoPosition = (clientX: number) => {
    if (!timelineRef.current || !videoRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const position = (clientX - rect.left) / rect.width;
    const newTime = position * duration;
    
    if (newTime >= 0 && newTime <= duration) {
      videoRef.current.currentTime = newTime;
    }
  };

  const togglePlayPause = () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      previewSelection();
    }
    
    setIsPlaying(!isPlaying);
  };
  
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
    <main className="container max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-8">
        <Link href="/tools">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Cut Video</h1>
      </div>

      {!videoUrl ? (
        <div className="rounded-lg border-2 border-dashed border-border p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <ScissorsLineDashed className="h-12 w-12 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Upload a video to get started</h2>
            <p className="text-muted-foreground max-w-md">
              Upload your video file to cut it. Supported formats: MP4, WebM, MOV.
            </p>
            <label htmlFor="video-upload">
              <div className="bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer px-4 py-2 rounded-md flex items-center gap-2">
                <Upload className="h-4 w-4" /> Select Video
              </div>
              <Input
                id="video-upload"
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="rounded-lg overflow-hidden bg-card border relative">
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-auto"
              controls={false} // Remove built-in controls
              onLoadedMetadata={handleLoadedMetadata}
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

            <div className="flex justify-end gap-4 mt-6">
              <Button
                onClick={handleCut}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>Processing...</>
                ) : (
                  <>
                    <ScissorsLineDashed className="h-4 w-4 mr-2" /> Cut Video
                  </>
                )}
              </Button>
              <Button 
                variant="secondary" 
                disabled={!cutUrl}
                onClick={() => {
                  if (!cutUrl) return;
                  
                  // Create an anchor element to force download
                  const a = document.createElement('a');
                  a.href = cutUrl;
                  a.download = `cut_${video?.name || 'video'}`; // Set filename
                  document.body.appendChild(a);
                  a.click(); // Trigger download
                  document.body.removeChild(a); // Clean up
                }}
              >
                <Download className="h-4 w-4 mr-2" /> Download
              </Button>
            </div>
          </div>
        </div>
      )}

    <div className="mt-12 mb-6">
      <Accordion type="single" collapsible defaultValue="cuts">
        <AccordionItem value="cuts">
          <AccordionTrigger className="text-lg font-semibold">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Cuts
              {recentCuts.length > 0 && (
                <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs">
                  {recentCuts.length}
                </span>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent>
            {loadingHistory ? (
              <div className="text-center py-4 text-muted-foreground">Loading recent cuts...</div>
            ) : recentCuts.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <ScissorsLineDashed className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>No recent cuts found.</p>
              </div>
            ) : (
              <div className="space-y-1 py-2">
                {recentCuts.map((cut) => {
                  // Calculate time remaining
                  const now = new Date();
                  const expiresAt = new Date(cut.expiresAt);
                  const hoursRemaining = Math.max(0, Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)));
                  
                  return (
                    <div 
                      key={cut.id} 
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/30 transition-colors"
                    >
                      <div className="flex-grow">
                        <div className="font-medium truncate max-w-md" title={cut.originalName}>
                          {cut.originalName}
                        </div>
                        <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                          <span className="inline-flex items-center">
                            {formatTime(cut.startTime)} - {formatTime(cut.endTime)}
                          </span>
                          <span className="inline-flex items-center">
                            Size: {formatBytes(cut.cutSize)}
                          </span>
                          {hoursRemaining > 0 && (
                            <span className="inline-flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {hoursRemaining} hours left
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center">
                          <a 
                            href={`/api/files/${cut.filePath}`} 
                            download={`${cut.originalName.split('.')[0]}_cut.${cut.filePath.split('.').pop()}`}
                            onClick={(e) => {
                              // Check if file exists first to avoid downloading error JSON
                              fetch(`/api/files/${cut.filePath}`, { method: 'HEAD' })
                                .then(response => {
                                  if (!response.ok) {
                                    e.preventDefault();
                                    toast({
                                      title: "File unavailable",
                                      description: "This file is no longer available on the server.",
                                      variant: "destructive",
                                    });
                                  }
                                })
                                .catch(() => {
                                  e.preventDefault();
                                  toast({
                                    title: "Download error",
                                    description: "Could not verify file availability.",
                                    variant: "destructive",
                                  });
                                });
                            }}
                          >
                          <Button size="sm" variant="ghost">
                            <Download className="h-4 w-4" />
                          </Button>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
    </main>
  );
}