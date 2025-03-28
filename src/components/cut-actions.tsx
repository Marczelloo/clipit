"use client";

import { Button } from "~/components/ui/button";
import { ScissorsLineDashed, Download } from "lucide-react";

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
          disabled={!cutUrl}
          onClick={() => {
            if (!cutUrl) return;
            
            // Create an anchor element to force download
            const a = document.createElement('a');
            a.href = cutUrl;
            a.download = `cut_${fileName ?? 'video'}`; // Set filename
            document.body.appendChild(a);
            a.click(); // Trigger download
            document.body.removeChild(a); // Clean up
          }}
        >
          <Download className="h-4 w-4 mr-2" /> Download
        </Button>
      </div>
    </div>
  );
}