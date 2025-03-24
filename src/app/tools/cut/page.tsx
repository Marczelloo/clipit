"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useToast } from "~/hooks/use-toast";

import { VideoUploader } from "~/components/video-uploader";
import { VideoCutter } from "~/components/video-cutter";
import { CutActions } from "~/components/cut-actions";
import { RecentItems } from "~/components/recent-items";

interface CutResponse {
  success: boolean;
  fileUrl?: string;
  error?: string;
  anonymousId?: string;
}

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
  const [cutUrl, setCutUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();

  // Format time as MM:SS
  const formatTime = useCallback((seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const generateThumbnails = useCallback(async () => {
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

    try 
    {
      console.log("Starting thumbnail generation");
      // Save original time to restore later
      const originalTime = video.currentTime;
      
      for (let i = 0; i < thumbnailCount; i++) 
      {
        const timePoint = (duration / thumbnailCount) * i;
        console.log(`Generating thumbnail at time: ${timePoint}`);
        video.currentTime = timePoint;
        
        // Wait for the video to seek to the specified time
        await new Promise<void>((resolve) => {
          const seekHandler = () => {
            if (context) 
            {
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
    } 
    catch (error) 
    {
      console.error("Error generating thumbnails:", error);
      // Create a basic fallback thumbnail if generation fails
      const fallbackThumbnails = Array(thumbnailCount).fill('').map((_, i) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 160;
        canvas.height = 90;

        if (ctx) 
        {
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
        variant: "destructive",
      });
    } 
    finally 
    {
      setIsGeneratingThumbnails(false);
    }
  }, [duration, formatTime, toast]);

  useEffect(() => {
    if (videoRef.current && duration > 0 && thumbnails.length === 0 && !isGeneratingThumbnails) 
    {
      console.log("Triggering thumbnail generation from useEffect");
      void generateThumbnails();
    }
  }, [duration, thumbnails.length, isGeneratingThumbnails, generateThumbnails]);

  // Combined precise time tracking and end time checking
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    let animationFrameId: number;
    
    const updateTimeAndCheckBounds = () => {
      if (video) 
      {
        // Update current time for playhead
        setCurrentTime(video.currentTime);
        
        // Check if we've reached end time with high precision
        if (isPlaying && video.currentTime >= endTime - 0.02) 
        {
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

  // Handle when a video is selected from the uploader
  const handleVideoSelected = (file: File, url: string) => {
    setVideo(file);
    setVideoUrl(url);
    // Reset thumbnails when new video is uploaded
    setThumbnails([]);
    setCutUrl(null);
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const videoDuration = videoRef.current.duration;
      setDuration(videoDuration);
      setEndTime(videoDuration);
      // Generate thumbnails when video is loaded
      void generateThumbnails();
    }
  };  

  const handleCut = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!video || isProcessing) return;

    setIsProcessing(true);
    console.debug("Starting cut process");

    try 
    {
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

        const result = await response.json() as CutResponse;
        if (result.success) 
        {
            console.debug("Cut successful, setting URL:", result.fileUrl);
            setCutUrl(result.fileUrl ?? null);

            // For anonymous users, store the ID in localStorage
            if (result.anonymousId) 
            {
              const anonymousIds = JSON.parse(localStorage.getItem("anonymousCuts") ?? "[]") as string[];
              if (!anonymousIds.includes(result.anonymousId)) 
              {
                anonymousIds.push(result.anonymousId);
                localStorage.setItem("anonymousCuts", JSON.stringify(anonymousIds));
              }
            }

            toast({
                title: "Video cut successfully",
                description: `Cut from ${formatTime(startTime)} to ${formatTime(endTime)}`,
            });
        } 
        else 
        {
            throw new Error(result.error ?? "Video cutting failed");
        }
    } 
    catch (error) 
    {
        console.error("Video cutting error: ", error);
        toast({
            title: "Video cutting failed",
            description: "An error occurred while cutting your video.",
            variant: "destructive",
        });
    } 
    finally 
    {
        setIsProcessing(false);
    }
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
        <VideoUploader onVideoSelected={handleVideoSelected} />
      ) : (
        <div className="space-y-8">
          <VideoCutter
            videoRef={videoRef}
            videoUrl={videoUrl}
            startTime={startTime}
            endTime={endTime}
            duration={duration}
            currentTime={currentTime}
            thumbnails={thumbnails}
            isGeneratingThumbnails={isGeneratingThumbnails}
            isPlaying={isPlaying}
            setStartTime={setStartTime}
            setEndTime={setEndTime}
            setCurrentTime={setCurrentTime}
            setIsPlaying={setIsPlaying}
            onVideoLoaded={handleLoadedMetadata}
          />
          
          <CutActions
            isProcessing={isProcessing}
            cutUrl={cutUrl}
            onCut={handleCut}
            fileName={video?.name}
          />
        </div>
      )}
      
      <div className="mt-12 mb-6">
        <RecentItems type="cut" />
      </div>
    </main>
  );
}