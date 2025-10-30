# Auto-Start Setup for GitHub Link Tracker (macOS)

This guide will help you set up the GitHub Link Tracker to start automatically every time you log in to your Mac.

## Quick Setup (Recommended)

1. Navigate to your project directory:
   ```bash
   cd /Users/yourname/Code/LinkTracker/link-tracker
   ```

2. Run the setup script:
   ```bash
   chmod +x bin/setup-autostart.sh
   ./bin/setup-autostart.sh
   ```

3. The script will:
   - Detect your Node.js installation
   - Load settings from your `.env` file (if it exists)
   - Prompt for any missing configuration
   - Create and load the Launch Agent automatically
   - Configure automatic log rotation

4. Done! The service will now start automatically on login.

## What Gets Configured

The setup script automatically configures:

- ✅ **GitHub Token**: From `.env` or prompted if missing
- ✅ **Repository Settings**: `GITHUB_OWNER` and `GITHUB_REPO` from `.env` or prompted
- ✅ **Node.js Path**: Automatically detected
- ✅ **Server Path**: Automatically resolved from script location
- ✅ **Log Files**: `~/Library/Logs/link-tracker.log` and `~/Library/Logs/link-tracker-error.log`
- ✅ **Log Rotation**: Automatic rotation at 5MB with old logs deleted
- ✅ **Auto-restart**: Service restarts automatically if it crashes

## Manual Setup

If you prefer to set it up manually or need to customize the configuration:

### 1. Create the Launch Agent

Create a file at `~/Library/LaunchAgents/com.user.link-tracker.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.user.link-tracker</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/FULL/PATH/TO/link-tracker/server.js</string>
    </array>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>GITHUB_TOKEN</key>
        <string>your_github_token_here</string>
        <key>GITHUB_OWNER</key>
        <string>your_github_username</string>
        <key>GITHUB_REPO</key>
        <string>your_data_repo_name</string>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>KeepAlive</key>
    <true/>
    
    <key>WorkingDirectory</key>
    <string>/FULL/PATH/TO/link-tracker</string>
    
    <key>StandardOutPath</key>
    <string>/Users/yourname/Library/Logs/link-tracker.log</string>
    
    <key>StandardErrorPath</key>
    <string>/Users/yourname/Library/Logs/link-tracker-error.log</string>
    
    <key>Nice</key>
    <integer>1</integer>
</dict>
</plist>
```

**Important:** Replace the following:
- `/usr/local/bin/node` with your actual node path (run `which node` to find it)
- `/FULL/PATH/TO/link-tracker/server.js` with the full path to your [server.js](../server.js)
- `your_github_token_here` with your actual GitHub personal access token
- `your_github_username` with your GitHub username
- `your_data_repo_name` with your data repository name (e.g., `link-tracker-links`)
- `/FULL/PATH/TO/link-tracker` with your project directory
- `/Users/yourname` with your actual home directory path

### 2. Load the Launch Agent

```bash
# Set proper permissions
chmod 644 ~/Library/LaunchAgents/com.user.link-tracker.plist

# Load the Launch Agent
launchctl load ~/Library/LaunchAgents/com.user.link-tracker.plist
```

### 3. Configure Log Rotation (Manual)

Create a newsyslog configuration file to automatically rotate logs:

```bash
# Create the newsyslog.d directory if it doesn't exist
sudo mkdir -p /usr/local/etc/newsyslog.d

# Create the log rotation configuration
sudo nano /usr/local/etc/newsyslog.d/link-tracker.conf
```

Add the following content (replace `/Users/yourname` with your actual home directory):

```
# logfilename                                        [owner:group]  mode count size when  flags [/pid_file] [sig_num]
/Users/yourname/Library/Logs/link-tracker.log       644  0     5120  *     GN
/Users/yourname/Library/Logs/link-tracker-error.log 644  0     5120  *     GN
```

**Configuration Explanation:**
- `644`: File permissions (readable by all, writable by owner)
- `0`: Keep 0 old log files (delete immediately after rotation)
- `5120`: Rotate when log reaches 5MB (5120 KB)
- `*`: Check every hour
- `G`: Rotate only when size limit is reached
- `N`: Don't signal any process after rotation

