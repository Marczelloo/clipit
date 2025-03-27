import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '~/server/auth';
import path from 'path';
import { 
    uploadFile, 
    getPublicUrl,
    STORAGE_BUCKETS 
} from '~/server/config/supabase-storage';

// Configure the API route to handle large file uploads
export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
  maxDuration: 300, // 5 minutes for longer upload processing
};

export async function POST(req: NextRequest){
    const session = await auth();

    if(!session?.user) return NextResponse.json({ error: "Unauthorized"}, { status: 401 });

    const { searchParams } = new URL(req.url);
    const targetPath = searchParams.get("path");

    if(!targetPath) return NextResponse.json({ error: "Path is required"}, { status: 400 });

    try
    {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if(!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

        // Determine which bucket to use based on the targetPath
        const pathParts = targetPath.split('/');
        let bucket;

        switch (pathParts[0]) {
            case 'clips':
                bucket = STORAGE_BUCKETS.CLIPS;
                break;
            case 'thumbnails':
                bucket = STORAGE_BUCKETS.THUMBNAILS;
                break;
            case 'compressed':
                bucket = STORAGE_BUCKETS.COMPRESSED;
                break;
            case 'cuts':
                bucket = STORAGE_BUCKETS.CUTS;
                break;
            default:
                bucket = STORAGE_BUCKETS.CLIPS; // Default to clips bucket
        }

        // Remove the bucket name from the storage path if it's included
        const storagePath = pathParts.length > 1 ? pathParts.slice(1).join('/') : targetPath;

        // Convert the file to buffer
        const buffer = Buffer.from(await file.arrayBuffer());
        
        // Upload to Supabase storage
        await uploadFile(
            bucket,
            storagePath,
            buffer,
            file.type
        );

        // Get the public URL for the file
        const fileUrl = getPublicUrl(bucket, storagePath);

        return NextResponse.json({ 
            success: true,
            url: fileUrl
        });
    }
    catch(error)
    {
        console.error("Error uploading file:", error);
        return NextResponse.json({ 
            error: "Error uploading file", 
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}