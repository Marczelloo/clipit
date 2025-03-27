"use client";

import { useState } from "react";
import { Share2, Copy, Check } from "lucide-react";
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

interface InviteServerDialogProps {
  inviteCode: string;
  serverName?: string;
}

export function InviteServerDialog({ inviteCode, serverName }: InviteServerDialogProps) {
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const { toast } = useToast();

  const handleCopyInviteCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setInviteCopied(true);
      toast({
        title: "Invite code copied",
        description: "The invite code has been copied to your clipboard.",
      });

      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setInviteCopied(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy invite code:", error);
      toast({
        title: "Failed to copy",
        description: "Please copy the code manually.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Share2 className="h-4 w-4 mr-2" />
          Invite Users
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Invite Users to {serverName ? `"${serverName}"` : "Your Server"}
          </DialogTitle>
          <DialogDescription>
            Share this code with others to let them join your server.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="inviteCodeDisplay" className="text-sm font-medium">
              Server Invite Code
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="inviteCodeDisplay"
                value={inviteCode}
                readOnly
                className="font-mono"
              />
              <Button size="icon" onClick={handleCopyInviteCode}>
                {inviteCopied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => setShowInviteDialog(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}