#!/bin/bash

PLIST_PATH="$HOME/Library/LaunchAgents/com.user.link-tracker.plist"

if [ ! -f "$PLIST_PATH" ]; then
    echo "❌ Service definition not found at $PLIST_PATH"
    echo "Please run bin/setup-autostart.sh first"
    exit 1
fi

# Check if already running
if launchctl list | grep -q "com.user.link-tracker"; then
    echo "⚠️  Service is already running"
    exit 0
fi

echo "🚀 Starting background service..."
launchctl load "$PLIST_PATH"

# Wait a moment and check status
sleep 2
if launchctl list | grep -q "com.user.link-tracker"; then
    echo "✅ Service started successfully!"
    echo "🌐 Access at http://localhost:3333"
else
    echo "❌ Failed to start service"
    exit 1
fi
