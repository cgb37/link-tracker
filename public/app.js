// Global state
let bookmarks = [];
let allTags = [];
let activeTags = new Set();
let currentView = 'grid';
let searchQuery = '';
let editingBookmark = null;

// Initialize the application
async function init() {
    await loadBookmarks();
    await loadTags();
    setupEventListeners();
    renderBookmarks();
    renderFilterTags();
    updateFiltersUI();
}

// Event listeners
function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        updateSearchClearButton();
        renderBookmarks();
        updateFiltersUI();
    });

    const tagInput = document.getElementById('tagInput');
    const tagDropdown = document.getElementById('tagDropdown');

    // Tag input event listeners
    tagInput.addEventListener('input', (e) => {
        showTagDropdown(e.target.value);
    });

    tagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const value = e.target.value.trim();
            if (value) {
                addTagFromInput(value);
            }
        } else if (e.key === 'Escape') {
            hideTagDropdown();
        }
    });

    tagInput.addEventListener('focus', () => {
        showTagDropdown(tagInput.value);
    });

    // Hide dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!document.getElementById('tagInputContainer').contains(e.target)) {
            hideTagDropdown();
        }
    });

    // Close modal on background click
    document.getElementById('bookmarkModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('bookmarkModal')) {
            closeModal();
        }
    });

    // Form submission
    document.getElementById('bookmarkForm').addEventListener('submit', handleFormSubmit);
}

// Clear search functionality
function clearSearch() {
    document.getElementById('searchInput').value = '';
    searchQuery = '';
    updateSearchClearButton();
    renderBookmarks();
    updateFiltersUI();
}

function updateSearchClearButton() {
    const clearBtn = document.getElementById('searchClear');
    const searchInput = document.getElementById('searchInput');
    if (searchInput.value.trim()) {
        clearBtn.classList.add('visible');
    } else {
        clearBtn.classList.remove('visible');
    }
}

// Clear all filters functionality
function clearAllFilters() {
    // Clear search
    clearSearch();
    
    // Clear tag filters
    activeTags.clear();
    
    // Re-render everything
    renderBookmarks();
    renderFilterTags();
    updateFiltersUI();
    
    showSuccess('All filters cleared!');
}

// Update filters UI state
function updateFiltersUI() {
    const filtersContainer = document.getElementById('filtersContainer');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    const filtersInfo = document.getElementById('filtersInfo');
    
    const hasActiveFilters = searchQuery || activeTags.size > 0;
    
    if (hasActiveFilters) {
        filtersContainer.classList.add('filters-active');
        clearFiltersBtn.style.display = 'block';
        
        let infoText = '';
        if (searchQuery && activeTags.size > 0) {
            infoText = `Filtering by search and ${activeTags.size} tag${activeTags.size > 1 ? 's' : ''}`;
        } else if (searchQuery) {
            infoText = 'Filtering by search';
        } else if (activeTags.size > 0) {
            infoText = `Filtering by ${activeTags.size} tag${activeTags.size > 1 ? 's' : ''}`;
        }
        filtersInfo.textContent = infoText;
    } else {
        filtersContainer.classList.remove('filters-active');
        clearFiltersBtn.style.display = 'none';
        filtersInfo.textContent = 'Click tags to filter';
    }
}

// Tag dropdown functionality
function showTagDropdown(query = '') {
    const dropdown = document.getElementById('tagDropdown');
    const selectedTags = getSelectedTags();
    
    // Filter available tags
    const filteredTags = allTags.filter(tag => 
        !selectedTags.includes(tag.name) && 
        tag.name.toLowerCase().includes(query.toLowerCase())
    );

    let html = '';

    // Show existing tags
    filteredTags.forEach(tag => {
        html += `
            <div class="tag-dropdown-item" onclick="selectTagFromDropdown('${escapeAttribute(tag.name)}')">
                <span class="tag-preview" style="background-color: #${tag.color}; color: ${getContrastColor(tag.color)}">
                    ${escapeHtml(tag.name)}
                </span>
            </div>
        `;
    });

    // Show "Create new tag" option if query doesn't match existing tags exactly
    if (query && !allTags.some(tag => tag.name.toLowerCase() === query.toLowerCase())) {
        html += `
            <div class="tag-dropdown-item create-new" onclick="selectTagFromDropdown('${escapeAttribute(query)}', true)">
                <span>+ Create "${escapeHtml(query)}"</span>
            </div>
        `;
    }

    dropdown.innerHTML = html;
    dropdown.style.display = html ? 'block' : 'none';
}

function hideTagDropdown() {
    document.getElementById('tagDropdown').style.display = 'none';
}

function selectTagFromDropdown(tagName, isNew = false) {
    addSelectedTag(tagName);
    document.getElementById('tagInput').value = '';
    hideTagDropdown();
}

function addTagFromInput(value) {
    addSelectedTag(value);
    document.getElementById('tagInput').value = '';
    hideTagDropdown();
}

