"use client";

import { useState } from "react";
import { Download, Folder, Play, Share } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import Link from "next/link";
import { VideoModal } from "./video-modal";
import { useToast } from "~/hooks/use-toast";

interface Clip {
  id: string;
  title: string;
  description?: string;
  fileUrl: string;
  thumbnailUrl?: string;
  createdAt: string;
  userId: string;
  serverId: string;
}

interface ClipCardProps {
  clip: Clip;
}

export function ClipCard({ clip }: ClipCardProps) {
  const [showVideoModal, setShowVideoModal] = useState(false);

  const { toast } = useToast();

  const openVideoModal = () => setShowVideoModal(true);
  const closeVideoModal = () => setShowVideoModal(false);

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/clip/${clip.id}`;
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        toast({ title: "Success", description: "Clip link copied to clipboard!" });
      })
      .catch(err => {
        toast({ title: "Error", description: "Failed to copy link: " + err });
      });
  };

  return (
    <>
      <Card key={clip.id} className="overflow-hidden hover:cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200" onClick={openVideoModal}>
        <div 
          className="aspect-video bg-muted relative cursor-pointer"
          onClick={openVideoModal}
        >
          {clip.thumbnailUrl ? (
            <>
              <img 
                src={clip.thumbnailUrl} 
                alt={clip.title} 
                className="object-cover w-full h-full"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
                <Play className="h-12 w-12 text-white" />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <Folder className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
        </div>
        <CardHeader className="p-4">
          <CardTitle className="text-lg">{clip.title}</CardTitle>
          {clip.description && (
            <CardDescription>{clip.description}</CardDescription>
          )}
        </CardHeader>
        <CardFooter className="p-4 pt-0 flex justify-between">
          <span className="text-xs text-muted-foreground">
            {new Date(clip.createdAt).toLocaleDateString()}
          </span>
          <div className="flex gap-2">
            <Button size="icon" variant="secondary" asChild>
              <Link href={clip.fileUrl} download target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                <Download className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="icon" variant="default" asChild onClick={handleShare} disabled={!clip.fileUrl}>
              <div>
                <Share className="h-4 w-4" />
              </div>
            </Button>
          </div>
        </CardFooter>
      </Card>
      
      <VideoModal 
        isOpen={showVideoModal} 
        onClose={closeVideoModal} 
        videoSrc={clip.fileUrl}
        videoTitle={clip.title}
        clipId={clip.id} // Pass clipId to VideoModal
      />
    </>
  );
}