import { supabase, STORAGE_BUCKETS } from './supabase-storage';

/**
 * Script to verify and set public access on Supabase buckets
 * Run this script to ensure all your buckets are configured correctly
 */
async function checkAndSetupBuckets() {
  console.log('Checking Supabase storage buckets...');
  
  // Get list of all buckets
  const { data: buckets, error } = await supabase.storage.listBuckets();
  
  if (error) {
    console.error('Error fetching buckets:', error.message);
    return;
  }
  
  console.log(`Found ${buckets.length} buckets in Supabase`);
  
  // Check if our required buckets exist
  const requiredBuckets = Object.values(STORAGE_BUCKETS);
  
  for (const bucketName of requiredBuckets) {
    const bucket = buckets.find(b => b.name === bucketName);
    
    if (!bucket) {
      console.log(`Creating missing bucket: ${bucketName}`);
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true, // Make the bucket public
      });
      
      if (createError) {
        console.error(`Error creating bucket ${bucketName}:`, createError.message);
      } else {
        console.log(`✅ Created bucket: ${bucketName} with public access`);
      }
    } else {
      console.log(`Bucket exists: ${bucketName}, checking public status...`);
      
      // Update bucket to ensure it's public
      const { error: updateError } = await supabase.storage.updateBucket(bucketName, {
        public: true,
      });
      
      if (updateError) {
        console.error(`Error updating bucket ${bucketName}:`, updateError.message);
      } else {
        console.log(`✅ Updated bucket: ${bucketName} to have public access`);
      }
    }
  }
  
  // Create a test to verify permissions are working
  console.log('\nTesting file access...');
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
      
      console.log(`Testing URL for ${bucketName}: ${data.publicUrl}`);
      
      // Make a request to check if the URL is accessible
      const response = await fetch(data.publicUrl);
      if (response.ok) {
        console.log(`✅ ${bucketName} bucket is correctly configured and publicly accessible`);
      } else {
        console.error(`❌ ${bucketName} bucket returned ${response.status}: ${response.statusText}`);
      }
      
      // Clean up test file
      await supabase.storage
        .from(bucketName)
        .remove([testPath]);
      
    } catch (err) {
      console.error(`Error testing ${bucketName}:`, err);
    }
  }
}

// Export as module and also allow running directly
export { checkAndSetupBuckets };

// Run if called directly
if (require.main === module) {
  checkAndSetupBuckets()
    .then(() => console.log('Bucket verification complete'))
    .catch(err => console.error('Error in bucket verification:', err));
}