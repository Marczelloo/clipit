"use client";

import { User } from "lucide-react";
import { ClipCard } from "./clip-card";

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

interface UserWithClips {
  id: string;
  name: string;
  image?: string;
  clips: Clip[];
}

interface UserClipsProps {
  userWithClips: UserWithClips;
  onClipDeleted?: (clipId: string) => void;
}

export function UserClips({ userWithClips, onClipDeleted }: UserClipsProps) {
  const { id, name, image, clips } = userWithClips;
  
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {image ? (
          <img 
            src={image} 
            alt={name} 
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <User className="w-8 h-8 rounded-full p-1 bg-muted" />
        )}
        <h2 className="text-xl font-semibold">{name}</h2>
      </div>
      
      {clips.length === 0 ? (
        <p className="text-muted-foreground text-sm pl-10">No clips from this user</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pl-10">
          {clips.map((clip) => (
            <ClipCard 
              key={clip.id} 
              clip={clip} 
              onDelete={onClipDeleted}
            />
          ))}
        </div>
      )}
    </div>
  );
}