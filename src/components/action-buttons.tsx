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
    
    // Download in a way that doesn't trigger navigation
    const a = document.createElement('a');
    a.href = compressedUrl;
    a.download = `compressed_${fileName}`; 
    a.rel = "noopener noreferrer";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    
    // Use setTimeout to ensure the browser has time to process the download
    setTimeout(() => {
      document.body.removeChild(a);
    }, 100);
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