#!/bin/bash

# GitHub Link Tracker - Auto-Start Setup for macOS
# This script sets up the link tracker to start automatically on login

set -e

echo "🚀 GitHub Link Tracker - Auto-Start Setup"
echo "=========================================="
echo

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This script is for macOS only"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed."
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Get the node path
NODE_PATH=$(which node)
echo "📍 Node path: $NODE_PATH"

# Get project directory (go up one level from bin directory)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SERVER_PATH="$PROJECT_DIR/server.js"

if [ ! -f "$SERVER_PATH" ]; then
    echo "❌ server.js not found at $SERVER_PATH"
    echo "Please ensure the script is in the bin directory of the project"
    exit 1
fi

echo "📂 Project directory: $PROJECT_DIR"
echo "📂 Server path: $SERVER_PATH"

# Check for .env file and load it if it exists
ENV_FILE="$PROJECT_DIR/.env"
if [ -f "$ENV_FILE" ]; then
    echo "✅ Found .env file"
    # Source the .env file to get GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO
    set -a
    source "$ENV_FILE"
    set +a
fi

# Check for GitHub token
if [ -z "$GITHUB_TOKEN" ]; then
    echo
    echo "⚠️  GITHUB_TOKEN environment variable not set"
    echo
    read -p "Enter your GitHub personal access token: " token
    
    if [ -z "$token" ]; then
        echo "❌ GitHub token is required"
        exit 1
    fi
    
    GITHUB_TOKEN="$token"
else
    echo "✅ GitHub token found"
    read -p "Use existing GITHUB_TOKEN? (y/n): " use_existing
    
    if [[ ! $use_existing =~ ^[Yy]$ ]]; then
        read -p "Enter your GitHub personal access token: " token
        GITHUB_TOKEN="$token"
    fi
fi

# Get GITHUB_OWNER and GITHUB_REPO if not already set
if [ -z "$GITHUB_OWNER" ]; then
    read -p "Enter your GitHub username/organization: " GITHUB_OWNER
fi

if [ -z "$GITHUB_REPO" ]; then
    read -p "Enter your GitHub repository name: " GITHUB_REPO
fi

echo "📍 Using repository: $GITHUB_OWNER/$GITHUB_REPO"

# Create the Launch Agent plist file
PLIST_NAME="com.user.link-tracker.plist"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
PLIST_PATH="$LAUNCH_AGENTS_DIR/$PLIST_NAME"

# Create LaunchAgents directory if it doesn't exist
mkdir -p "$LAUNCH_AGENTS_DIR"

echo
echo "📝 Creating Launch Agent configuration..."

# Create the plist file with all necessary environment variables
cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.user.link-tracker</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>$NODE_PATH</string>
        <string>$SERVER_PATH</string>
    </array>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>GITHUB_TOKEN</key>
        <string>$GITHUB_TOKEN</string>
        <key>GITHUB_OWNER</key>
        <string>$GITHUB_OWNER</string>
        <key>GITHUB_REPO</key>
        <string>$GITHUB_REPO</string>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>KeepAlive</key>
    <true/>
    
    <key>WorkingDirectory</key>
    <string>$PROJECT_DIR</string>
    
    <key>StandardOutPath</key>
    <string>$HOME/Library/Logs/link-tracker.log</string>
    
    <key>StandardErrorPath</key>
    <string>$HOME/Library/Logs/link-tracker-error.log</string>
    
    <key>Nice</key>
    <integer>1</integer>
</dict>
</plist>
EOF

echo "✅ Launch Agent configuration created at:"
echo "   $PLIST_PATH"

# Set proper permissions
chmod 644 "$PLIST_PATH"

# Configure log rotation with newsyslog
echo
echo "📋 Configuring log rotation..."

NEWSYSLOG_DIR="/usr/local/etc/newsyslog.d"
NEWSYSLOG_CONF="$NEWSYSLOG_DIR/link-tracker.conf"

# Create newsyslog.d directory if it doesn't exist
if [ ! -d "$NEWSYSLOG_DIR" ]; then
    echo "Creating newsyslog.d directory (requires sudo)..."
    sudo mkdir -p "$NEWSYSLOG_DIR"
fi

# Create newsyslog configuration
echo "Creating log rotation configuration (requires sudo)..."
sudo tee "$NEWSYSLOG_CONF" > /dev/null << EOF
# logfilename                                        [owner:group]  mode count size when  flags [/pid_file] [sig_num]
$HOME/Library/Logs/link-tracker.log                 644  0     5120  *     GN
$HOME/Library/Logs/link-tracker-error.log           644  0     5120  *     GN
EOF

if [ $? -eq 0 ]; then
    echo "✅ Log rotation configured at:"
    echo "   $NEWSYSLOG_CONF"
    echo "   Logs will be rotated when they reach 5MB and old logs will be deleted"
else
    echo "⚠️  Failed to configure log rotation. You may need to set it up manually."
    echo "   See the README for manual log rotation instructions."
fi

echo
echo "🔧 Loading Launch Agent..."

# Unload if already loaded (ignore errors)
launchctl unload "$PLIST_PATH" 2>/dev/null || true

# Load the Launch Agent
if launchctl load "$PLIST_PATH"; then
    echo "✅ Launch Agent loaded successfully!"
else
    echo "❌ Failed to load Launch Agent"
    exit 1
fi

# Wait a moment for the service to start
sleep 2

# Check if the service is running
if launchctl list | grep -q "com.user.link-tracker"; then
    echo "✅ Service is running!"
else
    echo "⚠️  Service may not be running. Check logs:"
    echo "   tail -f ~/Library/Logs/link-tracker.log"
    echo "   tail -f ~/Library/Logs/link-tracker-error.log"
fi

echo
echo "🎉 Setup Complete!"
echo "================="
echo
echo "The GitHub Link Tracker will now:"
echo "  • Start automatically when you log in"
echo "  • Restart automatically if it crashes"
echo "  • Run on http://localhost:3333"
echo "  • Rotate logs automatically when they reach 5MB"
echo
echo "📊 Useful Commands:"
echo "  • Check status:   launchctl list | grep link-tracker"
echo "  • Stop service:   launchctl unload $PLIST_PATH"
echo "  • Start service:  launchctl load $PLIST_PATH"
echo "  • View logs:      tail -f ~/Library/Logs/link-tracker.log"
echo "  • View errors:    tail -f ~/Library/Logs/link-tracker-error.log"
echo
echo "🌐 Access your bookmarks at: http://localhost:3333"
echo

# Test the service
echo "🧪 Testing service..."
sleep 2

if curl -s http://localhost:3333 > /dev/null; then
    echo "✅ Service is accessible at http://localhost:3333"
else
    echo "⚠️  Service may not be accessible yet. Give it a moment or check the logs."
fi