Save and exit. The log rotation will be applied automatically by macOS's newsyslog daemon.

## Log Rotation

The setup script automatically configures log rotation using macOS's built-in `newsyslog` utility.

### How It Works

- **Automatic Rotation**: Logs are checked hourly and rotated when they reach 5MB
- **No Archive**: Old logs are deleted immediately to save disk space
- **No Service Interruption**: Log rotation happens seamlessly without affecting the running service

### Verify Log Rotation Configuration

Check if log rotation is configured:

```bash
cat /usr/local/etc/newsyslog.d/link-tracker.conf
```

### Manual Log Rotation

If you need to manually rotate logs before they reach 5MB:

```bash
# Force immediate rotation
sudo newsyslog -F /usr/local/etc/newsyslog.d/link-tracker.conf

# Or manually truncate logs
> ~/Library/Logs/link-tracker.log
> ~/Library/Logs/link-tracker-error.log
```

### Customize Log Rotation

Edit the newsyslog configuration to change rotation behavior:

```bash
sudo nano /usr/local/etc/newsyslog.d/link-tracker.conf
```

Common customizations:

**Rotate at 10MB instead of 5MB:**
```
/Users/yourname/Library/Logs/link-tracker.log       644  0     10240  *     GN
```

**Keep last 3 rotated logs (compressed):**
```
/Users/yourname/Library/Logs/link-tracker.log       644  3     5120  *     GJN
```
(The `J` flag compresses old logs with gzip)

**Rotate daily regardless of size:**
```
/Users/yourname/Library/Logs/link-tracker.log       644  0     *     @T00  N
```
(Rotates at midnight every day)

**Rotate weekly on Sunday:**
```
/Users/yourname/Library/Logs/link-tracker.log       644  0     *     $W0   N
```

### Remove Log Rotation

To remove automatic log rotation:

```bash
sudo rm /usr/local/etc/newsyslog.d/link-tracker.conf
```

## Managing the Service

### Check if the service is running
```bash
launchctl list | grep link-tracker
```

You should see output like:
```
12345	0	com.user.link-tracker
```

### Stop the service
```bash
launchctl unload ~/Library/LaunchAgents/com.user.link-tracker.plist
```

### Start the service
```bash
launchctl load ~/Library/LaunchAgents/com.user.link-tracker.plist
```

### Restart the service
```bash
launchctl unload ~/Library/LaunchAgents/com.user.link-tracker.plist
launchctl load ~/Library/LaunchAgents/com.user.link-tracker.plist
```

### Remove auto-start completely
```bash
launchctl unload ~/Library/LaunchAgents/com.user.link-tracker.plist
rm ~/Library/LaunchAgents/com.user.link-tracker.plist
sudo rm /usr/local/etc/newsyslog.d/link-tracker.conf
```

## Viewing Logs

The service logs are stored in your Library/Logs directory:

```bash
# View standard output logs (real-time)
tail -f ~/Library/Logs/link-tracker.log

# View error logs (real-time)
tail -f ~/Library/Logs/link-tracker-error.log

# View last 50 lines of output
tail -50 ~/Library/Logs/link-tracker.log

# View last 50 lines of errors
tail -50 ~/Library/Logs/link-tracker-error.log

# Check log file size
ls -lh ~/Library/Logs/link-tracker*.log
```

## Troubleshooting

### Service won't start

1. **Check Node.js path:**
   ```bash
   which node
   ```
   Make sure this matches the path in your plist file.

2. **Check GitHub configuration:**
   - Verify your GitHub token is correct
   - Verify `GITHUB_OWNER` and `GITHUB_REPO` are correct
   - Ensure the repository exists and is accessible

3. **Check logs:**
   ```bash
   tail -50 ~/Library/Logs/link-tracker-error.log
   ```

4. **Verify file paths:**
   Make sure all paths in the plist file are absolute (full paths) and correct:
   ```bash
   ls -la /path/to/link-tracker/server.js
   ```

