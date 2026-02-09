@echo off
REM QR Generator App - Local Startup Script for Windows
REM This starts a local web server on your computer only (not accessible from internet)

echo ================================================
echo   QR Generator App - Starting Local Server
echo ================================================
echo.

REM Change to the directory where this script is located
cd /d "%~dp0"

REM Check if Python is available
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Python found
    echo [OK] Starting local web server on http://localhost:8000
    echo.
    echo The app will open in your browser automatically.
    echo Press Ctrl+C to stop the server when you're done.
    echo.
    echo ================================================
    echo.
    
    REM Open browser after a short delay
    start "" http://localhost:8000
    
    REM Start the server
    python -m http.server 8000
) else (
    echo [ERROR] Python not found!
    echo.
    echo Please install Python from: https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation
    echo.
    pause
    exit /b 1
)
