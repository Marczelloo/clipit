"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useToast } from "~/hooks/use-toast";
import { formatBytes } from "~/lib/utils";
import { v4 as uuidv4 } from "uuid";
import { useChunkedUpload } from "~/hooks/use-chunked-upload";

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

  // Initialize chunked upload hook
  const { uploadFile, progress: uploadProgress } = useChunkedUpload({
    onProgress: (p) => setProgress(Math.floor(p / 2)), // First half of the progress is upload
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

  useEffect(() => {
    if (video) {
      setOriginalSize(video.size);

      // Set a default target size of 70% of original
      const defaultTarget = Math.round(video.size * 0.7);
      setTargetSize(defaultTarget);
    }
  }, [video]);

  // Calculate estimated quality based on target size
  useEffect(() => {
    if (originalSize && targetSize) {
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
    if ("requestVideoFrameCallback" in videoElement) {
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
        if (elapsedTime < 1000) {
          // Continue counting frames
          rafId = videoElement.requestVideoFrameCallback(countFrames);
        } else {
          // Calculate FPS and clean up
          const measuredFps = Math.round((frameCount / elapsedTime) * 1000);
          setOriginalFps(measuredFps);
          if (rafId !== null) videoElement.cancelVideoFrameCallback(rafId);
        }
      };

      // Start playback to measure (we'll mute it to be less intrusive)
      videoElement.muted = true;
      videoElement
        .play()
        .then(() => {
          // Start counting frames
          rafId = videoElement.requestVideoFrameCallback(countFrames);
        })
        .catch((err) => {
          // Fallback if autoplay fails due to browser policies
          console.error("Could not autoplay for FPS detection:", err);
          setOriginalFps(30); // Fallback to default
        });
    } else {
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
    if (!video) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      // Step 1: Generate a process ID for this compression
      const processId = uuidv4();

      // Step 2: Upload the file in chunks - specify "compress" as upload type
      const uploadResult = await uploadFile(video, `compress-${processId}`, "compress");

      if (!uploadResult) {
        throw new Error("Failed to upload file");
      }

      // Step 3: Send settings to process the uploaded chunks
      const response = await fetch("/api/compress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileId: uploadResult.fileId,
          fileName: uploadResult.fileName,
          fileType: uploadResult.fileType,
          quality: quality.toString(),
          format: format,
          resolution: resolution,
          fps: fps,
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
        const errorText = await response.text();
        throw new Error(`Compression failed: ${errorText}`);
      }

      const result = await response.json() as CompressionResponse;
      clearInterval(processingInterval);

      // Set to 100% when done
      setProgress(100);

      if (result.success) {
        setCompressedUrl(result.fileUrl ?? null);

        // For anonymous users, store the ID in localStorage
        if (result.anonymousId) {
          const anonymousIds = JSON.parse(localStorage.getItem("anonymousCompressions") ?? "[]") as string[];
          if (!anonymousIds.includes(result.anonymousId)) {
            anonymousIds.push(result.anonymousId);
            localStorage.setItem("anonymousCompressions", JSON.stringify(anonymousIds));
          }
        }

        toast({
          title: "Video compressed successfully",
          description: `Reduced by ${result.compressionRatio ?? 0}% (${formatBytes(result.originalSize ?? 0)} → ${formatBytes(result.compressedSize ?? 0)})`,
        });
      } else {
        throw new Error(result.error ?? "Compression failed");
      }
    } catch (error) {
      console.error("Compression error: ", error);

      toast({
        title: "Compression failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
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