#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const command = process.argv[2];
const SERVER_PATH = path.join(__dirname, '..', 'server.js');
const PORT = 3333;

function findProcess(callback) {
    exec(`lsof -ti:${PORT}`, (error, stdout) => {
        if (error) {
            callback(null);
        } else {
            const pid = stdout.trim();
            callback(pid || null);
        }
    });
}

function killProcess(pid, callback) {
    exec(`kill ${pid}`, (error) => {
        callback(!error);
    });
}

function startServer() {
    console.log('🚀 Starting GitHub Link Tracker UI...');
    
    // Check if server file exists
    if (!fs.existsSync(SERVER_PATH)) {
        console.error(`❌ Error: Server file not found at ${SERVER_PATH}`);
        console.error('Make sure you\'re running this from the correct directory or the package is properly installed.');
        process.exit(1);
    }

    // Check if port is already in use
    findProcess((pid) => {
        if (pid) {
            console.log(`⚠️  Port ${PORT} is already in use (PID: ${pid})`);
            console.log('Use "link-tracker stop" to stop the existing server first.');
            process.exit(1);
        }

        // Start the server
        const server = spawn('node', [SERVER_PATH], {
            detached: true,
            stdio: 'inherit'
        });

        server.on('spawn', () => {
            console.log(`✅ Server started successfully!`);
            console.log(`🌐 Open http://localhost:${PORT} in your browser`);
        });

        server.on('error', (err) => {
            console.error('❌ Failed to start server:', err.message);
            process.exit(1);
        });

        // Allow the parent process to exit independently
        server.unref();
    });
}

function stopServer() {
    console.log('🛑 Stopping GitHub Link Tracker UI...');
    
    findProcess((pid) => {
        if (!pid) {
            console.log('ℹ️  No running instance found on port ' + PORT);
            return;
        }

        killProcess(pid, (success) => {
            if (success) {
                console.log('✅ Server stopped successfully!');
            } else {
                console.log('❌ Failed to stop server. You may need to kill it manually:');
                console.log(`💀  kill ${pid}`);
            }
        });
    });
}

function restartServer() {
    console.log('🔄 Restarting GitHub Link Tracker UI...');
    
    findProcess((pid) => {
        if (pid) {
            killProcess(pid, (success) => {
                if (success) {
                    console.log('✅ Old server stopped');
                    setTimeout(() => {
                        startServer();
                    }, 1000);
                } else {
                    console.log('❌ Failed to stop existing server');
                    process.exit(1);
                }
            });
        } else {
            console.log('ℹ️  No existing server found, starting new one...');
            startServer();
        }
    });
}

function showStatus() {
    findProcess((pid) => {
        if (pid) {
            console.log(`✅ GitHub Link Tracker UI is running (PID: ${pid})`);
            console.log(`🌐 Access it at: http://localhost:${PORT}`);
        } else {
            console.log('❌ GitHub Link Tracker UI is not running');
        }
    });
}

function showHelp() {
    console.log(`
🔗 GitHub Link Tracker UI - Command Line Interface

Usage: link-tracker <command>

Commands:
  start     Start the server
  stop      Stop the server
  restart   Restart the server
  status    Check if server is running
  help      Show this help message

Examples:
  link-tracker start
  link-tracker stop
  link-tracker restart
  link-tracker status

The server will run on http://localhost:${PORT}

Make sure your GITHUB_TOKEN environment variable is set:
  export GITHUB_TOKEN=your_personal_access_token
`);
}

// Main command handling
switch (command) {
    case 'start':
        startServer();
        break;
    case 'stop':
        stopServer();
        break;
    case 'restart':
        restartServer();
        break;
    case 'status':
        showStatus();
        break;
    case 'help':
    case '--help':
    case '-h':
        showHelp();
        break;
    default:
        if (command) {
            console.log(`❌ Unknown command: ${command}`);
        }
        console.log('Use "link-tracker help" for usage information.');
        process.exit(1);
}