"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useToast } from "~/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

interface JoinServerDialogProps {
  onServerJoined: (serverId: string) => void;
}

export function JoinServerDialog({ onServerJoined }: JoinServerDialogProps) {
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [isJoiningServer, setIsJoiningServer] = useState(false);
  const { toast } = useToast();

  const handleJoinServer = async () => {
    if (!joinCode.trim()) {
      toast({
        title: "Invite code required",
        description: "Please enter a valid invite code.",
        variant: "destructive",
      });
      return;
    }

    setIsJoiningServer(true);

    try {
      const response = await fetch("/api/clip-servers/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: joinCode.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to join server: ${response.status}`);
      }

      const result = await response.json();

      toast({
        title: "Joined server successfully",
        description: `You've joined "${result.server.name}".`,
      });

      // Reset form and close dialog
      setJoinCode("");
      setShowJoinDialog(false);
      
      // Notify parent component about the joined server
      onServerJoined(result.server.id);
    } catch (error) {
      console.error("Error joining server:", error);
      toast({
        title: "Failed to join server",
        description: error instanceof Error ? error.message : "Invalid invite code or server not found.",
        variant: "destructive",
      });
    } finally {
      setIsJoiningServer(false);
    }
  };

  return (
    <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full h-full rounded-[16px] hover:rounded-[12px] flex items-center justify-center transition-all duration-200 hover:opacity-50 hover:bg-primary-foreground">
          <UserPlus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join Existing Server</DialogTitle>
          <DialogDescription>
            Enter an invite code to join an existing clip server.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="inviteCode" className="text-sm font-medium">
              Invite Code
            </label>
            <Input
              id="inviteCode"
              placeholder="Enter invite code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowJoinDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleJoinServer} 
            disabled={isJoiningServer || !joinCode.trim()}
          >
            {isJoiningServer ? "Joining..." : "Join Server"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}