import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import path from 'path';
import { auth } from '~/server/auth';
import { supabase, STORAGE_BUCKETS } from '~/server/config/supabase-storage';

export async function GET(_request: NextRequest, { params }: { params: { path: string[] } }) 
{
    const session = await auth();
    
    // Determine if this is an anonymous request (for public files like compressed/cut videos)
    const isAnonymousFile = params.path[0] === "compressed" && params.path[1] === "anonymous" || 
                            params.path[0] === "cuts" && params.path[1] === "anonymous";

    // Require authentication for non-anonymous files
    if(!session?.user && !isAnonymousFile) {
        return NextResponse.json({ error: "Unauthorized"}, { status: 401 });
    }

    try {
        // Determine which bucket to use based on the first path segment
        let bucket;
        let storagePath;

        switch(params.path[0]) {
            case 'clips':
                bucket = STORAGE_BUCKETS.CLIPS;
                storagePath = params.path.slice(1).join('/');
                break;
            case 'thumbnails':
                bucket = STORAGE_BUCKETS.THUMBNAILS;
                storagePath = params.path.slice(1).join('/');
                break;
            case 'compressed':
                bucket = STORAGE_BUCKETS.COMPRESSED;
                storagePath = params.path.slice(1).join('/');
                break;
            case 'cuts':
                bucket = STORAGE_BUCKETS.CUTS;
                storagePath = params.path.slice(1).join('/');
                break;
            default:
                return NextResponse.json({ error: "Invalid file path" }, { status: 400 });
        }

        // Download the file from Supabase Storage
        const { data, error } = await supabase.storage
            .from(bucket)
            .download(storagePath);

        if (error || !data) {
            console.error("Supabase Storage error:", error);
            return NextResponse.json({ error: "File not found" }, { status: 404 });
        }

        // Determine the content type
        const ext = path.extname(params.path[params.path.length - 1]).toLowerCase();
        const contentTypeMap: Record<string, string> = {
            ".mp4": "video/mp4",
            ".mov": "video/quicktime",
            ".webm": "video/webm",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
        }

        const contentType = contentTypeMap[ext] ?? "application/octet-stream";

        // Return the file with appropriate headers
        return new NextResponse(data, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Content-Length": data.size.toString(),
                "Content-Disposition": `attachment; filename="${path.basename(params.path[params.path.length - 1])}"`,
                "Cache-Control": "public, max-age=31536000" // Cache for 1 year for better performance
            }
        });
    } catch (error) {
        console.error("Error serving file from Supabase Storage:", error);
        return NextResponse.json(
            { error: "Failed to retrieve file", details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}