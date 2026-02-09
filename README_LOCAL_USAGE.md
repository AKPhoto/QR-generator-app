# QR Generator App - Local Usage Instructions

## Running the Application Locally

This application runs **entirely on your computer** - no internet connection needed, no external server required.

### Quick Start

**On Linux/Mac:**
1. Double-click `start.sh` in your file manager
   OR
2. Open a terminal and run:
   ```bash
   ./start.sh
   ```

**On Windows:**
1. Double-click `start.bat` in File Explorer
   OR
2. Open Command Prompt and run:
   ```cmd
   start.bat
   ```

The app will automatically:
- Start a local web server (only accessible from your computer)
- Open in your default browser
- Display at http://localhost:8000

### When You're Done

Press `Ctrl+C` in the terminal/command prompt window to stop the server.

### Important Notes

- **Runs Locally Only**: The server only runs on your computer (localhost)
- **Not Accessible Online**: No one else can access it, even on your network
- **No Internet Required**: Works completely offline once running
- **Safe & Private**: All data stays on your computer

### Requirements

- **Python 3** (usually pre-installed on Linux/Mac)
  - Windows: Download from https://www.python.org/downloads/
  - **Important for Windows**: Check "Add Python to PATH" during installation
- A web browser (Chrome, Firefox, Edge, etc.)

### Troubleshooting

**Linux/Mac - If the script doesn't run:**
```bash
chmod +x start.sh
./start.sh
```

**Linux/Mac - If Python is not installed:**
```bash
sudo apt install python3
```

**Windows - If Python is not found:**
1. Install Python from https://www.python.org/downloads/
2. During installation, check "Add Python to PATH"
3. Restart Command Prompt and try again

**Manual start (any OS):**
```bash
cd /path/to/qr_generator_app
python3 -m http.server 8000    # Linux/Mac
python -m http.server 8000      # Windows
```
Then open your browser to: http://localhost:8000

### Why Can't I Just Open index.html?

Modern browsers block JavaScript from loading local files (like your templates and Excel file) for security reasons. A local web server solves this while keeping everything on your computer.
