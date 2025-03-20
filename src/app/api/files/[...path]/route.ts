import { NextRequest, NextResponse } from "next/server";
import fs from 'fs';
import path from 'path';
import { auth } from '~/server/auth';
import storageConfig from '~/server/config/storage';

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) 
{
    const session = await auth();
    if(!session?.user) return NextResponse.json({ error: "Unauthorized"}, { status: 401 });

    // The params object must be directly deconstructed from the function parameters
    // and not further deconstructed in the function body to avoid the error
    const filePath = path.join(
      storageConfig.getPath("uploads"), 
      ...(params.path || [])
    );

    if(!fs.existsSync(filePath)) return NextResponse.json({ error: "File not found" }, { status: 404 });

    const stat = fs.statSync(filePath);
    const fileBuffer = fs.readFileSync(filePath);

    const ext = path.extname(filePath).toLowerCase();
    const contentTypeMap: Record<string, string> = {
        ".mp4": "video/mp4",
        ".mov": "video/quicktime",
        ".webm": "video/webm",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
    }

    const contentType = contentTypeMap[ext] ?? "application/octet-stream";

    // Use NextResponse constructor for binary data instead of json()
    return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
            "Content-Type": contentType,
            "Content-Length": stat.size.toString(),
        }
    });
}