5. **Test manual start:**
   ```bash
   cd /path/to/link-tracker
   node server.js
   ```
   If this works but the Launch Agent doesn't, check the environment variables in the plist.

### Service crashes or stops

The `KeepAlive` setting will automatically restart the service if it crashes. Check the error logs to diagnose the issue:

```bash
tail -f ~/Library/Logs/link-tracker-error.log
```

Common issues:
- Missing or invalid GitHub token
- Repository doesn't exist or isn't accessible
- Port 3333 already in use
- Node modules not installed (`cd link-tracker && npm install`)

### Port 3333 already in use

If you get a "port in use" error:

1. Check what's using the port:
   ```bash
   lsof -ti:3333
   ```

2. Kill the process:
   ```bash
   kill $(lsof -ti:3333)
   ```

3. Restart the service:
   ```bash
   launchctl unload ~/Library/LaunchAgents/com.user.link-tracker.plist
   launchctl load ~/Library/LaunchAgents/com.user.link-tracker.plist
   ```

### Changes to plist not taking effect

After editing the plist file, you must unload and reload it:

```bash
launchctl unload ~/Library/LaunchAgents/com.user.link-tracker.plist
launchctl load ~/Library/LaunchAgents/com.user.link-tracker.plist
```

### Service starts but can't access bookmarks

1. **Check repository configuration:**
   ```bash
   grep GITHUB ~/Library/LaunchAgents/com.user.link-tracker.plist
   ```

2. **Test GitHub access manually:**
   ```bash
   export GITHUB_TOKEN="your_token"
   export GITHUB_OWNER="your_username"
   export GITHUB_REPO="your_repo"
   curl -H "Authorization: token $GITHUB_TOKEN" \
        https://api.github.com/repos/$GITHUB_OWNER/$GITHUB_REPO
   ```

3. **Verify .env file matches plist:**
   ```bash
   cat /path/to/link-tracker/.env
   ```

### Log rotation not working

1. **Check if configuration exists:**
   ```bash
   ls -la /usr/local/etc/newsyslog.d/link-tracker.conf
   ```

2. **Verify newsyslog is running:**
   ```bash
   sudo launchctl list | grep newsyslog
   ```

3. **Manually trigger rotation to test:**
   ```bash
   sudo newsyslog -F /usr/local/etc/newsyslog.d/link-tracker.conf
   ```

4. **Check newsyslog logs:**
   ```bash
   log show --predicate 'process == "newsyslog"' --last 1h
   ```

## Security Note

⚠️ **Important:** Your GitHub token is stored in plain text in the plist file. This file is only readable by your user account, but be aware of this when managing your system.

To improve security:

1. **Set restrictive permissions (recommended):**
   ```bash
   chmod 600 ~/Library/LaunchAgents/com.user.link-tracker.plist
   ```

2. **Use a token with minimal permissions:**
   - Only grant `repo` scope (or `public_repo` if using a public repository)
   - Use a dedicated token just for this application

3. **Alternative: macOS Keychain (advanced):**
   You can store the token in Keychain and retrieve it via a wrapper script, but this requires additional setup.

## Environment Variables

The Launch Agent sets these environment variables:

| Variable | Purpose | Example |
|----------|---------|---------|
| `GITHUB_TOKEN` | GitHub personal access token | `ghp_xxxxxxxxxxxx` |
| `GITHUB_OWNER` | GitHub username/organization | `cgb37` |
| `GITHUB_REPO` | Data repository name | `link-tracker-links` |
| `PATH` | System PATH for binaries | `/usr/local/bin:/usr/bin:...` |

All of these are automatically configured when you run [bin/setup-autostart.sh](../bin/setup-autostart.sh).

## Configuration Options

### Change the port

The server runs on port 3333 by default. To change it:

1. Edit [server.js](../server.js) and change the `PORT` constant
2. Reload the Launch Agent:
   ```bash
   launchctl unload ~/Library/LaunchAgents/com.user.link-tracker.plist
   launchctl load ~/Library/LaunchAgents/com.user.link-tracker.plist
   ```

### Change the log location

Edit these lines in your plist:
```xml
<key>StandardOutPath</key>
<string>/custom/path/to/output.log</string>

<key>StandardErrorPath</key>
<string>/custom/path/to/error.log</string>
```

