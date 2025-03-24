"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { FileArchive, Download, Clock } from "lucide-react";
import { formatBytes } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";

export type ItemType = "compression" | "cut";

export interface RecentItem {
  id: string;
  originalName: string;
  originalSize: number;
  filePath: string;
  expiresAt: string;
  createdAt: string;
  [key: string]: string | number; // For any other properties specific to compression or cut
}

interface CompressionItem extends RecentItem {
  compressedSize: number;
  compressionRatio: number;
  format: string;
  quality: number;
}

interface CutItem extends RecentItem {
  cutSize: number;
  startTime: number;
  endTime: number;
  originalDuration: number;
}

interface RecentItemsProps {
  type: ItemType;
  title?: string;
  icon?: React.ReactNode;
}

interface ApiResponse {
  compressions?: CompressionItem[];
  cuts?: CutItem[];
  [key: string]: unknown;
}

export function RecentItems({ type, title, icon = <Clock className="h-5 w-5" /> }: RecentItemsProps) {
  const { data: session } = useSession({ required: false });
  const [items, setItems] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSessionIdRef = useRef<string | null>(null);
  const lastTypeRef = useRef<ItemType | null>(null);
  const fetchingRef = useRef<boolean>(false);

  // Get the correct API path based on type
  const getApiPath = useCallback((itemType: ItemType) => {
    // Special case for compression -> compress in API path
    if (itemType === "compression") return "compress";
    return itemType;
  }, []);

  // Define the type for API responses
  const fetchItems = useCallback(async () => {
    // Use a ref to track if we're already fetching to prevent parallel fetches
    if (fetchingRef.current) return;
    
    // If this is a duplicate fetch for the same session and type, don't refetch
    const currentSessionId = session?.user?.id ?? 'anonymous';
    if (lastSessionIdRef.current === currentSessionId && lastTypeRef.current === type && items.length > 0) {
      return;
    }
    
    // Update our refs to track this fetch
    lastSessionIdRef.current = currentSessionId;
    lastTypeRef.current = type;
    fetchingRef.current = true;
    
    setLoading(true);
    setError(null);
    
    try {
      const apiPath = getApiPath(type);
      
      // Use AbortController to handle request timeouts
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-second timeout
      
      if (session?.user) {
        // Fetch items for logged-in users
        const res = await fetch(`/api/${apiPath}/user-history`, {
          signal: controller.signal,
          headers: {
            'Cache-Control': 'no-cache' // Prevent caching to ensure fresh data
          }
        });
        
        clearTimeout(timeoutId);
        
        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }
        
        const data: ApiResponse = await res.json() as ApiResponse;
        setItems(data[`${type}s`] ?? []);
      } else {
        // Fetch items for anonymous users
        const anonymousIds: string[] = JSON.parse(
          localStorage.getItem(`anonymous${type.charAt(0).toUpperCase() + type.slice(1)}s`) ?? "[]"
        ) as string[];
        
        if (anonymousIds.length > 0) {
          const res = await fetch(`/api/${apiPath}/anonymous-history?ids=${anonymousIds.join(",")}`, {
            signal: controller.signal,
            headers: {
              'Cache-Control': 'no-cache' // Prevent caching to ensure fresh data
            }
          });
          
          clearTimeout(timeoutId);
          
          if (!res.ok) {
            throw new Error(`API error: ${res.status}`);
          }
          
          const data = await res.json() as ApiResponse;
          setItems(data[`${type}s`] ?? []);
        } else {
          // No anonymous IDs found, set empty array
          setItems([]);
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setError("Request timed out. Please try again later.");
      } else {
        console.error(`Failed to fetch ${type} history:`, error);
        setError("Failed to load history. Please try again later.");
      }
      // Keep existing items on error
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [session?.user, type, getApiPath, items.length]);

  useEffect(() => {
    // Clear any existing timeout
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    // Debounce the fetch to prevent multiple rapid calls
    fetchTimeoutRef.current = setTimeout(() => {
      void fetchItems();
    }, 300);

    // Cleanup function to clear timeout on unmount or dependency change
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [fetchItems]);

  // Function to manually refresh the list
  const refreshList = useCallback(() => {
    // Reset tracking to force a refresh
    lastSessionIdRef.current = null;
    void fetchItems();
  }, [fetchItems]);

  const renderTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const timeRemainingMs = Math.max(0, expiry.getTime() - now.getTime());
    const hoursRemaining = Math.floor(timeRemainingMs / (1000 * 60 * 60));
    const minutesRemaining = Math.floor((timeRemainingMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (timeRemainingMs <= 0) return null;
    
    return (
      <span className="inline-flex items-center">
        <Clock className="h-3 w-3 mr-1" />
        {hoursRemaining > 0 
          ? `${hoursRemaining} ${hoursRemaining === 1 ? 'hour' : 'hours'}${minutesRemaining > 0 ? ` ${minutesRemaining} ${minutesRemaining === 1 ? 'minute' : 'minutes'}` : ''} left` 
          : `${minutesRemaining} ${minutesRemaining === 1 ? 'minute' : 'minutes'} left`
        }
      </span>
    );
  };

  const renderItemDetails = (item: RecentItem) => {
    if (type === "compression") {
      const compressionItem = item as CompressionItem;
      return (
        <>
          <span className="inline-flex items-center">
            {formatBytes(compressionItem.originalSize)} → {formatBytes(compressionItem.compressedSize)}
          </span>
          <span className="inline-flex items-center">
            {compressionItem.compressionRatio}% reduction
          </span>
        </>
      );
    } else if (type === "cut") {
      const cutItem = item as CutItem;
      const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
      };
      
      return (
        <>
          <span className="inline-flex items-center">
            {formatTime(cutItem.startTime)} - {formatTime(cutItem.endTime)}
          </span>
          <span className="inline-flex items-center">
            Duration: {formatTime(cutItem.endTime - cutItem.startTime)}
          </span>
        </>
      );
    }
    
    return null;
  };
  
  const defaultTitle = type === "compression" ? "Recent Compressions" : "Recent Cuts";

  return (
    <Accordion type="single" collapsible defaultValue="items">
      <AccordionItem value="items">
        <AccordionTrigger className="text-lg font-semibold">
          <div className="flex items-center gap-2">
            {icon}
            {title ?? defaultTitle}
            {items.length > 0 && (
              <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs">
                {items.length}
              </span>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent>
          {loading ? (
            <div className="text-center py-4 text-muted-foreground">Loading recent {type}s...</div>
          ) : error ? (
            <div className="text-center py-4 text-muted-foreground">
              <p className="text-destructive">{error}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={refreshList}>
                Try Again
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <FileArchive className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No recent {type}s found.</p>
            </div>
          ) : (
            <div className="space-y-1 py-2">
              {items.map((item) => {
                const timeRemaining = renderTimeRemaining(item.expiresAt);
                
                return (
                  <div 
                    key={item.id} 
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/30 transition-colors"
                  >
                    <div className="flex-grow">
                      <div className="font-medium truncate max-w-md" title={item.originalName}>
                        {item.originalName}
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                        {renderItemDetails(item)}
                        {timeRemaining}
                      </div>
                    </div>
                    <div className="flex items-center">
                      <a href={`/api/files/${item.filePath}`} download>
                        <Button size="sm" variant="ghost">
                          <Download className="h-4 w-4" />
                        </Button>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}