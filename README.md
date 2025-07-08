# GitHub Link Tracker UI

A local web interface for organizing and managing bookmarks stored as GitHub issues. This tool provides a beautiful, searchable interface for your links with tag-based filtering and full CRUD operations.

## Features

- 🔍 **Search & Filter**: Full-text search across titles, descriptions, links, and tags
- 🏷️ **Tag-based Organization**: Filter by single or multiple tags
- 📱 **Dual View Modes**: Switch between grid and list layouts
- ✏️ **Full CRUD Operations**: Create, read, update, and delete bookmarks
- 🎨 **Visual Tag System**: Color-coded tags with auto-generated colors
- 📊 **Metadata Tooltips**: Hover to see creation and update dates
- 🔄 **Manual Sync**: Refresh data from GitHub on demand
- 🌐 **Global CLI**: Run from anywhere on your system

## Prerequisites

- Node.js 14+ installed
- A GitHub personal access token with repo access
- The original link-tracker repository (`cgb37/link-tracker`)

## Installation

### 1. Local Installation

```bash
# Clone or download the project
git clone <repository-url>
cd github-link-tracker-ui

# Install dependencies
npm install

# Set your GitHub token
export GITHUB_TOKEN=your_personal_access_token_here

# Start the server
npm start
```

### 2. Global Installation (Recommended)

```bash
# Install globally to use from anywhere
npm install -g .

# Set your GitHub token (add to your shell profile for persistence)
export GITHUB_TOKEN=your_personal_access_token_here

# Now you can use the CLI from anywhere
link-tracker start
```

## Usage

### CLI Commands

```bash
# Start the server
link-tracker start

# Stop the server
link-tracker stop

# Restart the server
link-tracker restart

# Check server status
link-tracker status

# Show help
link-tracker help
```

### Web Interface

Once started, open your browser to `http://localhost:3333`

#### Creating Bookmarks
1. Click "Add Bookmark"
2. Fill in title and URL (required)
3. Add description (optional)
4. Select existing tags or create new ones
5. Save

#### Managing Bookmarks
- **Search**: Use the search box to find bookmarks by any text
- **Filter**: Click tags in the filter section to narrow results
- **Edit**: Hover over a bookmark and click "Edit"
- **Delete**: Hover over a bookmark and click "Delete"
- **View Issue**: Click "View Issue" to see the GitHub issue

#### View Modes
- **Grid View**: Card-based layout for browsing
- **List View**: Compact list format

## Configuration

### Environment Variables

- `GITHUB_TOKEN`: Your GitHub personal access token (required)

### Default Settings

- **Port**: 3333 (chosen to avoid conflicts with common dev ports)
- **Repository**: `cgb37/link-tracker`
- **Cache Duration**: 5 minutes

## API Endpoints

The server provides a REST API:

- `GET /api/bookmarks` - Get all bookmarks
- `POST /api/bookmarks` - Create new bookmark
- `PUT /api/bookmarks/:id` - Update bookmark
- `DELETE /api/bookmarks/:id` - Delete bookmark
- `GET /api/labels` - Get available tags
- `POST /api/labels` - Create new tag
- `POST /api/bookmarks/refresh` - Refresh from GitHub

## Project Structure

```
github-link-tracker-ui/
├── package.json          # Dependencies and scripts
├── server.js             # Express server and API
├── bin/
│   └── cli.js           # Global CLI tool
└── public/
    └── index.html       # Web interface
```

## Development

### Local Development

```bash
# Install dependencies
npm install

# Start in development mode
npm run dev

# Stop server
npm run stop

# Restart server
npm run restart
```

### Making Changes

1. Edit `server.js` for backend changes
2. Edit `public/index.html` for frontend changes
3. Restart the server to see changes

## Troubleshooting

### Common Issues

**"GITHUB_TOKEN not set"**
```bash
export GITHUB_TOKEN=your_token_here
# Add to ~/.bashrc or ~/.zshrc for persistence
```

**"Port 3333 already in use"**
```bash
link-tracker stop
# Or kill the process manually:
lsof -ti:3333 | xargs kill
```

**"No bookmarks found"**
- Make sure you have issues in your `cgb37/link-tracker` repository
- Try clicking the "Refresh" button
- Check that your GitHub token has repo access

**"Failed to fetch bookmarks"**
- Verify your GitHub token is correct
- Check your internet connection
- Ensure the repository exists and is accessible

### Logs

The server logs all operations to the console. Check the terminal where you started the server for detailed error messages.

## GitHub Token Setup

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Give it a descriptive name like "Link Tracker UI"
4. Select the `repo` scope (or `public_repo` if your repository is public)
5. Click "Generate token"
6. Copy the token and set it as an environment variable

## Integration with Original Script

This UI works seamlessly with your existing `github-link-tracker.sh` script:

- Bookmarks created with the script appear in the UI
- Bookmarks created in the UI work with the script
- Both use the same GitHub issue format
- Labels/tags are shared between both tools

## License

MIT License - feel free to modify and distribute as needed.