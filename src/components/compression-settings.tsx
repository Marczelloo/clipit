"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Slider } from "~/components/ui/slider";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "~/components/ui/select";
import { Gauge, FileDown, Settings } from "lucide-react";
import { formatBytes } from "~/lib/utils";

interface CompressionSettingsProps {
  compressionMode: "quality" | "size";
  setCompressionMode: (mode: "quality" | "size") => void;
  quality: number;
  setQuality: (quality: number) => void;
  format: string;
  setFormat: (format: string) => void;
  resolution: string;
  setResolution: (resolution: string) => void;
  fps: string;
  setFps: (fps: string) => void;
  bitrateMultiplier: number;
  setBitrateMultiplier: (multiplier: number) => void;
  originalSize: number;
  originalFps: number | null;
  targetSize: number | null;
  handleTargetSizeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function CompressionSettings({
  compressionMode,
  setCompressionMode,
  quality,
  setQuality,
  format,
  setFormat,
  resolution,
  setResolution,
  fps,
  setFps,
  bitrateMultiplier,
  setBitrateMultiplier,
  originalSize,
  originalFps,
  targetSize,
  handleTargetSizeChange
}: CompressionSettingsProps) {
  return (
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
                    onValueChange={(values) => setQuality(values[0] ?? quality)}
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
                  <SelectItem value="original">Original ({originalFps ?? "detecting..."})</SelectItem>
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
                onValueChange={(values) => setBitrateMultiplier(values[0] ?? bitrateMultiplier)}
              />
              <p className="text-xs text-muted-foreground">Adjusts video bitrate (higher = better quality but larger file)</p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}