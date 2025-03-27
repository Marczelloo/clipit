"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { VideoPlayer } from "./video-player";

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoSrc: string;
  videoTitle?: string;
  clipId?: string; // Add clipId prop
}

export function VideoModal({ isOpen, onClose, videoSrc, videoTitle, clipId }: VideoModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[70vw] h-[80vh] flex flex-col justify-center items-center">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-center">{videoTitle}</DialogTitle>
        </DialogHeader>
        <VideoPlayer
          src={videoSrc}
          title={videoTitle}
          autoPlay={true}
          onClose={onClose}
          clipId={clipId} // Pass clipId to VideoPlayer
        />
      </DialogContent>
    </Dialog>
  );
}