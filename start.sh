#!/bin/bash

# QR Generator App - Local Startup Script
# This starts a local web server on your computer only (not accessible from internet)

echo "================================================"
echo "  QR Generator App - Starting Local Server"
echo "================================================"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check if Python 3 is available
if command -v python3 &> /dev/null; then
    echo "✓ Python 3 found"
    echo "✓ Starting local web server on http://localhost:8000"
    echo ""
    echo "The app will open in your browser automatically."
    echo "Press Ctrl+C to stop the server when you're done."
    echo ""
    echo "================================================"
    echo ""
    
    # Open browser after a short delay
    (sleep 2 && xdg-open http://localhost:8000 2>/dev/null) &
    
    # Start the server
    python3 -m http.server 8000
    
elif command -v python &> /dev/null; then
    echo "✓ Python found"
    echo "✓ Starting local web server on http://localhost:8000"
    echo ""
    echo "The app will open in your browser automatically."
    echo "Press Ctrl+C to stop the server when you're done."
    echo ""
    echo "================================================"
    echo ""
    
    # Open browser after a short delay
    (sleep 2 && xdg-open http://localhost:8000 2>/dev/null) &
    
    # Start the server
    python -m SimpleHTTPServer 8000
    
else
    echo "✗ Python not found!"
    echo ""
    echo "Please install Python to run this app:"
    echo "  sudo apt install python3"
    echo ""
    exit 1
fi
