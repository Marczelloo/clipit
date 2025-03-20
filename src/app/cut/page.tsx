"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Slider } from "~/components/ui/slider";
import { ScissorsLineDashed, ArrowLeft, Upload, Play, Download } from "lucide-react";
import { useToast } from "~/hooks/use-toast";

export default function CutPage() {
  const [video, setVideo] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.includes("video")) {
      setVideo(file);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
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
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCut = () => {
    setIsProcessing(true);
    
    // Simulate processing delay - this would be replaced with actual processing
    setTimeout(() => {
      setIsProcessing(false);
      toast({
        title: "Video cut successfully",
        description: "Your video has been processed and is ready to download.",
      });
    }, 2000);
  };

  return (
    <main className="container max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-8">
        <Link href="/">
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
          <div className="rounded-lg overflow-hidden bg-card border">
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-auto"
              controls
              onLoadedMetadata={handleLoadedMetadata}
            />
          </div>

          <div className="space-y-4 p-4 border rounded-lg bg-card">
            <h2 className="text-xl font-semibold">Cut Settings</h2>
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Start Time: {formatTime(startTime)}</span>
                  <span>End Time: {formatTime(endTime)}</span>
                </div>
                <Slider
                  min={0}
                  max={duration}
                  step={0.1}
                  value={[startTime, endTime]}
                  onValueChange={(values) => {
                    setStartTime(values[0]);
                    setEndTime(values[1]);
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Start Time</label>
                  <Input
                    type="text"
                    value={formatTime(startTime)}
                    onChange={(e) => {
                      const [min, sec] = e.target.value.split(':').map(Number);
                      if (!isNaN(min) && !isNaN(sec)) {
                        setStartTime(min * 60 + sec);
                      }
                    }}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">End Time</label>
                  <Input
                    type="text"
                    value={formatTime(endTime)}
                    onChange={(e) => {
                      const [min, sec] = e.target.value.split(':').map(Number);
                      if (!isNaN(min) && !isNaN(sec)) {
                        setEndTime(min * 60 + sec);
                      }
                    }}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (videoRef.current) {
                      videoRef.current.currentTime = startTime;
                      void videoRef.current.play();
                      setTimeout(() => {
                        if (videoRef.current) {
                          videoRef.current.pause();
                        }
                      }, (endTime - startTime) * 1000);
                    }
                  }}
                >
                  <Play className="h-4 w-4 mr-2" /> Preview
                </Button>
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
                <Button variant="secondary" disabled={!isProcessing}>
                  <Download className="h-4 w-4 mr-2" /> Download
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}