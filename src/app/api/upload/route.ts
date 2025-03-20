import { NextRequest, NextResponse } from 'next/server';
import { auth } from '~/server/auth';
import fs from 'fs';
import path from 'path';
import { writeFile } from "fs/promises";
import storageConfig from '~/server/config/storage';

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

        const uploadPath = path.join(storageConfig.getPath("uploads"), targetPath);

        const dir = path.dirname(uploadPath);
        if(!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(uploadPath, buffer);

        return NextResponse.json({ success: true });
    }
    catch(error)
    {
        console.error("Error uploading file:", error);
        return NextResponse.json({ error: "Error uploading file"}, { status: 500 });
    }
}