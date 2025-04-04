const { Dropbox } = require('dropbox');
require('dotenv').config();

// Get access token from environment variable
const accessToken = process.env.DROPBOX_ACCESS_TOKEN;

console.log('Starting Dropbox permission check script...');

if (!accessToken) {
  console.error('ERROR: DROPBOX_ACCESS_TOKEN environment variable is not set.');
  console.error('Please add it to your .env file');
  process.exit(1);
} else {
  console.log(`Access token found in .env (length: ${accessToken.length})`);
  console.log(`Token prefix: ${accessToken.substring(0, 10)}...`);
}

console.log('Checking Dropbox connection and permissions...');

// Initialize Dropbox with access token
const dbx = new Dropbox({ accessToken });

// Function to check for necessary scopes in error messages
function checkForScopeIssues(error) {
  const errorStr = JSON.stringify(error, null, 2);
  console.log('Full error object:', errorStr);
  
  if (errorStr.includes('files.content.write')) {
    console.error(`
MISSING PERMISSION: Your app needs the 'files.content.write' scope.
Please go to https://www.dropbox.com/developers/apps, select your app, and:
1. Go to the "Permissions" tab
2. Check the "files.content.write" permission
3. Click "Submit" to update your app permissions
4. Regenerate your access token
5. Update the DROPBOX_ACCESS_TOKEN in your .env file
`);
    return true;
  }
  
  if (errorStr.includes('sharing.write')) {
    console.error(`
MISSING PERMISSION: Your app needs the 'sharing.write' scope.
Please go to https://www.dropbox.com/developers/apps, select your app, and:
1. Go to the "Permissions" tab
2. Check the "sharing.write" permission
3. Click "Submit" to update your app permissions
4. Regenerate your access token
5. Update the DROPBOX_ACCESS_TOKEN in your .env file
`);
    return true;
  }
  
  if (errorStr.includes('401') || errorStr.includes('Invalid access token')) {
    console.error(`
AUTHENTICATION ERROR: Your access token is invalid or expired.
Please go to https://www.dropbox.com/developers/apps, select your app, and:
1. Generate a new access token
2. Update the DROPBOX_ACCESS_TOKEN in your .env file
`);
    return true;
  }
  
  return false;
}

// Check Dropbox scopes/permissions
async function checkDropboxPermissions() {
  try {
    // First check if we can get account info (basic test)
    console.log('Checking account access...');
    const account = await dbx.usersGetCurrentAccount();
    console.log(`✅ Connected to Dropbox as: ${account.result.email}`);
    
    // Test folder creation (requires files.content.write)
    console.log('\nChecking files.content.write permission...');
    const testFolder = `/ScribeCLA/test-folder-${Date.now()}`;
    
    try {
      const folderResult = await dbx.filesCreateFolderV2({
        path: testFolder,
        autorename: true
      });
      console.log(`✅ Successfully created test folder: ${folderResult.result.metadata.path_display}`);
      
      // Clean up - delete the test folder
      await dbx.filesDeleteV2({
        path: folderResult.result.metadata.path_display
      });
      console.log(`✅ Successfully deleted test folder`);
      
    } catch (error) {
      console.error('❌ Failed to create test folder. This indicates missing files.content.write permission.');
      console.error('Error message:', error.message);
      
      if (error.status === 409) {
        console.error('⚠️ A folder with this name might already exist. This is not a permissions issue.');
      }
      
      if (!checkForScopeIssues(error)) {
        console.error('Unknown error creating folder:', error);
      }
      return false;
    }
    
    // Test file upload (requires files.content.write)
    console.log('\nChecking file upload permission...');
    const testFilePath = `/ScribeCLA/test-file-${Date.now()}.txt`;
    const testContent = Buffer.from('This is a test file for SCRIBE');
    
    try {
      const uploadResult = await dbx.filesUpload({
        path: testFilePath,
        contents: testContent
      });
      console.log(`✅ Successfully uploaded test file: ${uploadResult.result.path_display}`);
      
      // Test shared link creation (requires sharing.write)
      console.log('\nChecking sharing.write permission...');
      try {
        const shareResult = await dbx.sharingCreateSharedLink({
          path: uploadResult.result.path_display
        });
        console.log(`✅ Successfully created shared link: ${shareResult.result.url}`);
      } catch (shareError) {
        console.error('❌ Failed to create shared link. This indicates missing sharing.write permission.');
        console.error('Error message:', shareError.message);
        
        if (!checkForScopeIssues(shareError)) {
          console.error('Unknown error creating shared link:', shareError);
        }
      }
      
      // Clean up - delete the test file
      await dbx.filesDeleteV2({
        path: uploadResult.result.path_display
      });
      console.log(`✅ Successfully deleted test file`);
      
    } catch (error) {
      console.error('❌ Failed to upload test file. This indicates missing files.content.write permission.');
      console.error('Error message:', error.message);
      
      if (!checkForScopeIssues(error)) {
        console.error('Unknown error uploading file:', error);
      }
      return false;
    }
    
    console.log('\n✅ All required Dropbox permissions are available!');
    console.log('Your app has the necessary permissions to upload and share files.');
    return true;
    
  } catch (error) {
    console.error('❌ Failed to connect to Dropbox or check permissions.');
    console.error('Error message:', error.message);
    
    if (!checkForScopeIssues(error)) {
      console.error('Unknown error connecting to Dropbox:', error);
    }
    return false;
  }
}

// Run the check
console.log('Running Dropbox permission check...');
checkDropboxPermissions()
  .then(success => {
    if (success) {
      console.log('\nYour Dropbox integration is properly configured!');
    } else {
      console.error('\nDropbox permission issues detected. Please fix the issues above.');
    }
  })
  .catch(error => {
    console.error('Error running permission check:', error);
  }); 