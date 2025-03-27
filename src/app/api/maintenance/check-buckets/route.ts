import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "~/server/auth";
import { supabase, STORAGE_BUCKETS } from "~/server/config/supabase-storage";

export async function GET(_req: NextRequest) {
  // Check authorization
  const session = await auth();
  
  // This endpoint should only be accessible by authorized users
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  try {
    // Results will hold our findings and actions
    const results = {
      buckets: [] as any[],
      testResults: [] as any[],
    };

    // Get list of all buckets
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      return NextResponse.json({ error: `Error fetching buckets: ${error.message}` }, { status: 500 });
    }
    
    // Check if our required buckets exist
    const requiredBuckets = Object.values(STORAGE_BUCKETS);
    
    for (const bucketName of requiredBuckets) {
      const bucket = buckets.find(b => b.name === bucketName);
      
      if (!bucket) {
        // Create missing bucket
        const { error: createError } = await supabase.storage.createBucket(bucketName, {
          public: true,
        });
        
        results.buckets.push({
          name: bucketName,
          action: "created",
          success: !createError,
          error: createError?.message
        });
      } else {
        // Update bucket to ensure it's public
        const { error: updateError } = await supabase.storage.updateBucket(bucketName, {
          public: true,
        });
        
        results.buckets.push({
          name: bucketName,
          action: "updated",
          success: !updateError,
          error: updateError?.message
        });
      }
    }
    
    // Test public access for each bucket
    for (const bucketName of requiredBuckets) {
      const testPath = `_test_${Date.now()}.txt`;
      const testContent = 'This is a test file to verify bucket permissions';
      
      try {
        // Upload a test file
        await supabase.storage
          .from(bucketName)
          .upload(testPath, testContent);
        
        // Get the URL for the file
        const { data } = supabase.storage
          .from(bucketName)
          .getPublicUrl(testPath);
        
        // Test if the URL is accessible
        const publicUrl = data.publicUrl;
        const response = await fetch(publicUrl);
        
        results.testResults.push({
          bucket: bucketName,
          url: publicUrl,
          status: response.status,
          accessible: response.ok
        });
        
        // Clean up test file
        await supabase.storage
          .from(bucketName)
          .remove([testPath]);
      } catch (err: any) {
        results.testResults.push({
          bucket: bucketName,
          error: err.message
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      results
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Failed to check buckets", details: error.message },
      { status: 500 }
    );
  }
}