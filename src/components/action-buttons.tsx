"use client";

import { Button } from "~/components/ui/button";
import { Download, RotateCcw, Zap } from "lucide-react";

interface ActionButtonsProps {
  isProcessing: boolean;
  compressedUrl: string | null;
  onReset: () => void;
  onCompress: (e: React.MouseEvent) => void;
  fileName?: string;
}

export function ActionButtons({
  isProcessing,
  compressedUrl,
  onReset,
  onCompress,
  fileName = 'video'
}: ActionButtonsProps) {
  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!compressedUrl) return;
    
    // Extract the file extension from the URL
    const fileExtension = compressedUrl.split('.').pop()?.toLowerCase() || 'mp4';
    const outputFileName = `compressed_${fileName.replace(/\.[^/.]+$/, '')}.${fileExtension}`;
    
    // Create a fetch request to get the actual binary file content
    fetch(compressedUrl)
      .then(response => {
        if (!response.ok) throw new Error("Network response was not ok");
        return response.blob();
      })
      .then(blob => {
        // Create a blob URL from the binary data
        const blobUrl = URL.createObjectURL(blob);
        
        // Create an anchor element and trigger download
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = outputFileName;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
        }, 100);
      })
      .catch(error => {
        console.error("Download failed:", error);
        // Fallback to direct linking if fetch fails
        window.open(compressedUrl, '_blank');
      });
  };

  const handleResetClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onReset();
  };

  const handleCompressClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onCompress(e);
  };

  return (
    <div className="flex justify-end gap-4">
      <Button 
        type="button" 
        variant="outline" 
        onClick={handleResetClick}
        disabled={isProcessing}
      >
        <RotateCcw className="h-4 w-4 mr-2" /> Reset
      </Button>
      
      <Button
        type="button"
        onClick={handleCompressClick}
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
      
      <Button 
        type="button"
        variant="secondary" 
        disabled={!compressedUrl}
        onClick={handleDownload}
      >
        <Download className="h-4 w-4 mr-2" /> Download
      </Button>
    </div>
  );
}