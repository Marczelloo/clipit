"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { ScissorsLineDashed, Download } from "lucide-react";
import { useToast } from "~/hooks/use-toast";

interface CutActionsProps {
  isProcessing: boolean;
  cutUrl: string | null;
  onCut: (e: React.MouseEvent<HTMLButtonElement>) => void;
  fileName?: string;
  progress?: number;
}

export function CutActions({
  isProcessing,
  cutUrl,
  onCut,
  fileName,
  progress = 0
}: CutActionsProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  const handleDownload = async () => {
    if (!cutUrl) return;
    
    try {
      setIsDownloading(true);
      
      // Get the file extension from the URL or fallback to mp4
      const fileExtension = cutUrl.split('.').pop() || 'mp4';
      const downloadName = `cut_${fileName || 'video'}.${fileExtension}`;
      
      // Fetch the file as a blob
      const response = await fetch(cutUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      
      // Create a blob URL and trigger download
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }, 100);
      
      toast({
        title: "Download started",
        description: `Downloading ${downloadName}`,
      });
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "Failed to download video",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };
  
  return (
    <div className="space-y-4">
      {isProcessing && (
        <div className="w-full bg-muted rounded-full h-2">
          <div 
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      
      <div className="flex justify-end gap-4">
        <Button
          onClick={onCut}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <>Processing {progress > 0 ? `${progress}%` : ''}...</>
          ) : (
            <>
              <ScissorsLineDashed className="h-4 w-4 mr-2" /> Cut Video
            </>
          )}
        </Button>
        <Button 
          variant="secondary" 
          disabled={!cutUrl || isDownloading}
          onClick={handleDownload}
        >
          <Download className="h-4 w-4 mr-2" /> 
          {isDownloading ? "Downloading..." : "Download"}
        </Button>
      </div>
    </div>
  );
}