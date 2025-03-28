"use client";

import { useState } from "react";
import { Download, Folder, Play, Share, Trash2, MoreVertical } from "lucide-react";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "~/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import Link from "next/link";
import { VideoModal } from "./video-modal";
import { useToast } from "~/hooks/use-toast";
import { useSession } from "next-auth/react";

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
  onDelete?: (clipId: string) => void;
}

export function ClipCard({ clip, onDelete }: ClipCardProps) {
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { toast } = useToast();
  const { data: session } = useSession();

  const openVideoModal = () => setShowVideoModal(true);
  const closeVideoModal = () => setShowVideoModal(false);

  // Check if the current user is the owner of the clip
  const isOwner = session?.user?.id === clip.userId;

  // Handle file download properly
  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Get the file URL from the clip
    let fileUrl = clip.fileUrl;
    
    console.log("Original file URL:", fileUrl);
    
    // Extract the file name from the URL or path
    const fileName = clip.title || "clip.mp4";
    
    // Create a fetch request to get the actual binary file content
    fetch(fileUrl)
      .then(response => {
        if (!response.ok) {
          console.error("Download error status:", response.status, response.statusText);
          throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
        }
        return response.blob();
      })
      .then(blob => {
        // Create a blob URL from the binary data
        const blobUrl = URL.createObjectURL(blob);
        
        // Create an anchor element and trigger download
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `${fileName}.mp4`; // Assuming clips are mp4 files
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
        }, 100);
        
        toast({
          title: "Success",
          description: "Download started",
        });
      })
      .catch(error => {
        console.error("Download failed:", error);
        toast({
          title: "Download failed",
          description: "Could not download this clip. Please try again later.",
          variant: "destructive",
        });
        
        // Fallback to direct linking if fetch fails
        window.open(fileUrl, "_blank");
      });
  };

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

  const confirmDelete = async () => {
    if (!clip.id) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/clips/${clip.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete clip');
      }
      
      toast({
        title: "Success",
        description: "Clip deleted successfully",
      });
      
      // Call onDelete callback to update UI
      if (onDelete) {
        onDelete(clip.id);
      }
    } catch (error) {
      console.error('Error deleting clip:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to delete clip',
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <>
      <Card key={clip.id} className="overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-200">
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
          <div className="flex justify-between items-start">
            <CardTitle 
              className="text-lg cursor-pointer hover:text-primary transition-colors"
              onClick={openVideoModal}
            >
              {clip.title}
            </CardTitle>
            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8" 
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">More</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={handleShare}
                  >
                    <Share className="h-4 w-4 mr-2" />
                    Share
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDownload}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="text-destructive focus:text-destructive cursor-pointer"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          {clip.description && (
            <CardDescription className="cursor-pointer" onClick={openVideoModal}>
              {clip.description}
            </CardDescription>
          )}
        </CardHeader>
        <CardFooter className="p-4 pt-0 flex justify-between">
          <span className="text-xs text-muted-foreground">
            {new Date(clip.createdAt).toLocaleDateString()}
          </span>
        </CardFooter>
      </Card>
      
      <VideoModal 
        isOpen={showVideoModal} 
        onClose={closeVideoModal} 
        videoSrc={clip.fileUrl}
        videoTitle={clip.title}
        clipId={clip.id}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Clip</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{clip.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }} 
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}