// Load bookmarks from API
async function loadBookmarks() {
    try {
        const response = await fetch('/api/bookmarks');
        if (!response.ok) throw new Error('Failed to load bookmarks');
        bookmarks = await response.json();
    } catch (error) {
        console.error('Error loading bookmarks:', error);
        showError('Failed to load bookmarks');
    }
}

// Load available tags
async function loadTags() {
    try {
        const response = await fetch('/api/labels');
        if (!response.ok) throw new Error('Failed to load tags');
        allTags = await response.json();
    } catch (error) {
        console.error('Error loading tags:', error);
    }
}

// Refresh bookmarks from GitHub
async function refreshBookmarks() {
    const btn = event.target;
    btn.textContent = 'Refreshing...';
    btn.disabled = true;
    
    try {
        const response = await fetch('/api/bookmarks/refresh', { method: 'POST' });
        if (!response.ok) throw new Error('Failed to refresh');
        
        await loadBookmarks();
        await loadTags();
        renderBookmarks();
        renderFilterTags();
        updateFiltersUI();
        showSuccess('Bookmarks refreshed successfully!');
    } catch (error) {
        console.error('Error refreshing:', error);
        showError('Failed to refresh bookmarks');
    } finally {
        btn.textContent = 'Refresh';
        btn.disabled = false;
    }
}

// Set view mode
function setView(view) {
    currentView = view;
    document.querySelectorAll('.view-toggle button').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    const container = document.getElementById('bookmarks');
    container.className = `bookmarks ${view}-view`;
}

// Filter and render bookmarks
function renderBookmarks() {
    const container = document.getElementById('bookmarks');
    
    let filtered = bookmarks.filter(bookmark => {
        // Search filter
        if (searchQuery) {
            const searchText = `${bookmark.title} ${bookmark.description} ${bookmark.link} ${bookmark.tags.map(t => t.name).join(' ')}`.toLowerCase();
            if (!searchText.includes(searchQuery)) return false;
        }
        
        // Tag filter
        if (activeTags.size > 0) {
            const hasActiveTag = bookmark.tags.some(tag => activeTags.has(tag.name));
            if (!hasActiveTag) return false;
        }
        
        return true;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No bookmarks found</h3>
                <p>${bookmarks.length === 0 ? 'Add your first bookmark to get started!' : 'Try adjusting your search or filters.'}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(bookmark => `
        <div class="bookmark" 
             data-id="${bookmark.id}"
             onclick="openLink('${escapeAttribute(bookmark.link)}')">
            
            <div class="bookmark-title">${escapeHtml(bookmark.title)}</div>
            <div class="bookmark-link">${escapeHtml(bookmark.link)}</div>
            ${bookmark.description ? `<div class="bookmark-description">${escapeHtml(bookmark.description)}</div>` : ''}
            
            <div class="bookmark-tags">
                ${bookmark.tags.map(tag => {
                    const color = tag.color || '666666';
                    return `<span class="tag" style="background-color: #${color}; color: ${getContrastColor(color)}">${escapeHtml(tag.name)}</span>`;
                }).join('')}
            </div>
            
            <div class="bookmark-meta tooltip" 
                 data-tooltip="Created: ${formatDate(bookmark.created)} | Updated: ${formatDate(bookmark.updated)}">
                <span>Issue #${bookmark.id}</span>
                <span>${formatDate(bookmark.created)}</span>
            </div>
            
            <div class="bookmark-actions">
                <button class="btn" onclick="event.stopPropagation(); editBookmark(${bookmark.id})">Edit</button>
                <button class="btn" onclick="event.stopPropagation(); deleteBookmark(${bookmark.id})" style="color: #d73a49;">Delete</button>
                <button class="btn" onclick="event.stopPropagation(); window.open('${escapeAttribute(bookmark.url)}', '_blank')">View Issue</button>
            </div>
        </div>
    `).join('');
}

// Render filter tags with improved highlighting
function renderFilterTags() {
    const container = document.getElementById('filterTags');
    
    const usedTagsMap = new Map();
    bookmarks.flatMap(b => b.tags).forEach(tag => {
        if (!usedTagsMap.has(tag.name)) {
            usedTagsMap.set(tag.name, tag);
        }
    });
    const usedTags = Array.from(usedTagsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    
    if (usedTags.length === 0) {
        container.innerHTML = '<span style="color: #586069;">No tags available</span>';
        return;
    }

    container.innerHTML = usedTags.map(tag => {
        const color = tag.color || '666666';
        const isActive = activeTags.has(tag.name);
        
        return `
            <span class="tag ${isActive ? 'active' : ''}" 
                  style="background-color: #${color}; color: ${getContrastColor(color)}"
                  onclick="toggleTagFilter('${escapeAttribute(tag.name)}')"
                  data-tag="${escapeAttribute(tag.name)}"
                  title="${isActive ? 'Click to remove filter' : 'Click to filter by this tag'}">
                ${escapeHtml(tag.name)}
            </span>
        `;
    }).join('');
}

// Toggle tag filter
function toggleTagFilter(tag) {
    if (activeTags.has(tag)) {
        activeTags.delete(tag);
    } else {
        activeTags.add(tag);
    }
    renderBookmarks();
    renderFilterTags();
    updateFiltersUI();
}

// Open create modal
function openCreateModal() {
    editingBookmark = null;
    document.getElementById('modalTitle').textContent = 'Add Bookmark';
    document.getElementById('bookmarkForm').reset();
    clearSelectedTags();
    document.getElementById('bookmarkModal').style.display = 'block';
    hideTagDropdown();
}

// Edit bookmark
function editBookmark(id) {
    const bookmark = bookmarks.find(b => b.id === id);
    if (!bookmark) return;
    
    editingBookmark = bookmark;
    document.getElementById('modalTitle').textContent = 'Edit Bookmark';
    document.getElementById('titleInput').value = bookmark.title;
    document.getElementById('linkInput').value = bookmark.link;
    document.getElementById('descriptionInput').value = bookmark.description || '';
    
    clearSelectedTags();
    bookmark.tags.forEach(tag => addSelectedTag(tag.name));
    
    document.getElementById('bookmarkModal').style.display = 'block';
    hideTagDropdown();
}

// Delete bookmark
async function deleteBookmark(id) {
    if (!confirm('Are you sure you want to delete this bookmark?')) return;
    
    try {
        const response = await fetch(`/api/bookmarks/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete bookmark');
        
        bookmarks = bookmarks.filter(b => b.id !== id);
        renderBookmarks();
        renderFilterTags();
        updateFiltersUI();
        showSuccess('Bookmark deleted successfully!');
    } catch (error) {
        console.error('Error deleting bookmark:', error);
        showError('Failed to delete bookmark');
    }
}

// Close modal
function closeModal() {
    document.getElementById('bookmarkModal').style.display = 'none';
    editingBookmark = null;
    hideTagDropdown();
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const title = document.getElementById('titleInput').value.trim();
    const link = document.getElementById('linkInput').value.trim();
    const description = document.getElementById('descriptionInput').value.trim();
    const tags = getSelectedTags();
    
    if (!title || !link) {
        showError('Title and link are required');
        return;
    }

    const bookmarkData = { title, link, description, tags };
    
    try {
        let response;
        if (editingBookmark) {
            response = await fetch(`/api/bookmarks/${editingBookmark.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookmarkData)
            });
        } else {
            response = await fetch('/api/bookmarks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookmarkData)
            });
        }
        
        if (!response.ok) throw new Error('Failed to save bookmark');
        
        const savedBookmark = await response.json();
        
        if (editingBookmark) {
            const index = bookmarks.findIndex(b => b.id === editingBookmark.id);
            if (index !== -1) bookmarks[index] = savedBookmark;
        } else {
            bookmarks.unshift(savedBookmark);
        }
        
        closeModal();
        await loadTags(); // Refresh tags in case new ones were created
        renderBookmarks();
        renderFilterTags();
        updateFiltersUI();
        showSuccess(`Bookmark ${editingBookmark ? 'updated' : 'created'} successfully!`);
    } catch (error) {
        console.error('Error saving bookmark:', error);
        showError('Failed to save bookmark');
    }
}

