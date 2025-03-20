"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { useRouter } from "next/navigation";

export default function TestUploadPage() {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<string | null>(null);
    const router = useRouter();

    const getUploadUrl = api.storage.getUploadUrl.useMutation();

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if(event.target.files?.[0])
        {
            setFile(event.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if(!file) return;

        try
        {
            setUploading(true);

            const { uploadUrl, fileUrl } = await getUploadUrl.mutateAsync({ filename: file.name });

            const formData = new FormData();
            formData.append("file", file);

            const uploadResponse = await fetch(uploadUrl, {
                method: "POST",
                body: formData,
            })

            if(!uploadResponse.ok) throw new Error("Upload failed");

            setUploadedFile(fileUrl);
            router.refresh();
        }
        catch(error)
        {
            console.error("Error uploading file:", error);
            alert("Error uploading file");
        }
        finally
        {
            setUploading(false);
        }
    }

    return (
        <div className="container mx-auto p-4">
          <h1 className="text-2xl font-bold mb-4">Test File Upload</h1>
    
          <div className="mb-6 p-4 border rounded-lg">
            <div className="mb-4">
              <label className="block mb-2">Select a video file:</label>
              <input 
                type="file" 
                accept="video/*"
                onChange={handleFileChange}
                className="border p-2 w-full"
              />
            </div>
    
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-400"
            >
              {uploading ? "Uploading..." : "Upload File"}
            </button>
          </div>
    
          {uploadedFile && (
            <div className="mt-6">
              <h2 className="text-xl font-semibold mb-2">Uploaded File:</h2>
              <div className="p-4 border rounded-lg">
                <video 
                  src={uploadedFile} 
                  controls 
                  className="w-full max-h-[500px]"
                />
                <p className="mt-2">File URL: {uploadedFile}</p>
              </div>
            </div>
          )}
        </div>
      );
}