"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useToast } from "~/hooks/use-toast";
import { v4 as uuidv4 } from "uuid";
import { useChunkedUpload } from "~/hooks/use-chunked-upload";

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
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();
  
  // Handle video selection
  const handleVideoSelected = (file: File, url: string) => {
    setVideo(file);
    setVideoUrl(url);
  };

  // Initialize chunked upload hook
  const { uploadFile, progress: uploadProgress } = useChunkedUpload({
    onProgress: (p) => setProgress(Math.floor(p / 2)), // First half of progress is upload
    onError: (error) => {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload video file",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  });

  // Format time as MM:SS
  const formatTime = useCallback((seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const generateThumbnails = useCallback(async () => {
    if (!videoRef.current || !videoRef.current.duration) {
      console.log("Cannot generate thumbnails: video not ready or duration is 0");
      return;
    }

    const videoDuration = videoRef.current.duration;
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
        const timePoint = (videoDuration / thumbnailCount) * i;
        console.log(`Generating thumbnail at time: ${timePoint}`);
        video.currentTime = timePoint;

        // Wait for the video to seek to the specified time
        await new Promise<void>((resolve) => {
          const seekHandler = () => {
            if (context) {
              context.drawImage(video, 0, 0, canvas.width, canvas.height);
              const thumbnail = canvas.toDataURL('image/jpeg', 0.8); // Better quality
              newThumbnails.push(thumbnail);
              console.log(`Thumbnail ${i + 1}/${thumbnailCount} generated`);
            }

            video.removeEventListener('seeked', seekHandler);
            resolve();
          };

          video.addEventListener('seeked', seekHandler);
        });
      }

      console.log(`Generated ${newThumbnails.length} thumbnails`);
      setThumbnails(newThumbnails);

      // Restore original time
      video.currentTime = originalTime;
    } catch (error) {
      console.error("Error generating thumbnails:", error);
    } finally {
      setIsGeneratingThumbnails(false);
    }
  }, []);

  // Handler for video loaded metadata event
  const handleVideoLoaded = useCallback(async () => {
    if (!videoRef.current) return;
    
    const videoDuration = videoRef.current.duration;
    console.log(`Video loaded with duration: ${videoDuration}`);
    
    // Update state with video duration
    setDuration(videoDuration);
    setEndTime(videoDuration);
    
    // Now generate thumbnails
    await generateThumbnails();
  }, [generateThumbnails]);

  const handleCut = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!video || isProcessing) return;

    setIsProcessing(true);
    setProgress(0);
    console.debug("Starting cut process");

    try {
      // Step 1: Generate a process ID for this cut operation
      const processId = uuidv4();

      // Step 2: Upload the file in chunks - specify "cut" as upload type
      const uploadResult = await uploadFile(video, `cut-${processId}`, "cut");

      if (!uploadResult) {
        throw new Error("Failed to upload file");
      }

      // Step 3: Send settings to process the uploaded chunks
      const response = await fetch("/api/cut", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileId: uploadResult.fileId,
          fileName: uploadResult.fileName,
          fileType: uploadResult.fileType,
          startTime: startTime,
          endTime: endTime,
          duration: duration
        }),
      });

      // Track processing progress (starting at 50%)
      const processingProgress = () => {
        const interval = setInterval(() => {
          setProgress((prev) => {
            // Increment from 50% to 95% during server-side processing
            const newProgress = Math.min(95, prev + 1);
            if (newProgress === 95) clearInterval(interval);
            return newProgress;
          });
        }, 500);
        return interval;
      };

      const processingInterval = processingProgress();

      if (!response.ok) {
        clearInterval(processingInterval);
        throw new Error(`Video cutting failed: ${response.status}`);
      }

      const result = await response.json() as CutResponse;
      clearInterval(processingInterval);

      // Set to 100% when done
      setProgress(100);

      if (result.success) {
        console.debug("Cut successful, setting URL:", result.fileUrl);
        setCutUrl(result.fileUrl ?? null);

        // For anonymous users, store the ID in localStorage
        if (result.anonymousId) {
          const anonymousIds = JSON.parse(localStorage.getItem("anonymousCuts") ?? "[]") as string[];
          if (!anonymousIds.includes(result.anonymousId)) {
            anonymousIds.push(result.anonymousId);
            localStorage.setItem("anonymousCuts", JSON.stringify(anonymousIds));
          }
        }

        toast({
          title: "Video cut successfully",
          description: `Cut from ${formatTime(startTime)} to ${formatTime(endTime)}`,
        });
      } else {
        throw new Error(result.error ?? "Video cutting failed");
      }
    } catch (error) {
      console.error("Video cutting error: ", error);
      toast({
        title: "Video cutting failed",
        description: error instanceof Error ? error.message : "An error occurred while cutting your video.",
        variant: "destructive",
      });
    } finally {
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
            onVideoLoaded={handleVideoLoaded}
          />
          
          <CutActions
            isProcessing={isProcessing}
            cutUrl={cutUrl}
            onCut={handleCut}
            fileName={video?.name}
            progress={progress}
          />
        </div>
      )}
      
      <div className="mt-12 mb-6">
        <RecentItems type="cut" />
      </div>
    </main>
  );
}