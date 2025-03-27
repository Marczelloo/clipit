"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { 
  Folder, 
  Upload, 
  Clock, 
  ArrowLeft, 
  AlertTriangle,
  Plus,
  User,
  Users,
  Hash,
  Settings,
  Search
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { useToast } from "~/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

// Import our custom components
import { ClipCard } from "~/components/clip-card";
import { CreateServerDialog } from "~/components/create-server-dialog";
import { JoinServerDialog } from "~/components/join-server-dialog";
import { InviteServerDialog } from "~/components/invite-server-dialog";
import { ClipUploadForm } from "~/components/clip-upload-form";
import { ServerUsersList } from "~/components/server-users-list";
import { UserClips } from "~/components/user-clips";

// Type definitions
interface ClipServer {
  id: string;
  name: string;
  imageUrl?: string;
  ownerId: string;
  createdAt: string;
  code: string;
}

interface ClipServerUser {
  id: string;
  name: string;
  image?: string;
  serverId: string;
  userId: string;
  isOwner: boolean;
}

interface UserWithClips {
  id: string;
  name: string;
  image?: string;
  clips: Clip[];
}

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

export default function ClipsPage() {
  const { data: session, status } = useSession();
  const [servers, setServers] = useState<ClipServer[]>([]);
  const [serverUsers, setServerUsers] = useState<ClipServerUser[]>([]);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [usersWithClips, setUsersWithClips] = useState<UserWithClips[]>([]);
  const [recentClips, setRecentClips] = useState<Clip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Invite dialog state
  const [inviteCode, setInviteCode] = useState("");

  // Upload state
  const [uploadMode, setUploadMode] = useState(false);
  
  // Active view state
  const [activeView, setActiveView] = useState<"recent" | "users" | "members">("recent");
  
  const { toast } = useToast();

  // Fetch user's servers
  useEffect(() => {
    const fetchServers = async () => {
      if (status === "loading") return;
      
      if (status === "authenticated" && session) {
        try {
          setIsLoading(true);
          const response = await fetch("/api/clip-servers");
          
          if (!response.ok) {
            throw new Error(`Failed to fetch servers: ${response.status}`);
          }
          
          const data = await response.json();
          setServers(data.servers || []);
          
          // Select the first server by default if available
          if (data.servers?.length > 0) {
            setSelectedServer(data.servers[0].id);
          }
          
        } catch (error) {
          console.error("Error fetching servers:", error);
          toast({
            title: "Failed to load servers",
            description: "Could not load your clip servers. Please try again later.",
            variant: "destructive",
          });
        } finally {
          setIsLoading(false);
        }
      } else {
        // Not authenticated
        setIsLoading(false);
      }
    };

    void fetchServers();
  }, [session, status, toast]);

  // Fetch users and clips for selected server
  useEffect(() => {
    const fetchServerData = async () => {
      if (!selectedServer) return;
      
      try {
        const response = await fetch(`/api/clip-servers/${selectedServer}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch server data: ${response.status}`);
        }
        
        const data = await response.json();
        setUsersWithClips(data.users || []);
        setRecentClips(data.recentClips || []);
        setServerUsers(data.serverUsers || []);
        
        // Get server invite code if owner
        if (data.server?.ownerId === session?.user?.id) {
          setInviteCode(data.server.code || '');
        }
        
      } catch (error) {
        console.error("Error fetching server data:", error);
        toast({
          title: "Failed to load clips",
          description: "Could not load clips for this server. Please try again later.",
          variant: "destructive",
        });
      }
    };

    if (selectedServer) {
      void fetchServerData();
    }
  }, [selectedServer, session?.user?.id, toast]);

  // Handle server created
  const handleServerCreated = async (serverId: string) => {
    // Refresh servers list and select the new server
    try {
      const response = await fetch("/api/clip-servers");
      
      if (response.ok) {
        const data = await response.json();
        setServers(data.servers || []);
        setSelectedServer(serverId);
      }
    } catch (error) {
      console.error("Error refreshing servers:", error);
    }
  };

  // Handle server joined
  const handleServerJoined = async (serverId: string) => {
    // Refresh servers list and select the joined server
    try {
      const response = await fetch("/api/clip-servers");
      
      if (response.ok) {
        const data = await response.json();
        setServers(data.servers || []);
        setSelectedServer(serverId);
      }
    } catch (error) {
      console.error("Error refreshing servers:", error);
    }
  };

  // Handle upload complete
  const handleUploadComplete = async () => {
    setUploadMode(false);
    
    // Refresh server data to include the new clip
    if (selectedServer) {
      try {
        const response = await fetch(`/api/clip-servers/${selectedServer}`);
        
        if (response.ok) {
          const data = await response.json();
          setUsersWithClips(data.users || []);
          setRecentClips(data.recentClips || []);
        }
      } catch (error) {
        console.error("Error refreshing server data:", error);
      }
    }
  };

  // Filter clips based on search query
  const filteredRecentClips = searchQuery 
    ? recentClips.filter(clip => 
        clip.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        clip.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : recentClips;

  // If user is not authenticated, redirect to login
  if (status === "unauthenticated") {
    return (
      <main className="flex flex-col items-center justify-center h-screen p-4 bg-background">
        <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-lg shadow-lg">
          <div className="flex flex-col items-center text-center">
            <AlertTriangle className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Authentication Required</h2>
            <p className="text-muted-foreground mb-6">
              You need to sign in to access clip servers.
            </p>
            <Link href="/api/auth/signin">
              <Button size="lg" className="w-full">
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Find the current server name
  const currentServer = servers.find(s => s.id === selectedServer);
  const isServerOwner = currentServer?.ownerId === session?.user?.id;

  // Generate server initials for the sidebar
  const getServerInitials = (name: string) => {
    return name.split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Discord-inspired layout for authenticated users
  return (
    <main className="flex h-screen overflow-hidden bg-background">
      {/* Server List Sidebar (Left) - Discord style */}
      <div className="w-[72px] bg-muted flex flex-col items-center py-4 overflow-y-auto">  
        {/* Server separator */}
        <div className="w-8 h-0.5 bg-border rounded-full mb-3"></div>
        
        <div className="space-y-2 w-full px-3">
          {servers.map((server) => (
            <div key={server.id} className="w-full" style={{ aspectRatio: "1/1" }}>
              <Button
                onClick={() => setSelectedServer(server.id)}
                className={`w-full h-full rounded-[16px] flex items-center justify-center transition-all duration-200 
                  ${selectedServer === server.id 
                    ? 'bg-primary text-primary-foreground rounded-[12px]' 
                    : 'bg-card hover:bg-card hover:opacity-50 text-secondary-foreground hover:rounded-[12px]'}`}
                title={server.name}
              >
                {server.imageUrl ? (
                  <div className="relative w-full h-full rounded-[inherit] overflow-hidden">
                    <Image 
                      src={server.imageUrl} 
                      alt={server.name}
                      fill
                      sizes="48px"
                      className="object-cover" 
                    />
                  </div>
                ) : (
                  <div className="font-semibold text-sm">
                    {getServerInitials(server.name)}
                  </div>
                )}
              </Button>
            </div>
          ))}
          
          {/* Create server button - as icon with tooltip */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-full aspect-square">
                  <CreateServerDialog
                    onServerCreated={handleServerCreated}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                Create a server
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          {/* Join server button - as icon with tooltip */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-full aspect-square">
                  <JoinServerDialog
                    onServerJoined={handleServerJoined}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                Join a server
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      
      {/* Channel/Server View (Middle) - Discord style */}
      {selectedServer ? (
        <div className="w-60 bg-card border-r flex flex-col">
          {/* Server header */}
          <div className="p-3 border-b flex items-center justify-between">
            <h2 className="font-semibold truncate">{currentServer?.name}</h2>
          </div>
          
          {/* Channel list */}
          <div className="flex-1 overflow-y-auto py-2">
            <div className="px-2">
              <div className="text-xs font-semibold text-muted-foreground px-2 py-1">
                CLIPS
              </div>
              <div className="space-y-0.5">
                <button 
                  className={`w-full px-2 py-1.5 rounded flex items-center gap-2 text-sm ${activeView === 'recent' ? 'bg-accent' : 'hover:bg-muted'}`}
                  onClick={() => setActiveView('recent')}
                >
                  <Hash className="h-4 w-4 opacity-70" />
                  <span className="truncate">recent-clips</span>
                </button>
                <button 
                  className={`w-full px-2 py-1.5 rounded flex items-center gap-2 text-sm ${activeView === 'users' ? 'bg-accent' : 'hover:bg-muted'}`}
                  onClick={() => setActiveView('users')}
                >
                  <Hash className="h-4 w-4 opacity-70" />
                  <span className="truncate">by-user</span>
                </button>
              </div>
            </div>
            
            {/* Server Management */}
            <div className="px-2 mt-4">
              <div className="text-xs font-semibold text-muted-foreground px-2 py-1">
                SERVER MANAGEMENT
              </div>
              <div className="space-y-0.5">
                <button 
                  className={`w-full px-2 py-1.5 rounded flex items-center gap-2 text-sm ${activeView === 'members' ? 'bg-accent' : 'hover:bg-muted'}`}
                  onClick={() => setActiveView('members')}
                >
                  <Users className="h-4 w-4 opacity-70" />
                  <span className="truncate">members</span>
                </button>
              </div>
            </div>
          </div>          
        </div>
      ) : (
        <div className="w-60 bg-card border-r flex flex-col items-center justify-center p-4">
          <div className="text-center space-y-4">
            <Folder className="h-12 w-12 text-muted-foreground mx-auto" />``
            <h2 className="font-semibold">No Server Selected</h2>
            <p className="text-xs text-muted-foreground">Create a server or join one to get started</p>
            <div className="flex gap-2 mt-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <CreateServerDialog 
                      onServerCreated={handleServerCreated}
                      trigger={
                        <Button variant="outline" size="icon">
                          <Plus className="h-4 w-4" />
                        </Button>
                      }
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    Create a server
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <JoinServerDialog 
                      onServerJoined={handleServerJoined}
                      trigger={
                        <Button variant="outline" size="icon">
                          <Users className="h-4 w-4" />
                        </Button>
                      }
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    Join a server
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
      )}
      
      {/* Main Content Area (Right) */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header for the selected view */}
        <div className="h-14 border-b flex items-center justify-between px-4">
          {selectedServer && (
            <>
              <div className="flex items-center gap-2">
                <div className="text-xl font-semibold">
                  {activeView === 'recent' && '# recent-clips'}
                  {activeView === 'users' && '# by-user'}
                  {activeView === 'members' && '# members'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!uploadMode && (
                  <>
                    <div className="relative w-64">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search clips..."
                        className="pl-9 h-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <Button onClick={() => setUploadMode(true)}>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
        
        {/* Main content area */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-pulse text-center">
                <Folder className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Loading your servers...</p>
              </div>
            </div>
          ) : (
            <>
              {servers.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center p-12 border rounded-lg max-w-md">
                    <Folder className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h2 className="text-xl font-semibold mb-2">No Servers Found</h2>
                    <p className="text-muted-foreground mb-6">
                      You don't have any clip servers yet. Create one or join an existing one.
                    </p>
                    <div className="flex justify-center gap-4">
                      <CreateServerDialog onServerCreated={handleServerCreated} />
                      <JoinServerDialog onServerJoined={handleServerJoined} />
                    </div>
                  </div>
                </div>
              ) : uploadMode && selectedServer ? (
                <ClipUploadForm 
                  servers={servers}
                  selectedServerId={selectedServer}
                  onServerChange={setSelectedServer}
                  onUploadComplete={handleUploadComplete}
                  onCancel={() => setUploadMode(false)}
                />
              ) : selectedServer && (
                <>
                  {/* Recent Clips View */}
                  {activeView === 'recent' && (
                    <>
                      {filteredRecentClips.length === 0 ? (
                        <div className="text-center p-8 border rounded-lg mt-8 max-w-md mx-auto">
                          <p className="text-muted-foreground">
                            {searchQuery ? "No clips match your search." : "No recent clips for this server."}
                          </p>
                          {!searchQuery && (
                            <Button 
                              variant="outline" 
                              className="mt-4" 
                              onClick={() => setUploadMode(true)}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Upload First Clip
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {filteredRecentClips.map((clip) => (
                            <ClipCard key={clip.id} clip={clip} />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  
                  {/* By User View */}
                  {activeView === 'users' && (
                    <div className="space-y-8">
                      {usersWithClips.length === 0 ? (
                        <div className="text-center p-8 border rounded-lg mt-8 max-w-md mx-auto">
                          <p className="text-muted-foreground">No users with clips in this server.</p>
                        </div>
                      ) : (
                        <>
                          {/* User selection dropdown */}
                          <div className="max-w-xs">
                            <Select 
                              onValueChange={(value) => {
                                const userId = value === "all" ? "all" : value;
                                setSearchQuery(""); // Reset search when changing user
                                
                                // Scroll to the selected user section or show all
                                if (userId !== "all") {
                                  setTimeout(() => {
                                    const element = document.getElementById(`user-${userId}`);
                                    if (element) {
                                      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    }
                                  }, 100);
                                }
                              }}
                              defaultValue="all"
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select a user" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Users</SelectItem>
                                {usersWithClips.map(user => (
                                  <SelectItem key={user.id} value={user.id}>
                                    {user.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {/* User clips sections */}
                          {usersWithClips.map((userWithClips) => (
                            <div id={`user-${userWithClips.id}`} key={userWithClips.id}>
                              <UserClips userWithClips={userWithClips} />
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                  
                  {/* Members View */}
                  {activeView === 'members' && (
                    <div className="max-w-3xl mx-auto">
                      <ServerUsersList 
                        users={serverUsers}
                        inviteCode={isServerOwner ? inviteCode : undefined}
                        serverName={currentServer?.name}
                        isOwner={isServerOwner}
                      />
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}