Don't forget to update the newsyslog configuration as well:
```bash
sudo nano /usr/local/etc/newsyslog.d/link-tracker.conf
```

Then reload:
```bash
launchctl unload ~/Library/LaunchAgents/com.user.link-tracker.plist
launchctl load ~/Library/LaunchAgents/com.user.link-tracker.plist
```

### Run at a specific time instead of on login

Replace `RunAtLoad` with `StartCalendarInterval`:
```xml
<key>StartCalendarInterval</key>
<dict>
    <key>Hour</key>
    <integer>9</integer>
    <key>Minute</key>
    <integer>0</integer>
</dict>
```

This example starts the service at 9:00 AM every day.

### Disable auto-restart on crashes

Remove or set to false:
```xml
<key>KeepAlive</key>
<false/>
```

## Benefits of Using Launch Agents

✅ **Native macOS solution** - Uses Apple's built-in service management  
✅ **Automatic restart** - Service restarts automatically if it crashes  
✅ **Auto-start on login** - Starts immediately when you log in  
✅ **Better resource management** - macOS handles process lifecycle  
✅ **Integrated with macOS** - Works with system services and security  
✅ **Easy management** - Simple commands to start/stop/restart  
✅ **Logging built-in** - Automatic stdout/stderr capture  
✅ **Automatic log rotation** - Prevents logs from consuming disk space

## Alternative: Using cron (Not Recommended)

If you prefer using cron (though Launch Agents are more macOS-appropriate):

```bash
# Edit crontab
crontab -e

# Add this line to run at startup
@reboot cd /path/to/link-tracker && /usr/local/bin/node server.js >> /tmp/link-tracker.log 2>&1 &
```

**Note:** This requires:
- Setting `GITHUB_TOKEN`, `GITHUB_OWNER`, and `GITHUB_REPO` in your shell profile
- Manual process management (no auto-restart)
- More complex logging setup
- Manual log rotation setup

Launch Agents are the recommended approach.

## Integration with Data Repository

The autostart service works seamlessly with the separated data repository architecture:

- **Code Repository**: This repository contains the application code
- **Data Repository**: Separate repository containing your bookmarks (GitHub issues) and tags (GitHub labels)

Configuration happens through:
1. Environment variables in the `.env` file (for local development)
2. Environment variables in the Launch Agent plist (for auto-start)

Both must point to your data repository using `GITHUB_OWNER` and `GITHUB_REPO`.

## Summary

Once set up, the GitHub Link Tracker will:

- ✅ Start automatically when you log in
- ✅ Restart automatically if it crashes
- ✅ Run in the background without a terminal window
- ✅ Be accessible at http://localhost:3333
- ✅ Log all activity to `~/Library/Logs/link-tracker.log`
- ✅ Log errors to `~/Library/Logs/link-tracker-error.log`
- ✅ Automatically rotate logs when they reach 5MB
- ✅ Delete old logs to save disk space
- ✅ Use your configured data repository for bookmarks
- ✅ Require no manual intervention after initial setup

You can access your bookmarks anytime by opening http://localhost:3333 in your browser!

## Quick Reference

```bash
# Setup (one-time)
cd /path/to/link-tracker
chmod +x bin/setup-autostart.sh
./bin/setup-autostart.sh

# Check status
launchctl list | grep link-tracker

# View logs
tail -f ~/Library/Logs/link-tracker.log

# Check log size
ls -lh ~/Library/Logs/link-tracker*.log

# Manually rotate logs
sudo newsyslog -F /usr/local/etc/newsyslog.d/link-tracker.conf

# Restart
launchctl unload ~/Library/LaunchAgents/com.user.link-tracker.plist
launchctl load ~/Library/LaunchAgents/com.user.link-tracker.plist

# Remove (including log rotation)
launchctl unload ~/Library/LaunchAgents/com.user.link-tracker.plist
rm ~/Library/LaunchAgents/com.user.link-tracker.plist
sudo rm /usr/local/etc/newsyslog.d/link-tracker.conf
```