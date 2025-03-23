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

export async function POST(req: NextRequest) {
    const session = await auth();

    try 
    {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const startTime = parseFloat(formData.get("startTime") as string);
        const endTime = parseFloat(formData.get("endTime") as string);
        const duration = parseFloat(formData.get("duration") as string);

        if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
        if (isNaN(startTime) || isNaN(endTime)) {
            return NextResponse.json({ error: "Invalid start or end time" }, { status: 400 });
        }

        const processId = uuidv4();

        const tempDir = path.join(storageConfig.getPath("temp"), processId);
        await mkdir(tempDir, { recursive: true });

        const fileExt = path.extname(file.name).toLowerCase();
        const format = fileExt.replace(".", "");

        const inputPath = path.join(tempDir, `input${fileExt}`);
        const outputPath = path.join(tempDir, `output${fileExt}`);

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(inputPath, buffer);

        // Calculate duration in seconds and format for ffmpeg
        const clipDuration = endTime - startTime;
        
        // FFmpeg command to cut video
        // -ss: start time, -t: duration, -c copy: copy codecs without re-encoding for speed
        const ffmpegCmd = `ffmpeg -ss ${startTime} -t ${clipDuration} -i "${inputPath}" -c copy "${outputPath}" -y`;

        await execPromise(ffmpegCmd);

        const userId = session?.user?.id ?? "anonymous";

        const targetFolder = session?.user?.id 
            ? path.join("cuts", userId)
            : path.join("cuts", "anonymous", processId.substring(0, 8));
            
        const targetPath = path.join(
            targetFolder,
            `${processId}${fileExt}`
        );

        const permanentPath = path.join(storageConfig.getPath("uploads"), targetPath);
        await mkdir(path.dirname(permanentPath), { recursive: true });
        fs.copyFileSync(outputPath, permanentPath);

        const originalSize = fs.statSync(inputPath).size;
        const cutSize = fs.statSync(outputPath).size;

        // Clean up temp files
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
        fs.rmSync(tempDir, { recursive: true, force: true }); 

        // Set expiration time to 6 hours from now
        const expirationTime = new Date();
        expirationTime.setHours(expirationTime.getHours() + 6);

        // Save record to database
        await db.cut.create({
            data: {
                userId: session?.user?.id || undefined,
                anonymousId: !session?.user?.id ? processId : null,
                originalName: file.name,
                originalSize,
                cutSize,
                startTime,
                endTime,
                originalDuration: duration,
                format,
                filePath: targetPath,
                expiresAt: expirationTime,
            }
        });

        return NextResponse.json({
            success: true,
            fileUrl: `/api/files/${targetPath}`,
            originalSize,
            cutSize,
            startTime,
            endTime,
            duration: clipDuration,
            anonymousId: !session?.user?.id ? processId : null
        });
    } 
    catch (error) 
    {
        console.error("Video cutting error: ", error);
        return NextResponse.json({ error: "Video cutting failed" }, { status: 500 });
    }
}