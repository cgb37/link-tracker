#!/usr/bin/env node

/**
 * GitHub Link Tracker Data Migration Script
 *
 * This script migrates issues and labels from the current repository
 * to a new data repository for separating code and data.
 */

const https = require('https');
const { readFileSync } = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env') });

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const SOURCE_OWNER = process.env.GITHUB_OWNER || 'cgb37';
const SOURCE_REPO = process.env.GITHUB_REPO || 'link-tracker';

// New data repository details (will be prompted or set via env)
const TARGET_OWNER = process.env.TARGET_GITHUB_OWNER || SOURCE_OWNER;
const TARGET_REPO = process.env.TARGET_GITHUB_REPO;

// GitHub API base
const API_BASE = 'https://api.github.com';

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message) {
    log(`❌ Error: ${message}`, 'red');
}

function success(message) {
    log(`✅ ${message}`, 'green');
}

function info(message) {
    log(`ℹ️  ${message}`, 'blue');
}

function warning(message) {
    log(`⚠️  ${message}`, 'yellow');
}

// Helper function to make GitHub API requests
function githubRequest(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
        const url = `${API_BASE}${endpoint}`;
        const headers = {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'GitHub-Link-Tracker-Migration'
        };

        const reqOptions = {
            hostname: 'api.github.com',
            path: endpoint,
            method: options.method || 'GET',
            headers: { ...headers, ...options.headers }
        };

        if (options.body) {
            reqOptions.headers['Content-Length'] = Buffer.byteLength(options.body);
        }

        const req = https.request(reqOptions, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(JSON.parse(data));
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                } catch (e) {
                    reject(new Error(`Failed to parse response: ${data}`));
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        if (options.body) {
            req.write(options.body);
        }

        req.end();
    });
}

// Get all open issues from source repo
async function getSourceIssues() {
    info('Fetching issues from source repository...');
    try {
        const issues = [];
        let page = 1;
        const perPage = 100;

        while (true) {
            const endpoint = `/repos/${SOURCE_OWNER}/${SOURCE_REPO}/issues?state=open&page=${page}&per_page=${perPage}`;
            const pageIssues = await githubRequest(endpoint);

            if (pageIssues.length === 0) break;

            issues.push(...pageIssues);
            page++;

            if (pageIssues.length < perPage) break;
        }

        success(`Found ${issues.length} open issues`);
        return issues;
    } catch (err) {
        error(`Failed to fetch issues: ${err.message}`);
        throw err;
    }
}

// Get all labels from source repo
async function getSourceLabels() {
    info('Fetching labels from source repository...');
    try {
        const labels = await githubRequest(`/repos/${SOURCE_OWNER}/${SOURCE_REPO}/labels`);
        success(`Found ${labels.length} labels`);
        return labels;
    } catch (err) {
        error(`Failed to fetch labels: ${err.message}`);
        throw err;
    }
}

// Create labels in target repo
async function createLabelsInTarget(labels) {
    info('Creating labels in target repository...');
    const createdLabels = [];

    for (const label of labels) {
        try {
            const labelData = {
                name: label.name,
                color: label.color,
                description: label.description || ''
            };

            const newLabel = await githubRequest(`/repos/${TARGET_OWNER}/${TARGET_REPO}/labels`, {
                method: 'POST',
                body: JSON.stringify(labelData)
            });

            createdLabels.push(newLabel);
            log(`  Created label: ${label.name}`, 'cyan');
        } catch (err) {
            if (err.message.includes('already_exists')) {
                warning(`Label '${label.name}' already exists in target repo`);
            } else {
                error(`Failed to create label '${label.name}': ${err.message}`);
            }
        }
    }

    success(`Created ${createdLabels.length} labels`);
    return createdLabels;
}

// Create issues in target repo
async function createIssuesInTarget(issues) {
    info('Creating issues in target repository...');
    const createdIssues = [];

    for (const issue of issues) {
        try {
            const issueData = {
                title: issue.title,
                body: issue.body,
                labels: issue.labels.map(label => label.name)
            };

            const newIssue = await githubRequest(`/repos/${TARGET_OWNER}/${TARGET_REPO}/issues`, {
                method: 'POST',
                body: JSON.stringify(issueData)
            });

            createdIssues.push(newIssue);
            log(`  Created issue: ${issue.title} (ID: ${newIssue.number})`, 'cyan');

            // Add a small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err) {
            error(`Failed to create issue '${issue.title}': ${err.message}`);
        }
    }

    success(`Created ${createdIssues.length} issues`);
    return createdIssues;
}

// Close issues in source repo (optional)
async function closeSourceIssues(issues) {
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question('Do you want to close the original issues after migration? (y/N): ', async (answer) => {
            rl.close();

            if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
                info('Closing issues in source repository...');

                for (const issue of issues) {
                    try {
                        await githubRequest(`/repos/${SOURCE_OWNER}/${SOURCE_REPO}/issues/${issue.number}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ state: 'closed' })
                        });
                        log(`  Closed issue: ${issue.title}`, 'cyan');
                    } catch (err) {
                        error(`Failed to close issue '${issue.title}': ${err.message}`);
                    }
                }

                success('Closed issues in source repository');
            } else {
                info('Keeping original issues open');
            }

            resolve();
        });
    });
}

// Main migration function
async function migrateData() {
    try {
        // Validate environment
        if (!GITHUB_TOKEN) {
            error('GITHUB_TOKEN environment variable is not set');
            error('Please set it with: export GITHUB_TOKEN=your_token_here');
            process.exit(1);
        }

        if (!TARGET_REPO) {
            error('TARGET_GITHUB_REPO environment variable is not set');
            error('Please set it with: export TARGET_GITHUB_REPO=your_data_repo_name');
            process.exit(1);
        }

        log('🚀 Starting GitHub Link Tracker Data Migration', 'magenta');
        log('===============================================', 'magenta');
        log(`Source: ${SOURCE_OWNER}/${SOURCE_REPO}`);
        log(`Target: ${TARGET_OWNER}/${TARGET_REPO}`);
        log('');

        // Get source data
        const issues = await getSourceIssues();
        const labels = await getSourceLabels();

        if (issues.length === 0 && labels.length === 0) {
            info('No data to migrate');
            return;
        }

        // Create labels first
        if (labels.length > 0) {
            await createLabelsInTarget(labels);
        }

        // Create issues
        if (issues.length > 0) {
            await createIssuesInTarget(issues);
        }

        // Optionally close source issues
        if (issues.length > 0) {
            await closeSourceIssues(issues);
        }

        log('');
        success('Migration completed successfully!');
        log('You can now update your .env file to use the new data repository:', 'yellow');
        log(`GITHUB_OWNER=${TARGET_OWNER}`);
        log(`GITHUB_REPO=${TARGET_REPO}`);

    } catch (err) {
        error(`Migration failed: ${err.message}`);
        process.exit(1);
    }
}

// Run the migration
if (require.main === module) {
    migrateData();
}

module.exports = { migrateData };