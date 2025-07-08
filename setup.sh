#!/bin/bash

# GitHub Link Tracker UI Setup Script
# This script helps you set up the link tracker UI quickly

set -e

echo "🔗 GitHub Link Tracker UI Setup"
echo "================================"
echo

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed."
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed."
    echo "Please install npm (usually comes with Node.js)"
    exit 1
fi

echo "✅ npm found: $(npm --version)"
echo

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found."
    echo "Please run this script from the github-link-tracker-ui directory"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

echo
echo "🔑 GitHub Token Setup"
echo "====================>"

# Check if GitHub token is already set
if [ -n "$GITHUB_TOKEN" ]; then
    echo "✅ GITHUB_TOKEN is already set"
else
    echo "⚠️  GITHUB_TOKEN is not set"
    echo
    echo "You need a GitHub personal access token to use this tool."
    echo "1. Go to: https://github.com/settings/tokens"
    echo "2. Click 'Generate new token (classic)'"
    echo "3. Give it a name like 'Link Tracker UI'"
    echo "4. Select the 'repo' scope"
    echo "5. Generate and copy the token"
    echo
    read -p "Enter your GitHub token (or press Enter to skip): " token
    
    if [ -n "$token" ]; then
        echo "export GITHUB_TOKEN=$token" >> ~/.bashrc
        echo "export GITHUB_TOKEN=$token" >> ~/.zshrc 2>/dev/null || true
        export GITHUB_TOKEN=$token
        echo "✅ Token saved to shell profile"
    else
        echo "⚠️  Skipped token setup. You'll need to set GITHUB_TOKEN manually:"
        echo "   export GITHUB_TOKEN=your_token_here"
    fi
fi

echo
echo "🌐 Installation Options"
echo "======================="

read -p "Install globally for CLI access from anywhere? (y/n): " install_global

if [[ $install_global =~ ^[Yy]$ ]]; then
    echo "📦 Installing globally..."
    npm install -g .
    echo "✅ Global installation complete!"
    echo
    echo "You can now use these commands from anywhere:"
    echo "  link-tracker start    # Start the server"
    echo "  link-tracker stop     # Stop the server"
    echo "  link-tracker restart  # Restart the server"
    echo "  link-tracker status   # Check status"
else
    echo "✅ Local installation complete!"
    echo
    echo "You can use these commands from this directory:"
    echo "  npm start            # Start the server"
    echo "  npm run stop         # Stop the server"
    echo "  npm run restart      # Restart the server"
fi

echo
echo "🚀 Quick Start"
echo "=============="

if [ -n "$GITHUB_TOKEN" ]; then
    echo "Your GitHub token is set. You're ready to go!"
    echo
    if [[ $install_global =~ ^[Yy]$ ]]; then
        echo "Start the server:"
        echo "  link-tracker start"
    else
        echo "Start the server:"
        echo "  npm start"
    fi
    echo
    echo "Then open: http://localhost:3333"
else
    echo "Set your GitHub token first:"
    echo "  export GITHUB_TOKEN=your_token_here"
    echo
    echo "Then start the server:"
    if [[ $install_global =~ ^[Yy]$ ]]; then
        echo "  link-tracker start"
    else
        echo "  npm start"
    fi
    echo
    echo "Then open: http://localhost:3333"
fi

echo
echo "📚 For more information, see README.md"
echo "🎉 Setup complete!"