// Tag management functions
function addSelectedTag(tag) {
    const container = document.getElementById('tagInputContainer');
    const input = document.getElementById('tagInput');
    
    // Check if tag already exists
    if (getSelectedTags().includes(tag)) {
        return;
    }
    
    const tagElement = document.createElement('span');
    tagElement.className = 'selected-tag';
    tagElement.innerHTML = `
        ${escapeHtml(tag)}
        <button type="button" class="remove-tag" onclick="removeSelectedTag(this)">×</button>
    `;
    
    container.insertBefore(tagElement, input);
}

function removeSelectedTag(button) {
    button.parentElement.remove();
        }

function getSelectedTags() {
    const container = document.getElementById('tagInputContainer');
    const tags = container.querySelectorAll('.selected-tag');
    return Array.from(tags).map(tag => tag.textContent.replace('×', '').trim());
}

function clearSelectedTags() {
    const container = document.getElementById('tagInputContainer');
    container.querySelectorAll('.selected-tag').forEach(tag => tag.remove());
}

// Utility functions
function openLink(url) {
    window.open(url, '_blank');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeAttribute(text) {
    return text.replace(/'/g, '&#39;').replace(/"/g, '&quot;');
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString();
}

function getContrastColor(hexColor) {
    const r = parseInt(hexColor.substr(0, 2), 16);
    const g = parseInt(hexColor.substr(2, 2), 16);
    const b = parseInt(hexColor.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#ffffff';
}

function showSuccess(message) {
    showNotification(message, 'success');
}

function showError(message) {
    showNotification(message, 'error');
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 6px;
        color: white;
        font-weight: 500;
        z-index: 1001;
        animation: slideIn 0.3s ease-out;
        background-color: ${type === 'success' ? '#28a745' : '#dc3545'};
    `;
    notification.textContent = message;
    
    // Add animation keyframes if not already added
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', init);
