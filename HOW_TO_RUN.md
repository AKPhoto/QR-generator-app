# How to Run the QR Generator App

## ⚠️ Important: Do NOT open `index.html` directly!

Modern browsers block file access for security (CORS policy). You **must** run a local web server.

---

## Quick Start (Easiest Methods)

### Option 1: Use the Start Script (Recommended)

**On Linux/Mac:**
```bash
./start.sh
```

**On Windows:**
```
start.bat
```

This will:
- Start a local web server on port 8000
- Automatically open the app in your browser at `http://localhost:8000`
- Press `Ctrl+C` in the terminal to stop the server when done

---

### Option 2: Manual Python Server

If you have Python installed:

**Python 3:**
```bash
python3 -m http.server 8000
```

**Python 2:**
```bash
python -m SimpleHTTPServer 8000
```

Then open your browser to: `http://localhost:8000`

---

### Option 3: VS Code Live Server Extension

1. Open the project folder in VS Code
2. Install the "Live Server" extension
3. Right-click `index.html` → "Open with Live Server"

---

### Option 4: Node.js HTTP Server

If you have Node.js installed:

```bash
npx http-server -p 8000
```

Then open: `http://localhost:8000`

---

## Troubleshooting

### "Failed to fetch" or "CORS policy" errors

**Cause:** You opened `index.html` directly (double-clicked the file)

**Solution:** Use one of the methods above to run a web server

### "Address already in use" error

**Cause:** Port 8000 is already in use

**Solution:** 
- Stop any other servers running on port 8000, OR
- Use a different port: `python3 -m http.server 8001`
- Then open `http://localhost:8001`

### Python not found

**Solution:** Install Python from https://www.python.org/downloads/

Make sure to check "Add Python to PATH" during installation on Windows.

### Start script won't run on Linux/Mac

**Solution:** Make it executable:
```bash
chmod +x start.sh
./start.sh
```

---

## For Deployment to End Users

If deploying to non-technical users who don't want to run a server:

### Option A: Host Online (Recommended)
- Deploy to Netlify, Vercel, or GitHub Pages
- Users access via URL (e.g., `https://qr-generator.netlify.app`)
- No server setup required for users

### Option B: Package as Electron App
- Create a standalone Windows `.exe` file
- No browser or server needed
- See `DEPLOYMENT_GUIDE.md` for details

---

## Why is a server needed?

Modern browsers block JavaScript `fetch()` requests to local files (`file://` URLs) for security reasons. Running a local web server serves files over `http://localhost`, which browsers allow.

This is a **local-only** server - it only works on your computer and is not accessible from the internet.
