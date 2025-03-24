"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useToast } from "~/hooks/use-toast";
import { formatBytes } from "~/lib/utils";

import { VideoUploader } from "~/components/video-uploader";
import { VideoPreview } from "~/components/video-preview";
import { CompressionSettings } from "~/components/compression-settings";
import { ActionButtons } from "~/components/action-buttons";
import { RecentItems } from "~/components/recent-items";

interface CompressionResponse {
  success: boolean;
  fileUrl?: string;
  anonymousId?: string;
  compressionRatio?: number;
  originalSize?: number;
  compressedSize?: number;
  error?: string;
}

interface VideoFrameMetadata {
  mediaTime: number;
  presentationTime: number;
  expectedDisplayTime: number;
  width: number;
  height: number;
}

export default function CompressPage() {
  const [video, setVideo] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [compressedUrl, setCompressedUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [compressionMode, setCompressionMode] = useState<"quality" | "size">("quality");
  const [quality, setQuality] = useState(75);
  const [format, setFormat] = useState("mp4");
  const [resolution, setResolution] = useState("720p");
  const [targetSize, setTargetSize] = useState<number | null>(null);
  const [fps, setFps] = useState("original");
  const [originalFps, setOriginalFps] = useState<number | null>(null);
  const [originalSize, setOriginalSize] = useState<number>(0);
  const [bitrateMultiplier, setBitrateMultiplier] = useState(1);
  const [progress, setProgress] = useState(0);
  
  const { toast } = useToast();

  useEffect(() => {
    if (video) 
    {
      setOriginalSize(video.size);
      
      // Set a default target size of 70% of original
      const defaultTarget = Math.round(video.size * 0.7);
      setTargetSize(defaultTarget);
    }
  }, [video]);

  // Calculate estimated quality based on target size
  useEffect(() => {
    if (originalSize && targetSize) 
    {
      // Simple estimation - in reality, compression is more complex
      const ratio = targetSize / originalSize;
      const estimatedQuality = Math.max(10, Math.min(100, Math.round(ratio * 100)));
      if (compressionMode === "size") setQuality(estimatedQuality);
    }
  }, [targetSize, originalSize, compressionMode]);

  // Handle when a video is selected from the uploader
  const handleVideoSelected = (file: File, url: string) => {
    setVideo(file);
    setVideoUrl(url);
  };

  // Handle video metadata loaded
  const handleVideoLoad = (videoElement: HTMLVideoElement) => {
    if ('requestVideoFrameCallback' in videoElement) 
    {
      // Frame counting variables
      let frameCount = 0;
      let startTime: number | null = null;
      let rafId: number | null = null;
      
      // Function to measure FPS
      const countFrames = (now: number, _metadata: VideoFrameMetadata) => {
        if (!startTime) startTime = now;
        frameCount++;
        
        const elapsedTime = now - startTime;
        
        // Measure for about 1 second to get a good sample
        if (elapsedTime < 1000) 
        {
          // Continue counting frames
          rafId = videoElement.requestVideoFrameCallback(countFrames);
        } 
        else 
        {
          // Calculate FPS and clean up
          const measuredFps = Math.round((frameCount / elapsedTime) * 1000);
          setOriginalFps(measuredFps);
          if (rafId !== null) videoElement.cancelVideoFrameCallback(rafId);
        }
      };
      
      // Start playback to measure (we'll mute it to be less intrusive)
      videoElement.muted = true;
      videoElement.play().then(() => {
        // Start counting frames
        rafId = videoElement.requestVideoFrameCallback(countFrames);
      }).catch(err => {
        // Fallback if autoplay fails due to browser policies
        console.error("Could not autoplay for FPS detection:", err);
        setOriginalFps(30); // Fallback to default
      });
    } 
    else 
    {
      // Fallback for browsers without requestVideoFrameCallback support
      console.log("requestVideoFrameCallback not supported in this browser");
      setOriginalFps(30);
    }
  };

  const handleTargetSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value > 0) {
      setTargetSize(value * 1024 * 1024); // Convert MB to bytes
    }
  };

  const handleReset = () => {
    setVideo(null);
    setVideoUrl(null);
    setCompressedUrl(null);
  };

  const handleCompress = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isProcessing) return;
    if(!video) return;
  
    setIsProcessing(true);
    setProgress(0);
  
    try 
    {
      // Create a FormData object to send the file and settings
      const formData = new FormData();
      formData.append("file", video);
      formData.append("quality", quality.toString());
      formData.append("format", format);
      formData.append("resolution", resolution);
      formData.append("fps", fps);
  
      // Use AbortController to handle potential timeouts
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2-minute timeout
  
      const response = await fetch("/api/compress", {
        method: "POST",
        body: formData,
        signal: controller.signal,
        // Prevent the browser from automatically timing out
        headers: {
          'Connection': 'keep-alive',
        }
      });
      
      clearTimeout(timeoutId);
  
      if(!response.ok) 
      {
        const errorText = await response.text();
        throw new Error(`Compression failed: ${errorText}`);
      }
  
      const result = await response.json() as CompressionResponse;
  
      if(result.success) 
      {
        setCompressedUrl(result.fileUrl ?? null);
  
        // For anonymous users, store the ID in localStorage
        if (result.anonymousId) 
        {
          const anonymousIds = JSON.parse(localStorage.getItem("anonymousCompressions") ?? "[]") as string[];
          if (!anonymousIds.includes(result.anonymousId)) 
          {
            anonymousIds.push(result.anonymousId);
            localStorage.setItem("anonymousCompressions", JSON.stringify(anonymousIds));
          }
        }
  
        toast({
          title: "Video compressed successfully",
          description: `Reduced by ${result.compressionRatio ?? 0}% (${formatBytes(result.originalSize ?? 0)} → ${formatBytes(result.compressedSize ?? 0)})`,
        });
      } 
      else 
      {
        throw new Error(result.error ?? "Compression failed");
      }
    } 
    catch(error) 
    {
      console.error("Compression error: ", error);
      
      // Only show toast if it's not an abort error (which would happen if the user navigated away)
      if (!(error instanceof DOMException && error.name === 'AbortError')) 
      {
        toast({
          title: "Compression feedback error",
          description: "The video was processed, but we couldn't get the results. Please check your library.",
          variant: "destructive",
        });
      }
    } 
    finally 
    {
      setIsProcessing(false);
      setProgress(100);
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
        <h1 className="text-3xl font-bold">Compress Video</h1>
      </div>

      {!videoUrl ? (
        <VideoUploader onVideoSelected={handleVideoSelected} />
      ) : (
        <div className="space-y-8">
          <VideoPreview 
            videoUrl={videoUrl} 
            onVideoLoad={handleVideoLoad}
            isProcessing={isProcessing}
            progress={progress}
          />
          
          <CompressionSettings 
            compressionMode={compressionMode}
            setCompressionMode={setCompressionMode}
            quality={quality}
            setQuality={setQuality}
            format={format}
            setFormat={setFormat}
            resolution={resolution}
            setResolution={setResolution}
            fps={fps}
            setFps={setFps}
            bitrateMultiplier={bitrateMultiplier}
            setBitrateMultiplier={setBitrateMultiplier}
            originalSize={originalSize}
            originalFps={originalFps}
            targetSize={targetSize}
            handleTargetSizeChange={handleTargetSizeChange}
          />

          <ActionButtons 
            isProcessing={isProcessing}
            compressedUrl={compressedUrl}
            onReset={handleReset}
            onCompress={handleCompress}
            fileName={video?.name}
          />
        </div>
      )}
      
      <div className="mt-12 mb-6">
        <RecentItems type="compression" />
      </div>
    </main>
  );
}