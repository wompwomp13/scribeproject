const { Dropbox } = require('dropbox');
require('dotenv').config();

// Initialize Dropbox with access token from environment variables
const dbx = new Dropbox({ 
    accessToken: process.env.DROPBOX_ACCESS_TOKEN 
});

/**
 * Uploads a file to Dropbox and returns a download URL
 * @param {Buffer} fileBuffer - The file data
 * @param {string} fileName - Original file name (should include lecture title)
 * @param {string} [folderPath='lectures'] - Folder to store in
 * @returns {Promise<string>} - Direct download URL
 */
async function uploadFile(fileBuffer, fileName, folderPath = 'lectures') {
    try {
        // Create the path - keep the provided filename which includes lecture title
        const path = `/ScribeCLA/${folderPath}/${fileName}`;
        
        console.log(`Uploading file to Dropbox path: ${path}`);
        
        // Upload the file to Dropbox with autorename option to handle duplicates
        const uploadResult = await dbx.filesUpload({
            path,
            contents: fileBuffer,
            autorename: true,
            mode: {'.tag': 'add'}
        });
        
        console.log('File uploaded successfully to Dropbox', uploadResult.result.path_display);
        
        // Create a shared link for the file
        const shareResult = await dbx.sharingCreateSharedLink({
            path: uploadResult.result.path_display
        });
        
        console.log('Shared link created:', shareResult.result.url);
        
        // Convert to direct download link
        let downloadUrl = shareResult.result.url;
        downloadUrl = downloadUrl.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
        downloadUrl = downloadUrl.replace('?dl=0', '');
        
        console.log('Download URL:', downloadUrl);
        
        return downloadUrl;
    } catch (error) {
        // Enhanced error logging for Dropbox API errors
        console.error('Dropbox upload error details:');
        
        if (error.response && error.response.body) {
            console.error('Error body:', JSON.stringify(error.response.body, null, 2));
        }
        
        if (error.message.includes('files.content.write')) {
            console.error(`
DROPBOX PERMISSIONS ERROR: Your app needs the 'files.content.write' scope.
Please go to https://www.dropbox.com/developers/apps, select your app, and:
1. Go to the "Permissions" tab
2. Check the "files.content.write" permission
3. Click "Submit" to update your app permissions
4. You may need to re-authorize your app to apply the new permissions
`);
        }
        
        console.error('Dropbox upload error:', error);
        throw new Error('Failed to upload to Dropbox: ' + (error.message || 'Unknown error'));
    }
}

/**
 * Gets a file from Dropbox using its URL
 * @param {string} fileUrl - Dropbox URL of the file
 * @returns {Promise<Buffer>} - File contents
 */
async function getFile(fileUrl) {
    try {
        // Extract path from URL
        const urlParts = fileUrl.split('dropboxusercontent.com');
        if (urlParts.length < 2) throw new Error('Invalid Dropbox URL format');
        
        const pathPart = urlParts[1];
        const path = decodeURIComponent(pathPart);
        
        // Download the file
        const response = await dbx.filesDownload({
            path: path
        });
        
        return response.result.fileBinary;
    } catch (error) {
        console.error('Dropbox download error:', error);
        throw new Error('Failed to download from Dropbox: ' + error.message);
    }
}

module.exports = {
    uploadFile,
    getFile
}; 