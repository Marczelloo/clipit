import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "~/server/auth";
import path from "path";
import { writeFile, mkdir, unlink } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import { v4 as uuidv4 } from "uuid";
import { db } from "~/server/db";
import os from "os";
import fs from "fs";
import { 
  uploadFile, 
  getPublicUrl,
  STORAGE_BUCKETS 
} from "~/server/config/supabase-storage";

const execPromise = promisify(exec);

export const config = {
    api: {
      bodyParser: false,
      responseLimit: false,
    },
    // Maximum duration allowed on Vercel free tier
    maxDuration: 60, // 60 seconds (Vercel free tier limit)
  };

export async function POST(req: NextRequest)
{
    const session = await auth();

    try
    {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const quality = formData.get("quality") as string;
        const format = formData.get("format") as string;
        const resolution = formData.get("resolution") as string;
        const fps = formData.get("fps") as string;

        if(!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

        const processId = uuidv4();
        
        // Use OS temp directory instead of local storage
        const tempDir = path.join(os.tmpdir(), 'clipit-compression', processId);
        await mkdir(tempDir, { recursive: true });

        const fileExt = path.extname(file.name).toLowerCase();
        const outputFormat = format || fileExt.replace(".", "");

        const inputPath = path.join(tempDir, `input${fileExt}`);
        const outputPath = path.join(tempDir, `output.${outputFormat}`);

        // Write the input file to temp directory
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(inputPath, buffer);

        // Build FFmpeg command
        let ffmpegCmd = `ffmpeg -i "${inputPath}" `;

        if(quality)
        {
            const crf = 51 - (parseInt(quality) / 2);
            ffmpegCmd += `-c:v libx264 -crf ${crf} `;
        }

        if(resolution && resolution != "original")
        {
            const height = parseInt(resolution.replace('p', ''));
            ffmpegCmd += `-vf scale=-1:${height} `;
        }

        if(fps && fps != "original") ffmpegCmd += `-r ${fps} `;

        if(format === "webm")
        {
            ffmpegCmd += `-c:v libvpx-vp9 `;
        }
        else if(format === "gif")
        {
            ffmpegCmd += `-vf "fps=10,scale=320:-1:flags=lanczos" `;
        }

        ffmpegCmd += `"${outputPath}" -y`;

        // Execute FFmpeg command
        await execPromise(ffmpegCmd);

        // Define storage path in Supabase
        const storagePath = session?.user?.id 
            ? `${session.user.id}/${processId}.${outputFormat}`
            : `anonymous/${processId.substring(0, 8)}/${processId}.${outputFormat}`;

        // Read the output file
        const outputBuffer = await fs.promises.readFile(outputPath);
        
        // Upload the compressed file to Supabase storage
        await uploadFile(
            STORAGE_BUCKETS.COMPRESSED,
            storagePath,
            outputBuffer,
            `video/${outputFormat === 'gif' ? 'gif' : outputFormat === 'webm' ? 'webm' : 'mp4'}`
        );

        // Get the public URL
        const fileUrl = getPublicUrl(STORAGE_BUCKETS.COMPRESSED, storagePath);

        // Get file sizes for stats
        const originalSize = fs.statSync(inputPath).size;
        const compressedSize = fs.statSync(outputPath).size;

        // Clean up temp files
        await unlink(inputPath).catch(() => {});
        await unlink(outputPath).catch(() => {});
        await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});

        // Set expiration time to 6 hours from now
        const expirationTime = new Date();
        expirationTime.setHours(expirationTime.getHours() + 6); 

        // Save record to database
        await db.compression.create({
            data: {
                userId: session?.user?.id ?? undefined,  // Use undefined instead of "anonymous"
                anonymousId: !session?.user?.id ? processId : null,
                originalName: file.name,
                originalSize,
                compressedSize,
                compressionRatio: parseFloat(((originalSize - compressedSize) / originalSize * 100).toFixed(2)),
                format: outputFormat,
                quality: parseInt(quality) || 75,
                filePath: storagePath, // Store the Supabase path instead of local path
                expiresAt: expirationTime,
            }
        });

        return NextResponse.json({
            success: true,
            fileUrl: fileUrl, // Return the full Supabase URL
            originalSize,
            compressedSize,
            compressionRatio: ((originalSize - compressedSize) / originalSize * 100).toFixed(2),
            anonymousId: !session?.user?.id ? processId : null
        });
    }
    catch(error)
    {
        console.error("Compression error: ", error);
        return NextResponse.json({ error: "Compression failed" }, { status: 500 });
    }
}