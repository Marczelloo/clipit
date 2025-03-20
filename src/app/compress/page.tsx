"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Slider } from "~/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import {
  FileArchive,
  ArrowLeft,
  Upload,
  Download,
  Settings,
  Gauge,
  FileDown,
  Zap,
  RotateCcw,
} from "lucide-react";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { useToast } from "~/hooks/use-toast";
import { formatBytes } from "~/lib/utils";

// Add this to your utils.ts file or inline it here
// export function formatBytes(bytes: number, decimals = 2): string {
//   if (bytes === 0) return '0 Bytes';
//   const k = 1024;
//   const sizes = ['Bytes', 'KB', 'MB', 'GB'];
//   const i = Math.floor(Math.log(bytes) / Math.log(k));
//   return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
// }

export default function CompressPage() {
  const [video, setVideo] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();

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
      if (compressionMode === "size") {
        setQuality(estimatedQuality);
      }
    }
  }, [targetSize, originalSize, compressionMode]);

  // Detect video FPS when loaded
  const handleVideoLoad = () => {
    if (videoRef.current) {
      // In a real implementation, you would use ffprobe or other tools
      // to detect the actual FPS. For now, we'll assume 30fps
      setOriginalFps(30);
    }
  };

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

  const handleTargetSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value > 0) {
      setTargetSize(value * 1024 * 1024); // Convert MB to bytes
    }
  };

  const handleCompress = () => {
    setIsProcessing(true);
    
    // Simulate processing delay - this would be replaced with actual processing
    setTimeout(() => {
      setIsProcessing(false);
      toast({
        title: "Video compressed successfully",
        description: "Your video has been compressed and is ready to download.",
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
        <h1 className="text-3xl font-bold">Compress Video</h1>
      </div>

      {!videoUrl ? (
        <div className="rounded-lg border-2 border-dashed border-border p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <FileArchive className="h-12 w-12 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Upload a video to compress</h2>
            <p className="text-muted-foreground max-w-md">
              Upload your video file to compress it. Reduce file size while maintaining quality.
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
              onLoadedMetadata={handleVideoLoad}
            />
          </div>

          <Tabs defaultValue="compression" className="w-full">
            <TabsList className="grid grid-cols-3 mb-4">
              <TabsTrigger value="compression">
                <Gauge className="h-4 w-4 mr-2" /> Compression
              </TabsTrigger>
              <TabsTrigger value="format">
                <FileDown className="h-4 w-4 mr-2" /> Format
              </TabsTrigger>
              <TabsTrigger value="advanced">
                <Settings className="h-4 w-4 mr-2" /> Advanced
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="compression">
              <Card>
                <CardHeader>
                  <CardTitle>Compression Settings</CardTitle>
                  <CardDescription>
                    Control how much your video will be compressed
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Compression Mode</Label>
                      <div className="text-sm text-muted-foreground">
                        Choose how you want to compress your video
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <Label 
                        htmlFor="compression-mode" 
                        className={compressionMode === "quality" ? "text-primary" : "text-muted-foreground"}
                      >
                        Quality
                      </Label>
                      <Switch
                        id="compression-mode"
                        checked={compressionMode === "size"}
                        onCheckedChange={(checked) => 
                          setCompressionMode(checked ? "size" : "quality")
                        }
                      />
                      <Label 
                        htmlFor="compression-mode"
                        className={compressionMode === "size" ? "text-primary" : "text-muted-foreground"}
                      >
                        Target Size
                      </Label>
                    </div>
                  </div>

                  {compressionMode === "quality" ? (
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-2">
                          <Label>Quality: {quality}%</Label>
                          <span className="text-sm text-muted-foreground">
                            Estimated size: {formatBytes(Math.round(originalSize * (quality / 100)))}
                          </span>
                        </div>
                        <Slider
                          min={10}
                          max={100}
                          step={1}
                          value={[quality]}
                          onValueChange={(values) => setQuality(values[0])}
                        />
                        <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                          <span>Smaller file</span>
                          <span>Higher quality</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="mb-2 block">Original Size</Label>
                          <div className="text-xl font-medium">
                            {formatBytes(originalSize)}
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="target-size" className="mb-2 block">Target Size (MB)</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id="target-size"
                              type="number"
                              min={0.1}
                              step={0.1}
                              value={(targetSize ? targetSize / (1024 * 1024) : 0).toFixed(1)}
                              onChange={handleTargetSizeChange}
                            />
                            <span>MB</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-2">
                          <Label>Estimated Quality: {quality}%</Label>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary" 
                            style={{ width: `${quality}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="format">
              <Card>
                <CardHeader>
                  <CardTitle>Format Settings</CardTitle>
                  <CardDescription>
                    Choose output format and resolution
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Output Format</Label>
                      <Select value={format} onValueChange={setFormat}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select format" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mp4">MP4</SelectItem>
                          <SelectItem value="webm">WebM</SelectItem>
                          <SelectItem value="mov">MOV</SelectItem>
                          <SelectItem value="gif">GIF</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Resolution</Label>
                      <Select value={resolution} onValueChange={setResolution}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select resolution" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="original">Original</SelectItem>
                          <SelectItem value="1080p">1080p (Full HD)</SelectItem>
                          <SelectItem value="720p">720p (HD)</SelectItem>
                          <SelectItem value="480p">480p (SD)</SelectItem>
                          <SelectItem value="360p">360p</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="advanced">
              <Card>
                <CardHeader>
                  <CardTitle>Advanced Settings</CardTitle>
                  <CardDescription>
                    Fine-tune compression parameters
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Frame Rate (FPS)</Label>
                    <Select value={fps} onValueChange={setFps}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select frame rate" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="original">Original ({originalFps || "detecting..."})</SelectItem>
                        <SelectItem value="60">60 FPS</SelectItem>
                        <SelectItem value="30">30 FPS</SelectItem>
                        <SelectItem value="24">24 FPS (Cinematic)</SelectItem>
                        <SelectItem value="15">15 FPS</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Lowering FPS can significantly reduce file size</p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Bitrate Multiplier: {bitrateMultiplier.toFixed(1)}x</Label>
                    </div>
                    <Slider
                      min={0.1}
                      max={2}
                      step={0.1}
                      value={[bitrateMultiplier]}
                      onValueChange={(values) => setBitrateMultiplier(values[0])}
                    />
                    <p className="text-xs text-muted-foreground">Adjusts video bitrate (higher = better quality but larger file)</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => {
              setVideo(null);
              setVideoUrl(null);
            }}>
              <RotateCcw className="h-4 w-4 mr-2" /> Reset
            </Button>
            <Button
              onClick={handleCompress}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>Processing...</>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" /> Compress Video
                </>
              )}
            </Button>
            <Button variant="secondary" disabled={!isProcessing}>
              <Download className="h-4 w-4 mr-2" /> Download
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}