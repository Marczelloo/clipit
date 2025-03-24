import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export const storageRouter = createTRPCRouter({
    getUploadUrl: protectedProcedure
        .input(z.object({ filename: z.string()}))
        .mutation(async ({ input }) => {
            const fileId = uuidv4();
            const extension = path.extname(input.filename);
            const storagePath = `clips/${fileId}${extension}`;

            return {
                fileId,
                uploadUrl: `/api/upload?path=${storagePath}`,
                fileUrl: `/api/files/clips/${fileId}${extension}`,
            }
        }),
    
    getClipUrl: protectedProcedure
        .input(z.object({ fileId: z.string() }))
        .query(({ input }) => {
            return {
                url: `/api/files/clips/${input.fileId}`,
            }
        }),
});