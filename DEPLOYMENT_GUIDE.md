# QR Generator - Deployment Guide

## ⚠️ IMPORTANT: Cannot Run by Double-Clicking index.html

**Modern browsers block file access (CORS) when opening HTML files directly.**

You **MUST** use one of these methods:
- Run the included `start.sh` (Linux/Mac) or `start.bat` (Windows) scripts
- Host online (Netlify, GitHub Pages, etc.)
- Run a local web server (see `HOW_TO_RUN.md`)

---

## Option 1: Local Deployment (Recommended for Windows Users)

### What the User Needs:
- A modern web browser (Chrome, Edge, Firefox)
- Internet connection (for Supabase data and CDN libraries)
- No technical installation required!

### Setup Instructions:

1. **Download the Application:**
   - Provide the user with a ZIP file of the entire `qr_generator_app` folder
   - Or copy the folder to a USB drive

2. **Extract the Files:**
   - Extract to any location on their computer
   - Example: `C:\Users\[Username]\Documents\QR_Generator`

3. **Open the Application:**
   - Navigate to the extracted folder
   - **DO NOT double-click `index.html`** (will cause CORS errors)
   - Instead, double-click `start.bat` (or `start.sh` on Linux/Mac)
   - This starts a local web server and opens the app automatically
   - See `HOW_TO_RUN.md` for more details

4. **Create a Desktop Shortcut (Optional):**
   - Right-click `start.bat`
   - Select "Create shortcut"
   - Rename to "QR Generator"
   - Move shortcut to Desktop
   - User can now double-click the shortcut to launch the app

### Troubleshooting Local Deployment:

**Issue: Browser security blocks local file access**

**Solution A - Use a simple local server:**
1. Install Python (if not already installed): https://www.python.org/downloads/
2. Open Command Prompt in the app folder
3. Run: `python -m http.server 8000`
4. Open browser to: `http://localhost:8000`

**Solution B - Use the "start.bat" file:**
- See Option 3 below for the batch file approach

---

## Option 2: Online Hosting (Best for Multiple Users)

Deploy to a free static hosting service for URL access:

### GitHub Pages (Free):

1. **Create a GitHub Repository:**
   ```bash
   cd /home/andrewskerr77/Dev/qr_generator_app
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/[username]/qr-generator.git
   git push -u origin main
   ```

2. **Enable GitHub Pages:**
   - Go to repository Settings
   - Navigate to "Pages" section
   - Source: Deploy from branch `main`
   - Folder: `/ (root)`
   - Save

3. **Access URL:**
   - Your app will be live at: `https://[username].github.io/qr-generator/`
   - Share this URL with users

### Netlify (Free, Easiest):

1. **Sign up:** https://netlify.com
2. **Drag & Drop Deployment:**
   - Drag the `qr_generator_app` folder onto Netlify dashboard
   - Netlify automatically deploys
3. **Custom Domain (Optional):**
   - Configure a custom domain name
   - Example: `qr-generator.netlify.app`

### Vercel (Free):

1. **Sign up:** https://vercel.com
2. **Deploy:**
   ```bash
   npm i -g vercel
   cd /home/andrewskerr77/Dev/qr_generator_app
   vercel
   ```
3. **Follow prompts** - site deploys automatically

**Advantages of Online Hosting:**
- Access from anywhere via URL
- No file management for users
- Automatic HTTPS security
- Easy updates (redeploy new version)
- Multiple users can access simultaneously

---

## Option 3: Windows Batch File Launcher

Create a simple launcher for Windows users:

**File: `start.bat`** (already exists in your project)

```batch
@echo off
echo Starting QR Generator...
echo.
echo Opening in your default browser...
echo Press Ctrl+C to stop the server.
echo.

REM Try different Python versions
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    start http://localhost:8000
    python -m http.server 8000
    goto :end
)

where python3 >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    start http://localhost:8000
    python3 -m http.server 8000
    goto :end
)

REM If no Python, just open the file
echo Python not found. Opening file directly...
start index.html

:end
```

**User Instructions:**
1. Extract all files
2. Double-click `start.bat`
3. App opens in browser automatically

---

## Option 4: Package as Windows Executable (Advanced)

Use Electron to create a standalone `.exe` file:

### Quick Setup:

1. **Install Node.js:** https://nodejs.org/

2. **Create Electron wrapper:**
   ```bash
   npm init -y
   npm install electron electron-builder --save-dev
   ```

3. **Create `main.js`:**
   ```javascript
   const { app, BrowserWindow } = require('electron');
   const path = require('path');

   function createWindow() {
     const win = new BrowserWindow({
       width: 1200,
       height: 800,
       webPreferences: {
         nodeIntegration: false,
         contextIsolation: true
       }
     });

     win.loadFile('index.html');
   }

   app.whenReady().then(createWindow);
   ```

4. **Update `package.json`:**
   ```json
   {
     "name": "qr-generator",
     "version": "1.0.0",
     "main": "main.js",
     "scripts": {
       "start": "electron .",
       "build": "electron-builder"
     },
     "build": {
       "appId": "com.yourcompany.qrgenerator",
       "win": {
         "target": "nsis",
         "icon": "assets/icon.ico"
       }
     }
   }
   ```

5. **Build Windows installer:**
   ```bash
   npm run build
   ```

6. **Distribute:**
   - Find installer in `dist/` folder
   - Send to user
   - They run installer → app appears like any Windows program

**Advantages:**
- Professional appearance
- Desktop icon
- No browser needed
- Looks like a "real" application

**Disadvantages:**
- Large file size (~150MB)
- More complex setup
- Updates require new installer

---

## Recommendation

**For a single non-technical Windows user:**
- **Use Option 1** (Local folder + shortcut) - Simplest!
- If browser security is an issue, add the `start.bat` launcher

**For multiple users or professional deployment:**
- **Use Option 2** (Netlify/GitHub Pages) - Clean URL, easy to share

**For enterprise/commercial use:**
- **Use Option 4** (Electron .exe) - Professional appearance

---

## Security Notes

- **Supabase credentials:** Already configured in the app
- **Data privacy:** All processing happens client-side
- **No server required:** Pure static files
- **CORS:** Supabase Storage must allow requests from your domain

---

## Support & Updates

**To update the app:**
1. Replace files in the folder (Option 1)
2. Redeploy to hosting service (Option 2)
3. Send new installer (Option 4)

**User training:**
- Configure Supabase settings once
- Use Bulk Mode with Supabase data
- Photos load automatically from Storage
