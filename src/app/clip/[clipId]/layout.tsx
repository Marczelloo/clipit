import type { Metadata } from "next";
import { db } from "~/server/db";

// Dynamic metadata generation for clip pages
export async function generateMetadata({ 
  params 
}: { 
  params: { clipId: string } 
}): Promise<Metadata> {
  const clipId = params.clipId;
  
  try {
    // Fetch clip data from database
    const clip = await db.clip.findUnique({
      where: { id: clipId },
      select: {
        id: true,
        title: true,
        description: true,
        thumbnailUrl: true,
        fileUrl: true,
      }
    });
    
    if (!clip) {
      return {
        title: "Clip Not Found | ClipIt",
        description: "The requested clip could not be found.",
      };
    }
    
    // Build absolute URLs for OG tags
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://clipit-app.vercel.app";
    const thumbnailUrl = clip.thumbnailUrl || `${baseUrl}/images/default-thumbnail.png`;
    
    return {
      title: `${clip.title} | ClipIt`,
      description: clip.description || `Watch this video clip on ClipIt`,
      openGraph: {
        title: clip.title,
        description: clip.description || "Watch this video clip on ClipIt",
        type: "video.other",
        url: `${baseUrl}/clip/${clipId}`,
        images: [
          {
            url: thumbnailUrl,
            width: 1200,
            height: 630,
            alt: clip.title,
          }
        ],
        videos: [
          {
            url: clip.fileUrl,
            width: 1280,
            height: 720,
            type: "video/mp4",
          }
        ]
      },
      twitter: {
        card: "summary_large_image",
        title: clip.title,
        description: clip.description || "Watch this video clip on ClipIt",
        images: [thumbnailUrl],
      },
    };
  } catch (error) {
    console.error("Error generating metadata:", error);
    return {
      title: "ClipIt Video",
      description: "Watch videos on ClipIt",
    };
  }
}

export default function ClipLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  return children;
}