"use client";

import { use, useEffect, useState } from "react";
import { VideoPlayer } from "~/components/video-player";
import { notFound } from "next/navigation";

// This will be used for public clip sharing - no authentication required
export default function ClipPage({ params }: { params: Promise<{ clipId: string }> }) {
  // Properly unwrap params using React.use()
  const resolvedParams = use(params);
  const clipId = resolvedParams.clipId;

  const [clipData, setClipData] = useState<{
    title: string;
    fileUrl: string;
    description?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchClip() {
      try {
        const response = await fetch(`/api/clips/${clipId}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            notFound();
          }
          throw new Error(`Failed to fetch clip: ${response.statusText}`);
        }
        
        const data = await response.json();
        setClipData(data.clip);
      } catch (err) {
        console.error("Error fetching clip:", err);
        setError("Could not load this clip");
      } finally {
        setLoading(false);
      }
    }
    
    void fetchClip();
  }, [clipId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !clipData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold mb-4">Error</h1>
        <p className="text-muted-foreground">{error ?? "Clip not found"}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-4 text-center">{clipData.title}</h1>
      {clipData.description && (
        <p className="text-muted-foreground mb-6">{clipData.description}</p>
      )}
      
      <div className="mb-8 flex justify-center">
        <VideoPlayer 
          src={clipData.fileUrl} 
          title={clipData.title}
          autoPlay={false}
          showControls={true}
          clipId={clipId} // Pass clipId to VideoPlayer for sharing
        />
      </div>
      <p className="text-center text-sm text-muted-foreground">
        Powered by ClipIt - Share videos easily
      </p>
    </div>
  );
}