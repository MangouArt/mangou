#!/bin/bash

# Mangou Workspace Dependency Installer
# This script helps install required dependencies for Mangou AI Comic Director.

echo "📦 Installing Mangou dependencies..."

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed. Please install Node.js first."
    exit 1
fi

# Check for package.json
if [ -f "package.json" ]; then
    echo "📦 Found package.json, running npm install..."
    npm install
else
    # Install sharp for image processing (used by split-grid.mjs)
    echo "🖼️  Installing sharp..."
    npm install sharp --no-save
fi

echo "✅ Done! Dependencies installed successfully."
