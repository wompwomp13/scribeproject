# Dropbox Setup Guide for SCRIBE

This guide will help you set up your Dropbox app with the correct permissions needed for SCRIBE.

## Step 1: Update Dropbox App Permissions

1. Go to https://www.dropbox.com/developers/apps
2. Select your app (named "SCRIBE" or whatever you named it)
3. Go to the "Permissions" tab
4. Check the following permissions:
   - `files.content.write` - Required for uploading files
   - `files.content.read` - Required for accessing files
   - `sharing.write` - Required for creating shared links
   - `account_info.read` - Required for basic account access
5. Click "Submit" to update your app permissions

## Step 2: Generate a New Access Token

After updating permissions:

1. Go to the "Settings" tab
2. In the "OAuth 2" section, click "Generate" under "Generated access token"
3. Copy the newly generated token

## Step 3: Update Your .env File

1. Open the `.env` file in your project
2. Replace the current `DROPBOX_ACCESS_TOKEN` with your new token
3. Make sure `DROPBOX_ENABLED=true` is set

```
DROPBOX_APP_KEY=your_app_key
DROPBOX_APP_SECRET=your_app_secret
DROPBOX_ACCESS_TOKEN=your_new_access_token
DROPBOX_ENABLED=true
```

## Step 4: Verify Your Setup

Run the verification script to make sure everything is working:

```
node utils/check-dropbox.js
```

You should see successful confirmations for:
- Account access
- Folder creation (files.content.write permission)
- File upload (files.content.write permission)
- Shared link creation (sharing.write permission)

## Troubleshooting

If you encounter errors:

1. **Authentication Error**: Your access token might be invalid or expired. Generate a new one.
2. **Missing Permissions**: Make sure you've checked all the required permissions and submitted the changes.
3. **App Approval**: For production apps with many users, you might need to submit your app for approval. For personal use, this isn't necessary.

## Important Notes

- Keep your access token secure! It provides access to your Dropbox account.
- The access token in your .env file is very long - make sure you copy it completely.
- If you're moving from development to production, you'll need to change the app status from "Development" to "Production" in the Dropbox App Console. 