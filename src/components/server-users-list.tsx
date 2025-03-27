"use client";

import { User, UserPlus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { InviteServerDialog } from "./invite-server-dialog";

interface ServerUser {
  id: string;
  name: string;
  image?: string;
  isOwner: boolean;
}

interface ServerUsersListProps {
  users: ServerUser[];
  inviteCode?: string;
  serverName?: string;
  isOwner: boolean;
}

export function ServerUsersList({ users, inviteCode, serverName, isOwner }: ServerUsersListProps) {
  return (
    <div className="border rounded-lg p-4">
      <h3 className="font-semibold text-lg mb-4">Server Members</h3>
      
      {users.length === 0 ? (
        <p className="text-muted-foreground">No members found.</p>
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <div key={user.id} className="flex items-center justify-between p-2 rounded-md hover:bg-accent">
              <div className="flex items-center gap-3">
                {user.image ? (
                  <img 
                    src={user.image} 
                    alt={user.name} 
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <User className="w-8 h-8 rounded-full p-1 bg-muted" />
                )}
                <span>{user.name}</span>
              </div>
              {user.isOwner && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                  Owner
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      
      {isOwner && inviteCode && (
        <div className="mt-6">
          <InviteServerDialog inviteCode={inviteCode} serverName={serverName} />
        </div>
      )}
    </div>
  );
}