import path from 'path';
import fs from "fs";

const DEV_STORAGE_PATH = path.join(process.cwd(), "storage");

const STORAGE_PATH = process.env.STORAGE_PATH ?? DEV_STORAGE_PATH;

const directories = [
    path.join(STORAGE_PATH, "uploads", "clips"),
    path.join(STORAGE_PATH, "uploads", "thumbnails"),
    path.join(STORAGE_PATH, "Uploads", "processed"),
    path.join(STORAGE_PATH, "temp"),
]

for (const dir of directories)
{
    if(!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true})
}

const storageConfig = {
    getPath: (...parts: string[]) => path.join(STORAGE_PATH, ...parts),
    uploads: {
        clips: path.join(STORAGE_PATH, "uploads", "clips"),
        thumbnails: path.join(STORAGE_PATH, "uploads", "thumbnails"),
        processed: path.join(STORAGE_PATH, "uploads", "processed"),
    },
    temp: path.join(STORAGE_PATH, "temp"),
};

export default storageConfig;