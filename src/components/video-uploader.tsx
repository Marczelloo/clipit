"use client";

import { FileArchive, Upload } from 'lucide-react';
import { Input } from '~/components/ui/input';
import { useToast } from '~/hooks/use-toast';

interface VideoUploaderProps {
  onVideoSelected: (file: File, url: string) => void;
}

export function VideoUploader({ onVideoSelected }: VideoUploaderProps) {
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file?.type.includes("video")) {
      const url = URL.createObjectURL(file);
      onVideoSelected(file, url);
    } else {
      toast({
        title: "Invalid file",
        description: "Please upload a valid video file.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="rounded-lg border-2 border-dashed border-border p-12 text-center">
      <div className="flex flex-col items-center gap-4">
        <FileArchive className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Upload a video</h2>
        <p className="text-muted-foreground max-w-md">
          Upload your video file to process it. 
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
  );
}