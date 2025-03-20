import { NextRequest, NextResponse } from "next/server";
import { auth } from "~/server/auth";
import fs from "fs";
import path from "path";
import { writeFile, mkdir } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import storageConfig from "~/server/config/storage";
import { v4 as uuidv4 } from "uuid";

const execPromise = promisify(exec);

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
        const targetPath = path.join(
            "compressed",
            userId,
            `${processId}.${format ?? 'mp4'}`
        );

        const permamentPath = path.join(storageConfig.getPath("uploads"), targetPath);
        await mkdir(path.dirname(permamentPath), { recursive: true });
        fs.copyFileSync(outputPath, permamentPath);

        const originalSize = fs.statSync(inputPath).size;
        const compressedSize = fs.statSync(outputPath).size;

        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
        fs.rmdirSync(tempDir, { recursive: true });

        return(NextResponse.json({
            success: true,
            fileUrl: `/api/files/${targetPath}`,
            originalSize,
            compressedSize,
            compressionRatio: ((originalSize - compressedSize) / originalSize * 100).toFixed(2)
        }));


    }
    catch(error)
    {
        console.error("Compression error: ", error);
        return NextResponse.json({ error: "Compression failed" }, { status: 500 });
    }
}