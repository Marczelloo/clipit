"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { 
  Copy, 
  Download, 
  ExternalLink, 
  Link2, 
  Maximize, 
  Minimize, 
  Pause, 
  Play, 
  Share2, 
  Volume2, 
  VolumeX 
} from "lucide-react";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { useToast } from "~/hooks/use-toast";

interface VideoPlayerProps {
  src: string;
  title?: string;
  autoPlay?: boolean;
  onClose?: () => void;
  showControls?: boolean;
  clipId?: string;
  showTitle?: boolean;
}

export function VideoPlayer({ 
  src, 
  title, 
  autoPlay = false, 
  onClose, 
  showControls = true,
  clipId,
  showTitle,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const { toast } = useToast();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => setDuration(video.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleFullscreenChange = () => setIsFullscreen(document.fullscreenElement !== null);

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    
    if (isPlaying) {
      video.pause();
    } else {
      void video.play();
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    
    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = () => {
    const videoContainer = document.getElementById("video-container");
    if (!videoContainer) return;

    if (!document.fullscreenElement) {
      void videoContainer.requestFullscreen();
    } else {
      void document.exitFullscreen();
    }
  };

  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    
    const time = parseFloat(e.target.value);
    video.currentTime = time;
    setCurrentTime(time);
  };

  const copyToClipboard = (text: string, successMessage: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        toast({
          description: successMessage,
          duration: 2000,
        });
      })
      .catch(() => {
        toast({
          description: "Failed to copy to clipboard",
          variant: "destructive",
        });
      });
  };

  const getBaseUrl = () => {
    return typeof window !== "undefined" 
      ? window.location.origin 
      : process.env.NEXT_PUBLIC_APP_URL ?? "https://clipit-app.vercel.app";
  };

  const handleCopyDirectLink = () => {
    if (!clipId) return;
    const url = `${getBaseUrl()}/clip/${clipId}`;
    copyToClipboard(url, "Direct link copied to clipboard");
  };

  return (
    <div id="video-container" className="relative w-auto aspect-video max-h-[70vh]">
      {showTitle && (
        title && <h2 className="text-lg font-semibold mb-2">{title}</h2>
      )}
      <video
      ref={videoRef}
      src={src}
      className="rounded-md w-full h-full object-contain"
      autoPlay={autoPlay}
      onClick={togglePlay}
      />
      
      {showControls && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-2 flex items-center space-x-2 rounded-b-md">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-white" 
            onClick={togglePlay}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </Button>
          
          <div className="flex-1 flex items-center space-x-2">
            <span className="text-xs text-white">{formatTime(currentTime)}</span>
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 h-1"
            />
            <span className="text-xs text-white">{formatTime(duration)}</span>
          </div>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-white" 
                  onClick={toggleMute}
                >
                  {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isMuted ? "Unmute" : "Mute"}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-white" 
                  onClick={toggleFullscreen}
                >
                  {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-white" 
                  asChild
                >
                  <a href={src} download>
                    <Download size={16} />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download video</TooltipContent>
            </Tooltip>

            {clipId && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-white" 
                      asChild
                    >
                      <a href={`/clip/${clipId}`} target="_blank">
                        <ExternalLink size={16} />
                      </a>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Open in new tab</TooltipContent>
                </Tooltip>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-white"
                          onClick={handleCopyDirectLink}
                        >
                          <Share2 size={16} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Share video</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            )}
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}