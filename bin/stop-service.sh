#!/bin/bash

# Stop the background service if it exists
if [ -f ~/Library/LaunchAgents/com.user.link-tracker.plist ]; then
    echo "Unloading background service..."
    launchctl unload ~/Library/LaunchAgents/com.user.link-tracker.plist 2>/dev/null || true
fi

# Kill any remaining process on port 3333
echo "Stopping any running instances..."
lsof -ti:3333 | xargs kill -9 2>/dev/null || echo 'No running instances found'
