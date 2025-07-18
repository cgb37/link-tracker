/* eslint-env node */

const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = 3333;

// GitHub configuration
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_API = process.env.GITHUB_API || 'https://api.github.com';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Cache for issues
let issuesCache = [];
let lastFetch = 0;
const CACHE_DURATION = 8 * 60 * 60 * 1000; // 8 hours

// Helper function to get GitHub token
function getGitHubToken() {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
        console.error('\nError: GITHUB_TOKEN environment variable is not set');
        console.error('Please create a personal access token at https://github.com/settings/tokens');
        console.error('Then set it with: export GITHUB_TOKEN=your_token_here\n');
        process.exit(1);
    }
    return token;
}

// Helper function to make GitHub API requests
async function githubRequest(endpoint, options = {}) {
    const token = getGitHubToken();
    const url = `${GITHUB_API}${endpoint}`;
    
    const response = await fetch(url, {
        headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`GitHub API error: ${response.status} ${error}`);
    }

    return response.json();
}

// Parse issue body to extract link and description
function parseIssueBody(body) {
    const lines = body.split('\n');
    let link = '';
    let description = '';
    
    for (const line of lines) {
        if (line.startsWith('Link: ')) {
            link = line.substring(6).trim();
        } else if (line.startsWith('Description: ')) {
            description = line.substring(13).trim();
        }
    }
    
    return { link, description };
}

// Transform GitHub issue to bookmark format
function transformIssue(issue) {
    const { link, description } = parseIssueBody(issue.body || '');
    
    return {
        id: issue.number,
        title: issue.title,
        link: link,
        description: description,
        tags: issue.labels.map(label => label.name),
        created: issue.created_at,
        updated: issue.updated_at,
        state: issue.state,
        url: issue.html_url
    };
}

// Fetch issues from GitHub
async function fetchIssues(forceRefresh = false) {
    const now = Date.now();
    
    if (!forceRefresh && issuesCache.length > 0 && (now - lastFetch) < CACHE_DURATION) {
        return issuesCache;
    }

    try {
        console.log('Fetching issues from GitHub...');
        const issues = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues?state=open&per_page=100`);
        
        issuesCache = issues.map(transformIssue);
        lastFetch = now;
        
        console.log(`Fetched ${issuesCache.length} issues`);
        return issuesCache;
    } catch (error) {
        console.error('Error fetching issues:', error.message);
        return issuesCache; // Return cached data if available
    }
}

// API Routes

// Get all bookmarks
app.get('/api/bookmarks', async (req, res) => {
    try {
        const bookmarks = await fetchIssues();
        res.json(bookmarks);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Refresh bookmarks from GitHub
app.post('/api/bookmarks/refresh', async (req, res) => {
    try {
        const bookmarks = await fetchIssues(true);
        res.json({ message: 'Bookmarks refreshed', count: bookmarks.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get available labels
app.get('/api/labels', async (req, res) => {
    try {
        const labels = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/labels`);
        res.json(labels.map(label => ({ name: label.name, color: label.color })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new bookmark
app.post('/api/bookmarks', async (req, res) => {
    try {
        const { title, link, description, tags } = req.body;
        
        if (!title || !link) {
            return res.status(400).json({ error: 'Title and link are required' });
        }

        const body = `Link: ${link}

Description: ${description || ''}

Tags: ${tags ? tags.join(' ') : ''}`;

        const issueData = {
            title,
            body,
            labels: tags || []
        };

        const newIssue = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`, {
            method: 'POST',
            body: JSON.stringify(issueData)
        });

        const bookmark = transformIssue(newIssue);
        
        // Update cache
        issuesCache.unshift(bookmark);
        
        res.status(201).json(bookmark);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update bookmark
app.put('/api/bookmarks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, link, description, tags } = req.body;
        
        if (!title || !link) {
            return res.status(400).json({ error: 'Title and link are required' });
        }

        const body = `Link: ${link}

Description: ${description || ''}

Tags: ${tags ? tags.join(' ') : ''}`;

        const issueData = {
            title,
            body,
            labels: tags || []
        };

        const updatedIssue = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(issueData)
        });

        const bookmark = transformIssue(updatedIssue);
        
        // Update cache
        const index = issuesCache.findIndex(item => item.id == id);
        if (index !== -1) {
            issuesCache[index] = bookmark;
        }
        
        res.json(bookmark);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete bookmark (close issue)
app.delete('/api/bookmarks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ state: 'closed' })
        });
        
        // Remove from cache
        issuesCache = issuesCache.filter(item => item.id != id);
        
        res.json({ message: 'Bookmark deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new label
app.post('/api/labels', async (req, res) => {
    try {
        const { name, color } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Label name is required' });
        }

        const labelData = {
            name,
            color: color || Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')
        };

        const newLabel = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/labels`, {
            method: 'POST',
            body: JSON.stringify(labelData)
        });

        res.status(201).json({ name: newLabel.name, color: newLabel.color });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🔗 GitHub Link Tracker UI running at http://localhost:${PORT}`);
    console.log(`📚 Access your bookmarks in your browser`);
    console.log(`🔄 Issues are cached for 5 minutes - use refresh button to update\n`);
    
    // Initial fetch
    fetchIssues().catch(err => {
        console.error('Initial fetch failed:', err.message);
        console.log('Will retry when API is called\n');
    });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down GitHub Link Tracker UI...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n👋 Shutting down GitHub Link Tracker UI...');
    process.exit(0);
});