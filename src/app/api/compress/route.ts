import { NextRequest, NextResponse } from "next/server";
import { auth } from "~/server/auth";
import fs from "fs";
import path from "path";
import { writeFile, mkdir } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import storageConfig from "~/server/config/storage";
import { v4 as uuidv4 } from "uuid";
import { db } from "~/server/db";

const execPromise = promisify(exec);

export const config = {
    api: {
      bodyParser: false,
      responseLimit: '50mb',
    },
    // Increase the maximum duration for this API route
    maxDuration: 120, // 120 seconds (2 minutes)
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

        const tempDir = path.join(storageConfig.getPath("temp"), processId);
        await mkdir(tempDir, { recursive: true });

        const fileExt = path.extname(file.name).toLowerCase();

        const inputPath = path.join(tempDir, `input${fileExt}`);
        const outputPath = path.join(tempDir, `output.${format || fileExt }`);

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(inputPath, buffer);

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

        await execPromise(ffmpegCmd);

        const userId = session?.user?.id ?? "anonymous";

        const targetFolder = session?.user?.id 
            ? path.join("compressed", userId)
            : path.join("compressed", "anonymous", processId.substring(0, 8));
            
        const targetPath = path.join(
            targetFolder,
            `${processId}.${format ?? 'mp4'}`
        );

        const permanentPath = path.join(storageConfig.getPath("uploads"), targetPath);
        await mkdir(path.dirname(permanentPath), { recursive: true });
        fs.copyFileSync(outputPath, permanentPath);

        const originalSize = fs.statSync(inputPath).size;
        const compressedSize = fs.statSync(outputPath).size;

        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
        fs.rmdirSync(tempDir, { recursive: true });

        const expirationTime = new Date();
        expirationTime.setHours(expirationTime.getHours() + 6); // 6 hours expiration      

        await db.compression.create({
            data: {
                userId: session?.user?.id ?? undefined,  // Use undefined instead of "anonymous"
                anonymousId: !session?.user?.id ? processId : null,
                originalName: file.name,
                originalSize,
                compressedSize,
                compressionRatio: parseFloat(((originalSize - compressedSize) / originalSize * 100).toFixed(2)),
                format: format || path.extname(file.name).replace('.', ''),
                quality: parseInt(quality) || 75,
                filePath: targetPath,
                expiresAt: expirationTime,
            }
        });

        return(NextResponse.json({
            success: true,
            fileUrl: `/api/files/${targetPath}`,
            originalSize,
            compressedSize,
            compressionRatio: ((originalSize - compressedSize) / originalSize * 100).toFixed(2),
            anonymousId: !session?.user?.id ? processId : null
        }));
    }
    catch(error)
    {
        console.error("Compression error: ", error);
        return NextResponse.json({ error: "Compression failed" }, { status: 500 });
    }
}