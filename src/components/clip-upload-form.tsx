"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useToast } from "~/hooks/use-toast";
import { VideoUploader } from "~/components/video-uploader";
import { useChunkedUpload } from "~/hooks/use-chunked-upload";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

interface ClipServer {
  id: string;
  name: string;
}

interface ClipUploadFormProps {
  servers: ClipServer[];
  selectedServerId: string;
  onServerChange?: (serverId: string) => void; // Made optional since we won't use it
  onUploadComplete: () => void;
  onCancel: () => void;
}

export function ClipUploadForm({ 
  selectedServerId, 
  servers,
  onUploadComplete, 
  onCancel 
}: ClipUploadFormProps) {
  const [clipTitle, setClipTitle] = useState("");
  const [clipDescription, setClipDescription] = useState("");
  const [clipFile, setClipFile] = useState<File | null>(null);
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();
  
  // Initialize the chunked upload hook
  const { uploadFile, finalizeUpload, progress } = useChunkedUpload({
    onProgress: (progress) => setUploadProgress(progress),
    onError: (error) => {
      console.error("Chunked upload error:", error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload your clip",
        variant: "destructive",
      });
      setIsUploading(false);
    },
  });

  // Get current server name for display
  const currentServer = servers.find(server => server.id === selectedServerId)?.name || "Server";

  // Handle video selection from uploader
  const handleVideoSelected = (file: File, url: string) => {
    setClipFile(file);
    setClipUrl(url);
    
    // Try to set a default title from the filename
    if (!clipTitle && file.name) {
      const nameWithoutExtension = file.name.split('.').slice(0, -1).join('.');
      setClipTitle(nameWithoutExtension || "My Clip");
    }
  };

  // Handle clip upload
  const handleUploadClip = async () => {
    if (!clipFile || !selectedServerId || !clipTitle) {
      toast({
        title: "Missing information",
        description: "Please provide a title and select a video file.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Step 1: Upload file in chunks
      const uploadResult = await uploadFile(clipFile, selectedServerId);
      
      if (!uploadResult) {
        throw new Error("Failed to upload file chunks");
      }
      
      // Step 2: Finalize the upload
      const finalizeResult = await finalizeUpload(
        uploadResult,
        clipTitle,
        clipDescription
      );

      if (finalizeResult?.success) {
        toast({
          title: "Clip uploaded successfully",
          description: "Your clip has been uploaded and is ready to share.",
        });
        
        // Reset form and notify parent
        resetForm();
        onUploadComplete();
      } else {
        throw new Error(finalizeResult?.error || "Upload failed");
      }
    } 
    catch (error) 
    {
      console.error("Error uploading clip:", error);
          
      // Extract more detailed error information
      let errorMessage = "Failed to upload your clip. Please try again later.";
      if (error instanceof Error) {
        console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack
        });
        errorMessage = error.message || errorMessage;
      } 
      else if (error instanceof Response) 
      {
        // Handle Response objects
        errorMessage = `Server error: ${error.status} ${error.statusText}`;
      }
      
      toast({
        title: "Upload failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setClipFile(null);
    setClipUrl(null);
    setClipTitle("");
    setClipDescription("");
    setUploadProgress(0);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload New Clip</CardTitle>
        <CardDescription>
          Upload a video clip to "{currentServer}"
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!clipFile ? (
          <VideoUploader onVideoSelected={handleVideoSelected} />
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg overflow-hidden aspect-video bg-black flex items-center justify-center">
              <video 
                src={clipUrl!} 
                controls 
                className="max-h-full max-w-full" 
                autoPlay={false}
              />
            </div>
            
            <div className="grid gap-4">              
              <div className="grid gap-2">
                <label htmlFor="title" className="text-sm font-medium">Clip Title</label>
                <Input 
                  id="title" 
                  value={clipTitle} 
                  onChange={(e) => setClipTitle(e.target.value)} 
                  placeholder="Enter a title for your clip" 
                />
              </div>
              
              <div className="grid gap-2">
                <label htmlFor="description" className="text-sm font-medium">Description (Optional)</label>
                <Input 
                  id="description" 
                  value={clipDescription} 
                  onChange={(e) => setClipDescription(e.target.value)} 
                  placeholder="Describe your clip (optional)" 
                />
              </div>
              
              {isUploading && (
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={() => {
          resetForm();
          onCancel();
        }}>
          Cancel
        </Button>
        <Button 
          onClick={handleUploadClip} 
          disabled={!clipFile || !selectedServerId || !clipTitle || isUploading}
        >
          {isUploading ? `Uploading ${uploadProgress}%` : "Upload Clip"}
        </Button>
      </CardFooter>
    </Card>
  );
}