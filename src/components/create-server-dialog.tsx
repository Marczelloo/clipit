"use client";

import { useState } from "react";
import { PlusCircle } from "lucide-react";
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

interface CreateServerDialogProps {
  onServerCreated: (serverId: string) => void;
}

export function CreateServerDialog({ onServerCreated }: CreateServerDialogProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newServerName, setNewServerName] = useState("");
  const [isCreatingServer, setIsCreatingServer] = useState(false);
  const { toast } = useToast();

  const handleCreateServer = async () => {
    if (!newServerName.trim()) {
      toast({
        title: "Server name required",
        description: "Please enter a name for your server.",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingServer(true);

    try {
      const response = await fetch("/api/clip-servers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newServerName.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Server creation failed: ${response.status}`);
      }

      const result = await response.json();

      toast({
        title: "Server created successfully",
        description: `Your new server "${newServerName}" has been created.`,
      });

      // Reset form and close dialog
      setNewServerName("");
      setShowCreateDialog(false);
      
      // Notify parent component about the new server
      onServerCreated(result.server.id);
    } catch (error) {
      console.error("Error creating server:", error);
      toast({
        title: "Server creation failed",
        description: "There was an error creating your server. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingServer(false);
    }
  };

  return (
    <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full h-full rounded-[16px] hover:rounded-[12px] flex items-center justify-center transition-all duration-200 hover:opacity-50 hover:bg-primary-foreground">
          <PlusCircle className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Server</DialogTitle>
          <DialogDescription>
            Create a new clip server to organize and share clips with other users.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="name" className="text-sm font-medium">
              Server Name
            </label>
            <Input
              id="name"
              placeholder="Enter server name"
              value={newServerName}
              onChange={(e) => setNewServerName(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateServer} 
            disabled={isCreatingServer || !newServerName.trim()}
          >
            {isCreatingServer ? "Creating..." : "Create Server"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}