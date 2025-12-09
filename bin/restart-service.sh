#!/bin/bash

echo "🔄 Restarting background service..."

# Stop service using existing script
./bin/stop-service.sh

# Wait a moment
sleep 1

# Start service using new script
./bin/start-service.sh
