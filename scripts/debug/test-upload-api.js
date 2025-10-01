/**
 * Script to test the new upload API route
 */

const FormData = require('form-data');
const fs = require('fs');
const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

async function testUploadAPI() {
  console.log('🧪 Testing upload API route...\n');

  try {
    // Create a test PNG file
    const pngData = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x00, 0x00, 0x37, 0x6E, 0xF9, 0x24, 0x00, 0x00, 0x00,
      0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x01, 0x63, 0x60, 0x00, 0x00, 0x00,
      0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC, 0x33, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);

    // Write test file
    const testFilePath = 'test-logo.png';
    fs.writeFileSync(testFilePath, pngData);
    
    console.log('📁 Created test PNG file');

    // Create form data
    const formData = new FormData();
    formData.append('logo', fs.createReadStream(testFilePath), {
      filename: 'test-logo.png',
      contentType: 'image/png'
    });

    // Test district ID (assuming this exists)
    const testDistrictId = '12345678-1234-1234-1234-123456789abc';
    const apiUrl = `http://localhost:3000/api/districts/${testDistrictId}/upload-logo`;

    console.log(`📤 Testing upload to: ${apiUrl}`);

    // Make the request
    const response = await fetch(apiUrl, {
      method: 'POST',
      body: formData,
      headers: {
        ...formData.getHeaders(),
      }
    });

    const result = await response.text();
    
    console.log(`📊 Response status: ${response.status}`);
    console.log(`📄 Response body: ${result}`);

    if (response.ok) {
      console.log('✅ Upload API test successful!');
      const parsedResult = JSON.parse(result);
      console.log('   Logo URL:', parsedResult.logo_url);
    } else {
      console.log('❌ Upload API test failed');
      console.log('   Error:', result);
    }

    // Cleanup
    fs.unlinkSync(testFilePath);
    console.log('🧹 Cleaned up test file');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Note: This test requires the Next.js app to be running on localhost:3000
console.log('⚠️  Note: This test requires the Next.js app to be running on localhost:3000');
console.log('   Start the app with: npm run dev');
console.log('   Then run this test again.\n');

// Uncomment to run the test (when app is running)
// testUploadAPI().catch(console.error);