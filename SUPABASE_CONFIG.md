# Supabase Configuration

## Setup Instructions

The QR Generator application uses Supabase for cloud data storage and member photos. Configuration is done through the `conf.json` file.

### Step 1: Get Your Supabase Credentials

1. Go to your Supabase project dashboard: https://app.supabase.com
2. Navigate to **Settings** → **API**
3. Copy the following values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **Anon/Public Key** (starts with `eyJhbGciOi...`)

### Step 2: Configure conf.json

Open the `conf.json` file in the application root directory and fill in your Supabase credentials:

```json
{
  "supabase": {
    "url": "https://your-project.supabase.co",
    "anonKey": "your-anon-key-here",
    "tableName": "members",
    "bucketName": "member-photos"
  }
}
```

**Field Descriptions:**
- `url`: Your Supabase project URL
- `anonKey`: Your Supabase anonymous/public API key
- `tableName`: Name of the database table containing member data (default: `members`)
- `bucketName`: Name of the Storage bucket containing member photos (default: `member-photos`)

### Step 3: Verify Connection

1. Open `index.html` in your browser
2. Open the browser console (F12)
3. Look for the message: `✅ Supabase configuration loaded from conf.json`
4. Switch to "Bulk Creation" mode
5. Click "🔄 Reload Data"
6. Data should load from Supabase

### Troubleshooting

**If conf.json is not loading:**
- Make sure `conf.json` is in the same directory as `index.html`
- If using a local server, restart it after editing `conf.json`
- Check browser console for errors

**If Supabase connection fails:**
- Verify your URL and anon key are correct
- Check that your Supabase table exists and is named correctly
- Ensure your Supabase project is active (not paused)

**If photos are not loading:**
- Verify the Storage bucket name matches your configuration
- Check that photos have the correct file extensions (`.jpg`, `.png`, etc.)
- Ensure photos are named with member UUIDs (e.g., `851ad149-e3b2-4afb-8e2d-2b1bc862edfd.jpg`)
- Verify bucket permissions allow public read access

### Security Notes

⚠️ **Important:** The `conf.json` file contains sensitive credentials. 

**For local use:**
- Keep `conf.json` out of version control (add to `.gitignore`)
- Only share the configured app with trusted users

**For production deployment:**
- Use environment variables instead of `conf.json`
- Consider implementing authentication
- Use Supabase Row Level Security (RLS) policies

### Fallback Mode

If `conf.json` is not configured or Supabase is unavailable, the application will automatically fall back to using a local `EMS_Data.xlsx` file if present.
