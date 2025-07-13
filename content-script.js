// ChatGPT Bookmark Extension - Content Script

// Configuration
const EXTENSION_PREFIX = 'chatgpt-bookmark';
const SEARCH_DEBOUNCE_DELAY = 300;
const MAX_CONTENT_LENGTH = 500;
const MAX_TITLE_LENGTH = 100;

// State management
let isInitialized = false;
let bookmarkedChats = new Set();
let searchTimeout = null;
let currentSearchResults = [];
let observer = null;
let pollingInterval = null;
let lastChatCount = 0;
let mutationTimeout = null;

// DOM elements
let searchContainer = null;
let searchInput = null;
let searchResults = null;
let bookmarksSection = null;
let bookmarksList = null;

// Indexing status elements
let indexingIndicator = null;

// Floating popup elements
let floatingPopup = null;
let floatingSearchInput = null;
let floatingSearchResults = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };

// Bookmark menu item elements
let bookmarkMenuItem = null;
let bookmarkDropdown = null;

// Initialize the extension
function initializeExtension() {
  if (isInitialized) return;
  
  try {
    // Wait for ChatGPT to fully load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeExtension);
      return;
    }
    
    // Check if we're on a ChatGPT page
    if (!isChatGPTPage()) {
      return;
    }
    
    console.log('Initializing ChatGPT Bookmark Extension...');
    
    // Create UI elements
    // createSearchBar();
    createBookmarkMenuItem();
    createBookmarkFoldersInSidebar();
    // createBookmarksSection();
    createFloatingPopup();
    createIndexingIndicator();
    
    // Auto-display the floating popup by default
    // showFloatingPopup();
    
    // Initialize bookmark data
    loadBookmarks();
    
    // Set up DOM observers
    setupDOMObserver();
    
    // Set up event listeners
    setupEventListeners();
    
    // Set up polling for dynamic updates
    setupPolling();
    
    // Set up API response interception
    setupAPIInterception();
    
    // Process existing chat entries
    processExistingChats();
    
    // Check for ongoing indexing status
    setTimeout(checkIndexingStatus, 1000);
    
    // Auto-start conversation crawl if needed
    setTimeout(autoStartCrawl, 2000);
    
    isInitialized = true;
    console.log('ChatGPT Bookmark Extension initialized successfully');
    
  } catch (error) {
    console.error('Failed to initialize ChatGPT Bookmark Extension:', error);
  }
}

// Check if we're on a ChatGPT page
function isChatGPTPage() {
  return window.location.hostname.includes('chat.openai.com') || 
         window.location.hostname.includes('chatgpt.com');
}

// Create search bar at the top of the sidebar
function createSearchBar() {
  const sidebar = document.querySelector('nav[aria-label="Chat history"]') || 
                  document.querySelector('#history') ||
                  document.querySelector('aside');
  
  if (!sidebar || document.querySelector(`.${EXTENSION_PREFIX}-search-container`)) {
    return;
  }
  
  // Create search container
  searchContainer = document.createElement('div');
  searchContainer.className = `${EXTENSION_PREFIX}-search-container`;
  
  // Create search wrapper
  const searchWrapper = document.createElement('div');
  searchWrapper.className = `${EXTENSION_PREFIX}-search-wrapper`;
  
  // Create search input
  searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search bookmarks...';
  searchInput.className = `${EXTENSION_PREFIX}-search-input`;
  
  // Create search results container
  searchResults = document.createElement('div');
  searchResults.className = `${EXTENSION_PREFIX}-search-results`;
  
  // Assemble search bar
  searchWrapper.appendChild(searchInput);
  searchWrapper.appendChild(searchResults);
  searchContainer.appendChild(searchWrapper);
  
  // Insert at the top of sidebar
  sidebar.insertBefore(searchContainer, sidebar.firstChild);
}

// Create bookmark menu item with modern, simplified approach
function createBookmarkMenuItem() {
  // Skip if already exists
  if (document.querySelector(`.${EXTENSION_PREFIX}-menu-item`)) return;
  
  // Find sidebar with simple, robust selector
  const sidebar = document.querySelector('nav[aria-label="Chat history"]');
  if (!sidebar) {
    setTimeout(createBookmarkMenuItem, 1000);
    return;
  }

  // Create modern menu item
  bookmarkMenuItem = document.createElement('div');
  bookmarkMenuItem.className = `${EXTENSION_PREFIX}-menu-item`;
  bookmarkMenuItem.innerHTML = `
    <button class="${EXTENSION_PREFIX}-menu-button">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
      </svg>
      <span>Bookmarks</span>
      <div class="${EXTENSION_PREFIX}-badge" style="display: none;">0</div>
    </button>
    <div class="${EXTENSION_PREFIX}-dropdown" style="display: none;"></div>
  `;

  // Add modern styles
  const style = document.createElement('style');
  style.textContent = `
    .${EXTENSION_PREFIX}-menu-item {
      position: relative;
      margin: 8px;
    }
    
    .${EXTENSION_PREFIX}-menu-button {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 10px 12px;
      background: transparent;
      border: none;
      border-radius: 8px;
      color: #ececec;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: inherit;
    }
    
    .${EXTENSION_PREFIX}-menu-button:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    
    .${EXTENSION_PREFIX}-menu-button svg {
      flex-shrink: 0;
      opacity: 0.8;
      transition: opacity 0.2s ease;
    }
    
    .${EXTENSION_PREFIX}-menu-button:hover svg {
      opacity: 1;
    }
    
    .${EXTENSION_PREFIX}-menu-button span {
      flex: 1;
      text-align: left;
    }
    
    .${EXTENSION_PREFIX}-badge {
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
      border-radius: 12px;
      padding: 4px 8px;
      font-size: 11px;
      font-weight: 600;
      min-width: 20px;
      text-align: center;
      box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
    }
    
    .${EXTENSION_PREFIX}-dropdown {
      position: absolute;
      top: calc(100% + 8px);
      left: 0;
      right: 0;
      background: #1f1f1f;
      border: 1px solid #333;
      border-radius: 12px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(16px);
      max-height: 400px;
      overflow-y: auto;
      z-index: 10000;
      animation: slideDown 0.2s ease;
    }
    
    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-8px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
  `;
  
  // Add styles to document if not already added
  if (!document.querySelector(`#${EXTENSION_PREFIX}-menu-styles`)) {
    style.id = `${EXTENSION_PREFIX}-menu-styles`;
    document.head.appendChild(style);
  }

  // Add event listeners
  const button = bookmarkMenuItem.querySelector(`.${EXTENSION_PREFIX}-menu-button`);
  bookmarkDropdown = bookmarkMenuItem.querySelector(`.${EXTENSION_PREFIX}-dropdown`);
  
  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleBookmarkDropdown();
  });

  // Insert at the top of sidebar
  sidebar.insertBefore(bookmarkMenuItem, sidebar.firstChild);

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!bookmarkMenuItem.contains(e.target)) {
      hideBookmarkDropdown();
    }
  });
}

// Toggle bookmark dropdown
function toggleBookmarkDropdown() {
  console.log('toggleBookmarkDropdown called, current display:', bookmarkDropdown?.style.display);
  if (!bookmarkDropdown) {
    console.error('bookmarkDropdown is null!');
    return;
  }
  
  if (bookmarkDropdown.style.display === 'none' || bookmarkDropdown.style.display === '') {
    console.log('Showing bookmark dropdown');
    showBookmarkDropdown();
  } else {
    console.log('Hiding bookmark dropdown');
    hideBookmarkDropdown();
  }
}

// Show bookmark dropdown
function showBookmarkDropdown() {
  if (!bookmarkDropdown) {
    console.error('bookmarkDropdown is null in showBookmarkDropdown!');
    return;
  }
  
  console.log('showBookmarkDropdown called');
  
  // Populate dropdown with bookmarks
  populateBookmarkDropdown();
  
  bookmarkDropdown.style.display = 'block';
  console.log('Set dropdown display to block');
  
  // Add animation
  bookmarkDropdown.style.opacity = '0';
  bookmarkDropdown.style.transform = 'translateY(-4px)';
  
  setTimeout(() => {
    bookmarkDropdown.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
    bookmarkDropdown.style.opacity = '1';
    bookmarkDropdown.style.transform = 'translateY(0)';
    console.log('Animation applied to dropdown');
  }, 10);
}

// Hide bookmark dropdown
function hideBookmarkDropdown() {
  if (!bookmarkDropdown) return;
  
  bookmarkDropdown.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
  bookmarkDropdown.style.opacity = '0';
  bookmarkDropdown.style.transform = 'translateY(-4px)';
  
  setTimeout(() => {
    bookmarkDropdown.style.display = 'none';
  }, 150);
}

// Populate bookmark dropdown with items organized by subfolders
async function populateBookmarkDropdown() {
  if (!bookmarkDropdown) {
    console.error('bookmarkDropdown is null in populateBookmarkDropdown!');
    return;
  }
  
  console.log('populateBookmarkDropdown called');
  
  try {
    // Fetch both folders and bookmarks
    const foldersResponse = await sendMessageToBackground('getAllFolders');
    const bookmarksResponse = await sendMessageToBackground('getAllBookmarks');
    
    const folders = foldersResponse.success ? foldersResponse.data || [] : [];
    const bookmarks = bookmarksResponse.success ? bookmarksResponse.data || [] : [];
    
    console.log('Got folders:', folders.length, 'bookmarks:', bookmarks.length);
    
    bookmarkDropdown.innerHTML = '';
    
    if (bookmarks.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px 16px;
        color: rgba(255, 255, 255, 0.5);
        font-size: 14px;
        gap: 8px;
      `;
      emptyState.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="opacity: 0.5;">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
        <span>No bookmarks yet</span>
      `;
      bookmarkDropdown.appendChild(emptyState);
      console.log('Added empty state to dropdown');
      return;
    }

    // Group bookmarks by folder
    const bookmarksByFolder = {};
    const folderMap = {};
    
    // Create folder map for easy lookup
    folders.forEach(folder => {
      folderMap[folder.id] = folder;
      bookmarksByFolder[folder.id] = [];
    });
    
    // Add default folder if not exists
    if (!bookmarksByFolder['default']) {
      bookmarksByFolder['default'] = [];
    }
    
    // Group bookmarks by their folder
    bookmarks.forEach(bookmark => {
      const folderId = bookmark.folderId || 'default';
      if (!bookmarksByFolder[folderId]) {
        bookmarksByFolder[folderId] = [];
      }
      bookmarksByFolder[folderId].push(bookmark);
    });

    // Find root folders (no parent or parent is 'default')
    const rootFolders = folders.filter(f => !f.parentId || f.parentId === 'default');
    
    // If no folders exist, show all bookmarks under "All Bookmarks"
    if (folders.length === 0) {
      createFolderSection('All Bookmarks', bookmarks);
      return;
    }

    // Note: Default folder is handled by the regular folder loop below
    // No need to create a separate "Uncategorized" section here

    // Show each root folder and its subfolders
    rootFolders.forEach(folder => {
      const subfolders = folders.filter(f => f.parentId === folder.id);
      
      if (subfolders.length > 0) {
        // This folder has subfolders, show them
        createFolderHeader(folder.name);
        
        subfolders.forEach(subfolder => {
          const subfolderBookmarks = bookmarksByFolder[subfolder.id] || [];
          if (subfolderBookmarks.length > 0) {
            createFolderSection(subfolder.name, subfolderBookmarks, true);
          }
        });
      } else {
        // This folder has no subfolders, show its bookmarks directly
        const folderBookmarks = bookmarksByFolder[folder.id] || [];
        if (folderBookmarks.length > 0) {
          createFolderSection(folder.name, folderBookmarks);
        }
      }
    });

    // Helper function to create folder header
    function createFolderHeader(folderName) {
      const header = document.createElement('div');
      header.style.cssText = `
        padding: 8px 12px 4px 12px;
        font-size: 12px;
        font-weight: 600;
        color: rgba(255, 215, 0, 0.8);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        margin-top: 4px;
      `;
      header.textContent = folderName;
      bookmarkDropdown.appendChild(header);
    }

    // Helper function to create folder section with bookmarks
    function createFolderSection(folderName, folderBookmarks, isSubfolder = false) {
      // Folder header
      const header = document.createElement('div');
      header.style.cssText = `
        padding: 8px 12px 4px ${isSubfolder ? '20px' : '12px'};
        font-size: ${isSubfolder ? '11px' : '12px'};
        font-weight: 600;
        color: ${isSubfolder ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.8)'};
        text-transform: uppercase;
        letter-spacing: 0.5px;
        ${!isSubfolder && bookmarkDropdown.children.length > 0 ? 'border-top: 1px solid rgba(255, 255, 255, 0.1); margin-top: 4px;' : ''}
      `;
      header.textContent = folderName;
      bookmarkDropdown.appendChild(header);

      // Bookmarks in this folder
      folderBookmarks.forEach(bookmark => {
        const item = document.createElement('div');
        item.className = `${EXTENSION_PREFIX}-dropdown-item`;
        item.style.cssText = `
          display: flex;
          align-items: center;
          padding: 6px 12px 6px ${isSubfolder ? '28px' : '20px'};
          cursor: pointer;
          transition: background-color 0.15s ease;
          border-radius: 6px;
          margin: 1px 4px;
          gap: 8px;
        `;
        
        // Icon
        const icon = document.createElement('div');
        icon.style.cssText = `
          width: 14px;
          height: 14px;
          flex-shrink: 0;
          color: rgba(255, 255, 255, 0.5);
        `;
        icon.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        `;
        
        // Title
        const title = document.createElement('div');
        title.style.cssText = `
          font-size: 13px;
          color: rgba(255, 255, 255, 0.9);
          font-weight: 400;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex: 1;
          line-height: 18px;
        `;
        title.textContent = bookmark.title;
        
        item.appendChild(icon);
        item.appendChild(title);
        
        // Add hover effect
        item.addEventListener('mouseenter', () => {
          item.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
        });
        
        item.addEventListener('mouseleave', () => {
          item.style.backgroundColor = 'transparent';
        });
        
        // Add click handler
        item.addEventListener('click', () => {
          hideBookmarkDropdown();
          if (bookmark.url) {
            window.location.href = bookmark.url;
          }
        });
        
        bookmarkDropdown.appendChild(item);
      });
    }

  } catch (error) {
    console.error('Failed to populate bookmark dropdown:', error);
  }
}

// Update bookmark menu badge count
function updateBookmarkMenuBadge(count) {
  const badge = document.querySelector(`.${EXTENSION_PREFIX}-badge`);
  if (badge) {
    badge.textContent = count.toString();
    badge.style.display = count > 0 ? 'block' : 'none';
  }
}

// Create bookmark folders in ChatGPT's native sidebar
async function createBookmarkFoldersInSidebar() {
  // Skip if already exists
  if (document.querySelector(`.${EXTENSION_PREFIX}-folders-section`)) return;
  
  // Find the sidebar section where projects are displayed
  const projectsSection = document.querySelector('aside[id*="snorlax"]') || 
                         document.querySelector('aside.pt-\\(--sidebar-section-margin-top\\)') ||
                         document.querySelector('nav[aria-label="Chat history"]')?.closest('aside');
  
  if (!projectsSection) {
    console.log('Projects section not found, retrying...');
    setTimeout(createBookmarkFoldersInSidebar, 2000);
    return;
  }
  
  try {
    // Fetch bookmark folders
    const foldersResponse = await sendMessageToBackground('getAllFolders');
    const bookmarksResponse = await sendMessageToBackground('getAllBookmarks');
    
    if (!foldersResponse.success || !bookmarksResponse.success) {
      console.error('Failed to load folders or bookmarks');
      return;
    }
    
    const folders = foldersResponse.data || [];
    const bookmarks = bookmarksResponse.data || [];
    
    // Group bookmarks by folder
    const bookmarksByFolder = {};
    folders.forEach(folder => {
      bookmarksByFolder[folder.id] = [];
    });
    
    bookmarks.forEach(bookmark => {
      const folderId = bookmark.folderId || 'default';
      if (!bookmarksByFolder[folderId]) {
        bookmarksByFolder[folderId] = [];
      }
      bookmarksByFolder[folderId].push(bookmark);
    });
    
    // Create the bookmark folders section
    const bookmarkSection = document.createElement('aside');
    bookmarkSection.className = `pt-(--sidebar-section-margin-top) last:mb-5 ${EXTENSION_PREFIX}-folders-section`;
    bookmarkSection.id = 'bookmark-folders-section';
    
    // Add section header
    const headerDiv = document.createElement('div');
    headerDiv.className = 'group __menu-item hoverable gap-1.5';
    headerDiv.tabIndex = 0;
    headerDiv.setAttribute('data-fill', '');
    
    headerDiv.innerHTML = `
      <div class="flex items-center justify-center group-disabled:opacity-50 group-data-disabled:opacity-50 icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" class="icon" aria-hidden="true">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      </div>
      Bookmark Folders
    `;
    
    bookmarkSection.appendChild(headerDiv);
    
    // Add folder items (excluding default folder or show it as "Uncategorized")
    const visibleFolders = folders.filter(folder => {
      const folderBookmarks = bookmarksByFolder[folder.id] || [];
      return folderBookmarks.length > 0; // Only show folders with bookmarks
    });
    
    visibleFolders.forEach(folder => {
      const folderBookmarks = bookmarksByFolder[folder.id] || [];
      
      // Create folder item matching ChatGPT's style
      const folderItem = document.createElement('a');
      folderItem.className = 'group __menu-item hoverable';
      folderItem.tabIndex = 0;
      folderItem.setAttribute('data-fill', '');
      folderItem.style.cursor = 'pointer';
      
      // Use folder name, but show "Uncategorized" for default folder
      const displayName = folder.id === 'default' ? 'Uncategorized' : folder.name;
      
      folderItem.innerHTML = `
        <div class="flex min-w-0 items-center gap-1.5">
          <div class="flex items-center justify-center group-disabled:opacity-50 group-data-disabled:opacity-50 icon">
            <button class="icon" data-state="closed">
              <div class="[&_path]:stroke-current text-token-text-primary" style="width: 20px; height: 20px;">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20">
                  <path stroke-linecap="round" stroke-linejoin="miter" fill-opacity="0" stroke-miterlimit="4" stroke="rgb(156, 163, 175)" stroke-opacity="1" stroke-width="1.33" d="M3 4.5A1.5 1.5 0 0 1 4.5 3h3.379a1 1 0 0 1 .707.293L10 4.707A1 1 0 0 0 10.707 5H15.5A1.5 1.5 0 0 1 17 6.5v7A1.5 1.5 0 0 1 15.5 15h-11A1.5 1.5 0 0 1 3 13.5V4.5Z"/>
                </svg>
              </div>
            </button>
          </div>
          <div class="flex min-w-0 grow items-center gap-2.5">
            <div class="truncate">${displayName}</div>
          </div>
        </div>
        <div class="text-token-text-tertiary flex items-center self-stretch">
          <span class="text-xs">${folderBookmarks.length}</span>
        </div>
      `;
      
      // Add click handler to show folder bookmarks
      folderItem.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showFolderBookmarks(folder, folderBookmarks, folderItem);
      });
      
      bookmarkSection.appendChild(folderItem);
    });
    
    // Insert the bookmark section after the projects section or at the beginning
    if (projectsSection.nextSibling) {
      projectsSection.parentNode.insertBefore(bookmarkSection, projectsSection.nextSibling);
    } else {
      projectsSection.parentNode.appendChild(bookmarkSection);
    }
    
    console.log('Bookmark folders section created successfully');
    
  } catch (error) {
    console.error('Failed to create bookmark folders section:', error);
  }
}

// Show bookmarks for a specific folder in an inline dropdown
function showFolderBookmarks(folder, bookmarks, folderElement) {
  console.log(`Showing ${bookmarks.length} bookmarks for folder: ${folder.name}`);
  
  // Remove any existing folder dropdown
  const existingDropdown = document.querySelector(`.${EXTENSION_PREFIX}-folder-dropdown`);
  if (existingDropdown) {
    existingDropdown.remove();
  }
  
  // Create overlay dropdown that doesn't affect layout
  const folderDropdown = document.createElement('div');
  folderDropdown.className = `${EXTENSION_PREFIX}-folder-dropdown`;
  
  // Get folder element position for positioning
  const folderRect = folderElement.getBoundingClientRect();
  
  // Position dropdown to the right of the folder item
  const dropdownWidth = 280; // Fixed width for better UX
  const rightPosition = folderRect.right + 8; // 8px gap from the folder
  const availableSpace = window.innerWidth - rightPosition;
  
  // If not enough space on the right, position it to the left
  const shouldPositionLeft = availableSpace < dropdownWidth;
  const leftPosition = shouldPositionLeft ? folderRect.left - dropdownWidth - 8 : rightPosition;
  
  folderDropdown.style.cssText = `
    position: fixed;
    top: ${folderRect.top}px;
    left: ${leftPosition}px;
    width: ${dropdownWidth}px;
    background: #1f1f1f;
    border: 1px solid #333;
    border-radius: 12px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(16px);
    max-height: 400px;
    overflow-y: auto;
    opacity: 0;
    transform: translateY(-8px) scale(0.98);
    transition: all 0.2s ease;
    z-index: 10000;
  `;
  
  // Add bookmarks directly to dropdown (matching existing bookmark dropdown structure)
  if (bookmarks.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px 16px;
      color: rgba(255, 255, 255, 0.5);
      font-size: 14px;
      gap: 8px;
    `;
    emptyState.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="opacity: 0.5;">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
      <span>No bookmarks in this folder</span>
    `;
    folderDropdown.appendChild(emptyState);
  } else {
    bookmarks.forEach(bookmark => {
      const item = document.createElement('div');
      item.className = `${EXTENSION_PREFIX}-dropdown-item`;
      item.style.cssText = `
        display: flex;
        align-items: center;
        padding: 6px 12px 6px 20px;
        cursor: pointer;
        transition: background-color 0.15s ease;
        border-radius: 6px;
        margin: 1px 4px;
        gap: 8px;
      `;
      
      // Icon
      const icon = document.createElement('div');
      icon.style.cssText = `
        width: 14px;
        height: 14px;
        flex-shrink: 0;
        color: rgba(255, 255, 255, 0.5);
      `;
      icon.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      `;
      
      // Title
      const title = document.createElement('div');
      title.style.cssText = `
        font-size: 13px;
        color: rgba(255, 255, 255, 0.9);
        font-weight: 400;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
        line-height: 18px;
      `;
      title.textContent = bookmark.title;
      title.title = bookmark.title; // Tooltip for long titles
      
      item.appendChild(icon);
      item.appendChild(title);
      
      // Add hover effect
      item.addEventListener('mouseenter', () => {
        item.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
      });
      
      item.addEventListener('mouseleave', () => {
        item.style.backgroundColor = 'transparent';
      });
      
      // Add click handler
      item.addEventListener('click', () => {
        if (bookmark.url) {
          window.location.href = bookmark.url;
        }
        hideFolderDropdown();
      });
      
      folderDropdown.appendChild(item);
    });
  }
  
  // Add dropdown to body as overlay
  document.body.appendChild(folderDropdown);
  
  // Animate in (matching existing bookmark dropdown animation)
  setTimeout(() => {
    folderDropdown.style.opacity = '1';
    folderDropdown.style.transform = 'translateY(0) scale(1)';
  }, 10);
  
  // Store reference for cleanup
  window.currentFolderDropdown = folderDropdown;
  
  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', hideFolderDropdownOnOutsideClick);
  }, 100);
}

// Hide folder dropdown
function hideFolderDropdown() {
  const dropdown = document.querySelector(`.${EXTENSION_PREFIX}-folder-dropdown`);
  if (dropdown) {
    dropdown.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
    dropdown.style.opacity = '0';
    dropdown.style.transform = 'translateY(-4px)';
    
    setTimeout(() => {
      dropdown.remove();
    }, 150);
  }
  
  // Clean up event listener
  document.removeEventListener('click', hideFolderDropdownOnOutsideClick);
  window.currentFolderDropdown = null;
}

// Hide folder dropdown on outside click
function hideFolderDropdownOnOutsideClick(e) {
  const dropdown = document.querySelector(`.${EXTENSION_PREFIX}-folder-dropdown`);
  const folderSection = document.querySelector(`.${EXTENSION_PREFIX}-folders-section`);
  
  if (dropdown && !dropdown.contains(e.target) && 
      (!folderSection || !folderSection.contains(e.target))) {
    hideFolderDropdown();
  }
}

// Refresh bookmark folders section (call when bookmarks change)
async function refreshBookmarkFoldersSection() {
  const existingSection = document.querySelector(`.${EXTENSION_PREFIX}-folders-section`);
  if (existingSection) {
    existingSection.remove();
  }
  
  // Recreate the section
  await createBookmarkFoldersInSidebar();
}

// Create bookmarks section
function createBookmarksSection() {
  const sidebar = document.querySelector('nav[aria-label="Chat history"]') || 
                  document.querySelector('#history') ||
                  document.querySelector('aside');
  
  if (!sidebar || document.querySelector(`.${EXTENSION_PREFIX}-section`)) {
    return;
  }
  
  // Create bookmarks section
  bookmarksSection = document.createElement('div');
  bookmarksSection.className = `${EXTENSION_PREFIX}-section`;
  
  // Create header
  const header = document.createElement('div');
  header.className = `${EXTENSION_PREFIX}-header`;
  
  const title = document.createElement('div');
  title.className = `${EXTENSION_PREFIX}-title`;
  title.textContent = 'Bookmarks';
  
  const count = document.createElement('div');
  count.className = `${EXTENSION_PREFIX}-count`;
  count.textContent = '0';
  
  header.appendChild(title);
  header.appendChild(count);
  
  // Create bookmarks list
  bookmarksList = document.createElement('div');
  bookmarksList.className = `${EXTENSION_PREFIX}-list`;
  
  // Create empty state
  const emptyState = document.createElement('div');
  emptyState.className = `${EXTENSION_PREFIX}-empty`;
  emptyState.textContent = 'No bookmarks yet';
  bookmarksList.appendChild(emptyState);
  
  // Assemble bookmarks section
  bookmarksSection.appendChild(header);
  bookmarksSection.appendChild(bookmarksList);
  
  // Append to sidebar
  sidebar.appendChild(bookmarksSection);

  // Add click handler to show subfolders and bookmarks
  bookmarksSection.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await showSubfoldersAndBookmarksCS();
  });
}

// Show subfolders and bookmarks in content script
async function showSubfoldersAndBookmarksCS() {
  if (!bookmarksList) return;
  bookmarksList.innerHTML = '';

  // Fetch all folders and bookmarks
  const foldersResp = await sendMessageToBackground('getAllFolders');
  const bookmarksResp = await sendMessageToBackground('getAllBookmarks');
  const folders = foldersResp.success ? foldersResp.data || [] : [];
  const bookmarks = bookmarksResp.success ? bookmarksResp.data || [] : [];

  // Find root-level folders (parentId === null or 'default')
  const rootFolders = folders.filter(f => !f.parentId || f.parentId === 'default');
  const subfolders = folders.filter(f => f.parentId && f.parentId !== 'default');

  if (folders.length === 0) {
    // No folders, show all bookmarks
    renderBookmarksListCS(bookmarksList, bookmarks, 'All Bookmarks');
    return;
  }

  if (rootFolders.length === 0 && subfolders.length === 0) {
    // No subfolders, show bookmarks in root
    renderBookmarksListCS(bookmarksList, bookmarks.filter(b => !b.folderId || b.folderId === 'default'), 'Bookmarks');
    return;
  }

  // For each root folder, show its subfolders and bookmarks
  let hasAny = false;
  for (const folder of rootFolders) {
    // Subfolders of this folder
    const children = folders.filter(f => f.parentId === folder.id);
    if (children.length === 0) continue;
    const section = document.createElement('div');
    section.className = `${EXTENSION_PREFIX}-subfolder-section`;
    const title = document.createElement('div');
    title.className = `${EXTENSION_PREFIX}-subfolder-title`;
    title.textContent = folder.name;
    section.appendChild(title);
    for (const sub of children) {
      const subSection = document.createElement('div');
      subSection.className = `${EXTENSION_PREFIX}-subfolder-section`;
      const subTitle = document.createElement('div');
      subTitle.className = `${EXTENSION_PREFIX}-subfolder-title`;
      subTitle.textContent = sub.name;
      subSection.appendChild(subTitle);
      const subBookmarks = bookmarks.filter(b => b.folderId === sub.id);
      renderBookmarksListCS(subSection, subBookmarks, '');
      section.appendChild(subSection);
      hasAny = hasAny || subBookmarks.length > 0;
    }
    bookmarksList.appendChild(section);
  }
  if (!hasAny) {
    bookmarksList.innerHTML = `<div class="${EXTENSION_PREFIX}-empty">No bookmarks in any subfolder</div>`;
  }
}

function renderBookmarksListCS(container, bookmarks, sectionTitle) {
  if (sectionTitle) {
    const title = document.createElement('div');
    title.className = `${EXTENSION_PREFIX}-subfolder-title`;
    title.textContent = sectionTitle;
    container.appendChild(title);
  }
  if (!bookmarks || bookmarks.length === 0) {
    const empty = document.createElement('div');
    empty.className = `${EXTENSION_PREFIX}-empty`;
    empty.textContent = 'No bookmarks yet';
    container.appendChild(empty);
    return;
  }
  bookmarks.forEach(bookmark => {
    const item = document.createElement('div');
    item.className = `${EXTENSION_PREFIX}-item`;
    const content = document.createElement('div');
    content.className = `${EXTENSION_PREFIX}-item-content`;
    const title = document.createElement('div');
    title.className = `${EXTENSION_PREFIX}-item-title`;
    title.textContent = bookmark.title;
    const preview = document.createElement('div');
    preview.className = `${EXTENSION_PREFIX}-item-preview`;
    preview.textContent = bookmark.content.substring(0, 50) + '...';
    const timestamp = document.createElement('div');
    timestamp.className = `${EXTENSION_PREFIX}-item-timestamp`;
    timestamp.textContent = formatTimestamp(bookmark.timestamp);
    content.appendChild(title);
    content.appendChild(preview);
    item.appendChild(content);
    item.appendChild(timestamp);
    item.addEventListener('click', () => {
      if (bookmark.url) {
        window.location.href = bookmark.url;
      }
    });
    container.appendChild(item);
  });
}

// Create indexing status indicator
function createIndexingIndicator() {
  // Check if indicator already exists
  if (indexingIndicator || document.querySelector(`.${EXTENSION_PREFIX}-indexing-indicator`)) {
    return;
  }
  
  // Create the indicator container
  indexingIndicator = document.createElement('div');
  indexingIndicator.className = `${EXTENSION_PREFIX}-indexing-indicator`;
  indexingIndicator.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
    border: 1px solid #444;
    border-radius: 12px;
    padding: 12px 16px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    display: none;
    align-items: center;
    gap: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #e5e5e5;
    font-size: 14px;
    font-weight: 500;
    min-width: 200px;
    backdrop-filter: blur(10px);
    animation: slideInFromRight 0.3s ease-out;
  `;
  
  // Create spinner
  const spinner = document.createElement('div');
  spinner.className = `${EXTENSION_PREFIX}-indexing-spinner`;
  spinner.style.cssText = `
    width: 16px;
    height: 16px;
    border: 2px solid #444;
    border-top: 2px solid #00a67e;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    flex-shrink: 0;
  `;
  
  // Create text container
  const textContainer = document.createElement('div');
  textContainer.style.cssText = `
    flex: 1;
    min-width: 0;
  `;
  
  // Create main text
  const mainText = document.createElement('div');
  mainText.textContent = 'Indexing chats...';
  mainText.style.cssText = `
    font-weight: 500;
    color: #e5e5e5;
    margin-bottom: 2px;
  `;
  
  // Create progress text
  const progressText = document.createElement('div');
  progressText.className = `${EXTENSION_PREFIX}-indexing-progress`;
  progressText.textContent = '0 messages processed';
  progressText.style.cssText = `
    font-size: 12px;
    color: #999;
    font-weight: 400;
  `;
  
  // Assemble the indicator
  textContainer.appendChild(mainText);
  textContainer.appendChild(progressText);
  indexingIndicator.appendChild(spinner);
  indexingIndicator.appendChild(textContainer);
  
  // Add to document
  document.body.appendChild(indexingIndicator);
  
  // Add CSS animations
  addIndexingIndicatorStyles();
  
  console.log('Indexing indicator created');
}

// Add CSS styles for indexing indicator
function addIndexingIndicatorStyles() {
  if (document.querySelector(`#${EXTENSION_PREFIX}-indexing-styles`)) {
    return;
  }
  
  const style = document.createElement('style');
  style.id = `${EXTENSION_PREFIX}-indexing-styles`;
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    @keyframes slideInFromRight {
      0% {
        transform: translateX(100%);
        opacity: 0;
      }
      100% {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes slideOutToRight {
      0% {
        transform: translateX(0);
        opacity: 1;
      }
      100% {
        transform: translateX(100%);
        opacity: 0;
      }
    }
    
    .${EXTENSION_PREFIX}-indexing-indicator.hiding {
      animation: slideOutToRight 0.3s ease-in forwards;
    }
  `;
  
  document.head.appendChild(style);
}

// Show indexing indicator
function showIndexingIndicator(messageCount = 0) {
  if (!indexingIndicator) {
    createIndexingIndicator();
  }
  
  if (indexingIndicator) {
    indexingIndicator.style.display = 'flex';
    indexingIndicator.classList.remove('hiding');
    
    // Update progress text
    const progressElement = indexingIndicator.querySelector(`.${EXTENSION_PREFIX}-indexing-progress`);
    if (progressElement) {
      progressElement.textContent = `${messageCount} messages processed`;
    }
  }
}

// Hide indexing indicator
function hideIndexingIndicator() {
  if (indexingIndicator) {
    indexingIndicator.classList.add('hiding');
    setTimeout(() => {
      if (indexingIndicator) {
        indexingIndicator.style.display = 'none';
        indexingIndicator.classList.remove('hiding');
      }
    }, 300);
  }
}

// Update indexing progress
function updateIndexingProgress(messageCount) {
  if (indexingIndicator) {
    const progressElement = indexingIndicator.querySelector(`.${EXTENSION_PREFIX}-indexing-progress`);
    if (progressElement) {
      progressElement.textContent = `${messageCount} messages processed`;
    }
  }
}

// Check current indexing status from background
async function checkIndexingStatus() {
  try {
    const response = await sendMessageToBackground('getIndexingStatus');
    if (response.success && response.data) {
      const { isIndexing, progress } = response.data;
      if (isIndexing) {
        showIndexingIndicator(progress || 0);
      } else {
        hideIndexingIndicator();
      }
    }
  } catch (error) {
    console.error('Failed to check indexing status:', error);
  }
}

// Create floating search popup
function createFloatingPopup() {
  // Check if popup already exists
  if (floatingPopup || document.querySelector(`.${EXTENSION_PREFIX}-floating-popup`)) {
    return;
  }
  
  // Create backdrop
  floatingBackdrop = document.createElement('div');
  floatingBackdrop.className = `${EXTENSION_PREFIX}-floating-backdrop`;
  
  // Create popup container
  floatingPopup = document.createElement('div');
  floatingPopup.className = `${EXTENSION_PREFIX}-floating-popup`;
  
  // Create header for dragging
  const header = document.createElement('div');
  header.className = `${EXTENSION_PREFIX}-floating-header`;
  header.innerHTML = `
    <div class="${EXTENSION_PREFIX}-floating-title">
      Search chats
    </div>
    <button class="${EXTENSION_PREFIX}-floating-close">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>
    </button>
  `;
  
  // Create content area
  const content = document.createElement('div');
  content.className = `${EXTENSION_PREFIX}-floating-content`;
  
  // Create search input container
  const searchInputContainer = document.createElement('div');
  searchInputContainer.className = `${EXTENSION_PREFIX}-floating-search-input-container`;
  
  // Create search icon
  const searchIcon = document.createElement('div');
  searchIcon.className = `${EXTENSION_PREFIX}-floating-search-icon`;
  searchIcon.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
    </svg>
  `;
  
  // Create search input
  floatingSearchInput = document.createElement('input');
  floatingSearchInput.type = 'text';
  floatingSearchInput.placeholder = 'Search chats...';
  floatingSearchInput.className = `${EXTENSION_PREFIX}-floating-search-input`;
  
  // Assemble search input container
  searchInputContainer.appendChild(searchIcon);
  searchInputContainer.appendChild(floatingSearchInput);
  
  // Create search results container
  floatingSearchResults = document.createElement('div');
  floatingSearchResults.className = `${EXTENSION_PREFIX}-floating-search-results`;
  
  // Create keyboard navigation hint
  const hint = document.createElement('div');
  hint.className = `${EXTENSION_PREFIX}-floating-search-hint`;
  hint.innerHTML = `
    <kbd>↑</kbd><kbd>↓</kbd> to navigate
    <kbd>Enter</kbd> to select
    <kbd>Esc</kbd> to close
  `;
  
  // Assemble popup
  content.appendChild(searchInputContainer);
  content.appendChild(floatingSearchResults);
  floatingPopup.appendChild(header);
  floatingPopup.appendChild(content);
  floatingPopup.appendChild(hint);
  
  // Add to document body
  document.body.appendChild(floatingBackdrop);
  document.body.appendChild(floatingPopup);
  
  // Setup backdrop click to close
  floatingBackdrop.addEventListener('click', hideFloatingPopup);
  
  // Setup dragging functionality
  setupFloatingPopupDragging();
  
  // Setup search functionality
  setupFloatingPopupSearch();
  
  // Setup close functionality
  setupFloatingPopupClose();
}

// Setup dragging functionality for floating popup
function setupFloatingPopupDragging() {
  const header = floatingPopup.querySelector(`.${EXTENSION_PREFIX}-floating-header`);
  
  const startDrag = (e) => {
    // Don't drag if clicking on close button
    if (e.target.closest(`.${EXTENSION_PREFIX}-floating-close`)) {
      return;
    }
    
    isDragging = true;
    
    // Get client coordinates (works for both mouse and touch)
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    
    // Get current position accounting for transforms
    const rect = floatingPopup.getBoundingClientRect();
    dragOffset.x = clientX - rect.left;
    dragOffset.y = clientY - rect.top;
    
    // Remove transform and set explicit position
    const computedStyle = window.getComputedStyle(floatingPopup);
    const currentLeft = rect.left;
    const currentTop = rect.top;
    
    // Disable transitions during drag
    floatingPopup.style.transition = 'none';
    floatingPopup.style.transform = 'none';
    floatingPopup.style.left = currentLeft + 'px';
    floatingPopup.style.top = currentTop + 'px';
    
    // Set cursor and add event listeners
    header.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none'; // Prevent text selection during drag
    
    // Add both mouse and touch event listeners
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchmove', handleDrag, { passive: false });
    document.addEventListener('touchend', stopDrag);
    
    e.preventDefault();
  };
  
  header.addEventListener('mousedown', startDrag);
  header.addEventListener('touchstart', startDrag, { passive: false });
}

function handleDrag(e) {
  if (!isDragging) return;
  
  // Get client coordinates (works for both mouse and touch)
  const clientX = e.clientX || (e.touches && e.touches[0].clientX);
  const clientY = e.clientY || (e.touches && e.touches[0].clientY);
  
  // Calculate new position
  const x = clientX - dragOffset.x;
  const y = clientY - dragOffset.y;
  
  // Get popup dimensions
  const popupWidth = floatingPopup.offsetWidth;
  const popupHeight = floatingPopup.offsetHeight;
  
  // Keep popup within viewport bounds with some padding
  const padding = 10;
  const maxX = window.innerWidth - popupWidth - padding;
  const maxY = window.innerHeight - popupHeight - padding;
  
  const boundedX = Math.max(padding, Math.min(x, maxX));
  const boundedY = Math.max(padding, Math.min(y, maxY));
  
  // Apply new position
  floatingPopup.style.left = boundedX + 'px';
  floatingPopup.style.top = boundedY + 'px';
  
  // Prevent scrolling on touch devices
  if (e.type === 'touchmove') {
    e.preventDefault();
  }
}

function stopDrag() {
  if (!isDragging) return;
  
  isDragging = false;
  
  // Restore cursor and user selection
  const header = floatingPopup.querySelector(`.${EXTENSION_PREFIX}-floating-header`);
  header.style.cursor = 'grab';
  document.body.style.userSelect = '';
  
  // Re-enable transitions
  floatingPopup.style.transition = 'all 0.3s ease';
  
  // Remove all event listeners
  document.removeEventListener('mousemove', handleDrag);
  document.removeEventListener('mouseup', stopDrag);
  document.removeEventListener('touchmove', handleDrag);
  document.removeEventListener('touchend', stopDrag);
}

// Setup search functionality for floating popup
function setupFloatingPopupSearch() {
  let floatingSearchTimeout = null;
  
  floatingSearchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    
    clearTimeout(floatingSearchTimeout);
    floatingSearchTimeout = setTimeout(() => {
      if (query.length === 0) {
        hideFloatingSearchResults();
      } else {
        performFloatingSearch(query);
      }
    }, SEARCH_DEBOUNCE_DELAY);
  });
  
  floatingSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideFloatingPopup();
    } else if (e.key === 'Enter') {
      const firstResult = floatingSearchResults.querySelector(`.${EXTENSION_PREFIX}-floating-search-result`);
      if (firstResult) {
        firstResult.click();
      }
    }
  });
}

// Perform search in floating popup
async function performFloatingSearch(query) {
  try {
    const response = await sendMessageToBackground('searchConversations', { 
      query, 
      options: { limit: 20 } 
    });
    if (response.success) {
      displayFloatingSearchResults(response.data || []);
    }
  } catch (error) {
    console.error('Floating search failed:', error);
  }
}

// Display search results in floating popup
function displayFloatingSearchResults(results) {
  if (!floatingSearchResults) return;
  
  floatingSearchResults.innerHTML = '';
  
  if (results.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = `${EXTENSION_PREFIX}-floating-search-empty`;
    emptyState.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
      </svg>
      <h3>No conversations found</h3>
      <p>Try adjusting your search terms or check if you have any conversations to search through.</p>
    `;
    floatingSearchResults.appendChild(emptyState);
  } else {
    results.forEach(result => {
      const resultElement = document.createElement('div');
      resultElement.className = `${EXTENSION_PREFIX}-floating-search-result`;
      
      const title = document.createElement('div');
      title.className = `${EXTENSION_PREFIX}-floating-search-result-title`;
      title.textContent = result.title || 'Untitled Conversation';
      
      const preview = document.createElement('div');
      preview.className = `${EXTENSION_PREFIX}-floating-search-result-preview`;
      
      // Show the first relevant message snippet
      if (result.messages && result.messages.length > 0) {
        const firstMessage = result.messages[0];
        if (firstMessage && firstMessage.text && typeof firstMessage.text === 'string') {
          const snippet = firstMessage.snippet || firstMessage.text.substring(0, 80) + (firstMessage.text.length > 80 ? '...' : '');
          preview.textContent = snippet;
        } else {
          preview.textContent = 'No content available';
        }
      } else {
        preview.textContent = 'No content available';
      }
      
      const timestamp = document.createElement('div');
      timestamp.className = `${EXTENSION_PREFIX}-floating-search-result-timestamp`;
      const lastUpdate = result.lastUpdate && typeof result.lastUpdate === 'number' ? result.lastUpdate * 1000 : Date.now();
      timestamp.textContent = formatTimestamp(lastUpdate);
      
      const messageCount = document.createElement('div');
      messageCount.className = `${EXTENSION_PREFIX}-floating-search-result-count`;
      const messageLength = result.messages && Array.isArray(result.messages) ? result.messages.length : 0;
      messageCount.textContent = `${messageLength} messages`;
      
      resultElement.appendChild(title);
      resultElement.appendChild(preview);
      
      const meta = document.createElement('div');
      meta.className = `${EXTENSION_PREFIX}-floating-search-result-meta`;
      meta.appendChild(timestamp);
      meta.appendChild(messageCount);
      
      resultElement.appendChild(meta);
      
      // Add click handler
      resultElement.addEventListener('click', () => {
        if (result && result.id) {
          handleFloatingSearchResultClick(result);
        }
      });
      
      floatingSearchResults.appendChild(resultElement);
    });
  }
  
  showFloatingSearchResults();
}

// Handle floating search result click
function handleFloatingSearchResultClick(result) {
  if (!result || !result.id) {
    console.error('Invalid result object for navigation');
    return;
  }
  
  hideFloatingPopup();
  
  // Navigate to the conversation
  window.location.pathname = `/c/${result.id}`;
  
  // If there's a specific message to scroll to
  if (result.messages && Array.isArray(result.messages) && result.messages.length > 0) {
    const firstMessage = result.messages[0];
    
    if (firstMessage && firstMessage.id) {
      // Wait for the page to load, then scroll to the message
      setTimeout(() => {
        const messageElement = document.querySelector(`[data-message-id="${firstMessage.id}"]`);
        if (messageElement) {
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Highlight the message briefly
          messageElement.style.backgroundColor = 'rgba(255, 215, 0, 0.2)';
          setTimeout(() => {
            messageElement.style.backgroundColor = '';
          }, 2000);
        }
      }, 1000);
    }
  }
}

// Show/hide floating search results
function showFloatingSearchResults() {
  if (floatingSearchResults) {
    floatingSearchResults.classList.add('show');
  }
}

function hideFloatingSearchResults() {
  if (floatingSearchResults) {
    floatingSearchResults.classList.remove('show');
  }
}

// Setup close functionality for floating popup
function setupFloatingPopupClose() {
  const closeButton = floatingPopup.querySelector(`.${EXTENSION_PREFIX}-floating-close`);
  closeButton.addEventListener('click', hideFloatingPopup);
}

// Show/hide floating popup
function showFloatingPopup() {
  if (floatingPopup && floatingBackdrop) {
    // Reset position to center if not already positioned
    if (!floatingPopup.style.left || !floatingPopup.style.top) {
      const popupWidth = 448; // Updated width to match ChatGPT style
      const popupHeight = 300; // Approximate height
      
      const centerX = (window.innerWidth - popupWidth) / 2;
      const centerY = window.innerHeight * 0.2; // 20% from top
      
      floatingPopup.style.left = Math.max(10, centerX) + 'px';
      floatingPopup.style.top = Math.max(10, centerY) + 'px';
      floatingPopup.style.transform = 'none';
    }
    
    // Show backdrop first, then popup
    floatingBackdrop.classList.add('visible');
    floatingPopup.classList.add('visible');
    
    // Focus the search input
    setTimeout(() => {
      floatingSearchInput?.focus();
    }, 100);
  }
}

function hideFloatingPopup() {
  if (floatingPopup && floatingBackdrop) {
    floatingBackdrop.classList.remove('visible');
    floatingPopup.classList.remove('visible');
    floatingSearchInput.value = '';
    hideFloatingSearchResults();
  }
}

function toggleFloatingPopup() {
  if (floatingPopup) {
    if (floatingPopup.classList.contains('visible')) {
      hideFloatingPopup();
    } else {
      showFloatingPopup();
    }
  }
}

// Setup triggers for floating popup (keyboard shortcuts and button clicks)
function setupFloatingPopupTriggers() {
  // Keyboard shortcut: Cmd+S (Mac) or Ctrl+S (Windows/Linux)
  document.addEventListener('keydown', (e) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const isShortcut = isMac ? (e.metaKey && e.key === 's') : (e.ctrlKey && e.key === 's');
    
    if (isShortcut) {
      // Only trigger if focus is not inside an input or textarea
      const activeElement = document.activeElement;
      const isInInput = activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' || 
        activeElement.contentEditable === 'true'
      );
      
      if (!isInInput) {
        e.preventDefault();
        toggleFloatingPopup();
      }
    }
    
    // ESC to close floating popup
    if (e.key === 'Escape' && floatingPopup && floatingPopup.classList.contains('visible')) {
      hideFloatingPopup();
    }
  });
  
  // Button click listener
  function setupButtonListener() {
    const button = document.querySelector('#page-header button.group.user-select-none.ps-2.focus-visible\\:outline-0');
    if (button) {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFloatingPopup();
      });
    } else {
      // If button not found, try again in a bit (for dynamic loading)
      setTimeout(setupButtonListener, 1000);
    }
  }
  
  // Initial button setup
  setupButtonListener();
  
  // Also check for button after navigation
  let lastUrl = location.href;
  const urlObserver = new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      setTimeout(setupButtonListener, 1000);
    }
  });
  urlObserver.observe(document.body, { childList: true, subtree: true });
}

// Load bookmarks from storage
async function loadBookmarks() {
  try {
    const response = await sendMessageToBackground('getAllBookmarks');
    if (response.success) {
      const bookmarks = response.data || [];
      bookmarkedChats.clear();
      bookmarks.forEach(bookmark => {
        bookmarkedChats.add(bookmark.id);
      });
      updateBookmarksUI(bookmarks);
      updateBookmarkIcons();
      updateBookmarkMenuBadge(bookmarks.length);
    }
  } catch (error) {
    console.error('Failed to load bookmarks:', error);
  }
}

// Set up DOM observer to detect new chat entries
function setupDOMObserver() {
  observer = new MutationObserver((mutations) => {
    let shouldUpdate = false;
    let newChatItems = [];
    
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        // Check for new chat entries
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if the node itself is a chat item
            if (node.matches && node.matches('#history a.group.__menu-item')) {
              newChatItems.push(node);
              shouldUpdate = true;
            }
            // Check if the node contains chat items
            const chatItems = node.querySelectorAll('#history a.group.__menu-item');
            if (chatItems.length > 0) {
              newChatItems.push(...chatItems);
              shouldUpdate = true;
            }
          }
        });
      }
    });
    
    if (shouldUpdate) {
      // Clear any existing timeout
      if (mutationTimeout) {
        clearTimeout(mutationTimeout);
      }
      
      // Debounce the update to prevent excessive processing
      mutationTimeout = setTimeout(() => {
        // Process new items immediately
        newChatItems.forEach(addBookmarkIcon);
        // Also do a full update to catch any missed items
        processExistingChats();
        updateBookmarkIcons();
      }, 100);
    }
  });
  
  // Start observing the document body and the history element specifically
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Also observe the history element directly if it exists
  const historyElement = document.querySelector('#history');
  if (historyElement) {
    observer.observe(historyElement, {
      childList: true,
      subtree: true
    });
  }
}

// Set up polling mechanism as fallback for dynamic content
function setupPolling() {
  // Clear any existing polling
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
  
  // Poll every 2 seconds to check for new chat items
  pollingInterval = setInterval(() => {
    const currentChatItems = document.querySelectorAll('#history a.group.__menu-item');
    const currentCount = currentChatItems.length;
    
    // If the count changed, process new items
    if (currentCount !== lastChatCount) {
      console.log(`Chat count changed from ${lastChatCount} to ${currentCount}`);
      
      // Process all items (addBookmarkIcon will skip existing ones)
      currentChatItems.forEach(addBookmarkIcon);
      updateBookmarkIcons();
      
      lastChatCount = currentCount;
    }
  }, 2000);
}

// Set up API response interception to catch when new conversations are loaded
function setupAPIInterception() {
  // Intercept fetch requests to detect when conversations are loaded
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const promise = originalFetch.apply(this, args);
    
    // Check if this is a conversations API call
    const url = args[0];
    if (typeof url === 'string' && url.includes('/backend-api/conversations')) {
      promise.then(response => {
        // If the response is successful, wait a bit and then check for new items
        if (response.ok) {
          setTimeout(() => {
            const chatItems = document.querySelectorAll('#history a.group.__menu-item');
            if (chatItems.length !== lastChatCount) {
              console.log('API response detected new conversations, processing...');
              chatItems.forEach(addBookmarkIcon);
              updateBookmarkIcons();
              lastChatCount = chatItems.length;
            }
          }, 500);
        }
      }).catch(() => {
        // Ignore errors
      });
    }
    
    return promise;
  };
}

// Set up event listeners
function setupEventListeners() {
  // Search input events
  if (searchInput) {
    searchInput.addEventListener('input', handleSearchInput);
    searchInput.addEventListener('focus', handleSearchFocus);
    searchInput.addEventListener('blur', handleSearchBlur);
  }
  
  // Document click to close search results
  document.addEventListener('click', (e) => {
    if (!searchContainer?.contains(e.target)) {
      hideSearchResults();
    }
    
    // Close floating popup if clicking outside it
    if (floatingPopup && !floatingPopup.contains(e.target)) {
      hideFloatingPopup();
    }
  });
  
  // Handle page navigation
  window.addEventListener('popstate', handleNavigation);
  
  // Setup floating popup keyboard shortcuts and button listener
  setupFloatingPopupTriggers();
  
  // Handle URL changes (for SPA navigation)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      handleNavigation();
    }
  }).observe(document, { subtree: true, childList: true });
  
  // Listen for scroll events in the history area to catch dynamic loading
  const historyArea = document.querySelector('#history') || document.querySelector('nav[aria-label="Chat history"]');
  if (historyArea) {
    historyArea.addEventListener('scroll', debounce(() => {
      // Check for new items when scrolling
      const chatItems = document.querySelectorAll('#history a.group.__menu-item');
      if (chatItems.length !== lastChatCount) {
        console.log('Scroll detected new items, processing...');
        chatItems.forEach(addBookmarkIcon);
        updateBookmarkIcons();
        lastChatCount = chatItems.length;
      }
    }, 500));
  }
}

// Process existing chat entries on page load
function processExistingChats() {
  const chatItems = document.querySelectorAll('#history a.group.__menu-item');
  
  // Update the count for polling
  lastChatCount = chatItems.length;
  
  chatItems.forEach(addBookmarkIcon);
}

// Add bookmark icon to a chat item
function addBookmarkIcon(chatItem) {
  if (!chatItem || chatItem.querySelector(`.${EXTENSION_PREFIX}-icon`)) {
    return;
  }
  
  const chatId = extractChatId(chatItem);
  if (!chatId) return;
  
  // Find the flex container where we'll add the bookmark icon
  const flexContainer = chatItem.querySelector('.flex.min-w-0.grow.items-center.gap-2\\.5');
  if (!flexContainer) return;
  
  // Create bookmark icon
  const bookmarkIcon = document.createElement('div');
  bookmarkIcon.className = `${EXTENSION_PREFIX}-icon`;
  bookmarkIcon.innerHTML = `
    <svg class="${EXTENSION_PREFIX}-star" viewBox="0 0 24 24" width="16" height="16">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  `;
  
  // Style the icon container
  bookmarkIcon.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 2px;
    border-radius: 4px;
    transition: all 0.2s;
    opacity: 0.6;
    color: #8e8e8e;
    flex-shrink: 0;
  `;
  
  // Set bookmark state
  if (bookmarkedChats.has(chatId)) {
    bookmarkIcon.classList.add('bookmarked');
    bookmarkIcon.style.color = '#ffd700';
    bookmarkIcon.style.opacity = '1';
  }
  
  // Add hover effects
  bookmarkIcon.addEventListener('mouseenter', () => {
    bookmarkIcon.style.opacity = '1';
    bookmarkIcon.style.transform = 'scale(1.1)';
    bookmarkIcon.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
  });
  
  bookmarkIcon.addEventListener('mouseleave', () => {
    if (!bookmarkedChats.has(chatId)) {
      bookmarkIcon.style.opacity = '0.6';
    }
    bookmarkIcon.style.transform = 'scale(1)';
    bookmarkIcon.style.backgroundColor = 'transparent';
  });
  
  // Add click handler
  bookmarkIcon.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleBookmark(chatId, chatItem);
  });
  
  // Insert the bookmark icon at the beginning of the flex container
  flexContainer.insertBefore(bookmarkIcon, flexContainer.firstChild);
}

// Extract chat ID from DOM element
function extractChatId(element) {
  // Try to get ID from href attribute
  const href = element.href;
  if (href) {
    const match = href.match(/\/c\/([a-zA-Z0-9-]+)/);
    if (match) return match[1];
  }
  
  // Try data attributes
  const dataId = element.dataset.id || element.dataset.testid;
  if (dataId) return dataId;
  
  // Fallback to text content hash
  const textContent = element.textContent?.trim();
  if (textContent) {
    return generateSimpleHash(textContent);
  }
  
  return null;
}

// Extract chat data from DOM
function extractChatData(chatItem) {
  const chatId = extractChatId(chatItem);
  if (!chatId) return null;
  
  // Extract title from the span element
  let title = chatItem.querySelector('span[dir="auto"]')?.textContent?.trim() ||
              chatItem.querySelector('.truncate span')?.textContent?.trim() ||
              chatItem.textContent?.trim() ||
              'Untitled Chat';
  
  title = title.substring(0, MAX_TITLE_LENGTH);
  
  // Extract content (try to get conversation content from current page)
  let content = '';
  try {
    // If we're on the same conversation page, get recent messages
    if (window.location.pathname.includes(chatId)) {
      const messages = document.querySelectorAll('[data-testid^="conversation-turn"]');
      const recentMessages = Array.from(messages).slice(-5);
      content = recentMessages.map(msg => msg.textContent).join(' ');
    }
  } catch (e) {
    // Fallback to using title as content
  }
  
  if (!content || content.trim().length === 0) {
    content = title;
  }
  
  content = content.substring(0, MAX_CONTENT_LENGTH);
  
  // Get the full URL
  const fullUrl = chatItem.href.startsWith('http') ? chatItem.href : 
                  `${window.location.origin}${chatItem.href}`;
  
  return {
    id: chatId,
    title: title,
    content: content,
    timestamp: Date.now(),
    url: fullUrl
  };
}

// Toggle bookmark status
async function toggleBookmark(chatId, chatItem) {
  try {
    const chatData = extractChatData(chatItem);
    if (!chatData) return;
    
    const response = await sendMessageToBackground('toggleBookmark', {
      id: chatId,
      bookmark: chatData
    });
    
    if (response.success) {
      const icon = chatItem.querySelector(`.${EXTENSION_PREFIX}-icon`);
      if (response.bookmarked) {
        bookmarkedChats.add(chatId);
        icon?.classList.add('bookmarked');
        if (icon) {
          icon.style.color = '#ffd700';
          icon.style.opacity = '1';
        }
      } else {
        bookmarkedChats.delete(chatId);
        icon?.classList.remove('bookmarked');
        if (icon) {
          icon.style.color = '#8e8e8e';
          icon.style.opacity = '0.6';
        }
      }
      
      // Add pulse animation
      if (icon) {
        icon.style.animation = 'bookmarkPulse 0.3s ease-in-out';
        setTimeout(() => {
          icon.style.animation = '';
        }, 300);
      }
      
      // Refresh bookmarks UI
      loadBookmarks();
      
      // Refresh bookmark folders section
      refreshBookmarkFoldersSection();
    }
  } catch (error) {
    console.error('Failed to toggle bookmark:', error);
  }
}

// Update bookmark icons based on current state
function updateBookmarkIcons() {
  const icons = document.querySelectorAll(`.${EXTENSION_PREFIX}-icon`);
  icons.forEach(icon => {
    const chatItem = icon.closest('a');
    const chatId = extractChatId(chatItem);
    
    if (chatId && bookmarkedChats.has(chatId)) {
      icon.classList.add('bookmarked');
      icon.style.color = '#ffd700';
      icon.style.opacity = '1';
    } else {
      icon.classList.remove('bookmarked');
      icon.style.color = '#8e8e8e';
      icon.style.opacity = '0.6';
    }
  });
}

// Handle search input
function handleSearchInput(e) {
  const query = e.target.value.trim();
  
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    if (query.length === 0) {
      hideSearchResults();
    } else {
      performSearch(query);
    }
  }, SEARCH_DEBOUNCE_DELAY);
}

// Handle search focus
function handleSearchFocus() {
  if (searchInput.value.trim()) {
    showSearchResults();
  }
}

// Handle search blur
function handleSearchBlur() {
  // Delay hiding to allow click events on results
  setTimeout(() => {
    if (!searchContainer?.contains(document.activeElement)) {
      hideSearchResults();
    }
  }, 200);
}

// Perform search
async function performSearch(query) {
  try {
    const response = await sendMessageToBackground('searchBookmarks', { query });
    if (response.success) {
      currentSearchResults = response.data || [];
      displaySearchResults(currentSearchResults);
    }
  } catch (error) {
    console.error('Search failed:', error);
  }
}

// Display search results
function displaySearchResults(results) {
  if (!searchResults) return;
  
  searchResults.innerHTML = '';
  
  if (results.length === 0) {
    const noResults = document.createElement('div');
    noResults.className = `${EXTENSION_PREFIX}-search-result`;
    noResults.innerHTML = '<div style="text-align: center; color: #8e8e8e;">No bookmarks found</div>';
    searchResults.appendChild(noResults);
  } else {
    results.forEach(result => {
      const resultElement = document.createElement('div');
      resultElement.className = `${EXTENSION_PREFIX}-search-result`;
      
      const title = document.createElement('div');
      title.className = `${EXTENSION_PREFIX}-search-result-title`;
      title.textContent = result.title;
      
      const preview = document.createElement('div');
      preview.className = `${EXTENSION_PREFIX}-search-result-preview`;
      preview.textContent = result.content.substring(0, 100) + '...';
      
      const timestamp = document.createElement('div');
      timestamp.className = `${EXTENSION_PREFIX}-search-result-timestamp`;
      timestamp.textContent = formatTimestamp(result.timestamp);
      
      resultElement.appendChild(title);
      resultElement.appendChild(preview);
      resultElement.appendChild(timestamp);
      
      // Add click handler
      resultElement.addEventListener('click', () => {
        handleSearchResultClick(result);
      });
      
      searchResults.appendChild(resultElement);
    });
  }
  
  showSearchResults();
}

// Handle search result click
function handleSearchResultClick(result) {
  hideSearchResults();
  searchInput.value = '';
  
  // Navigate to the bookmarked chat if possible
  if (result.url) {
    window.location.href = result.url;
  }
}

// Show search results
function showSearchResults() {
  if (searchResults) {
    searchResults.classList.add('show');
  }
}

// Hide search results
function hideSearchResults() {
  if (searchResults) {
    searchResults.classList.remove('show');
  }
}

// Update bookmarks UI
function updateBookmarksUI(bookmarks) {
  if (!bookmarksList) return;
  
  // Update count
  const countElement = document.querySelector(`.${EXTENSION_PREFIX}-count`);
  if (countElement) {
    countElement.textContent = bookmarks.length.toString();
  }
  
  // Clear existing items
  bookmarksList.innerHTML = '';
  
  if (bookmarks.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = `${EXTENSION_PREFIX}-empty`;
    emptyState.textContent = 'No bookmarks yet';
    bookmarksList.appendChild(emptyState);
  } else {
    bookmarks.forEach(bookmark => {
      const item = document.createElement('div');
      item.className = `${EXTENSION_PREFIX}-item`;
      
      const content = document.createElement('div');
      content.className = `${EXTENSION_PREFIX}-item-content`;
      
      const title = document.createElement('div');
      title.className = `${EXTENSION_PREFIX}-item-title`;
      title.textContent = bookmark.title;
      
      const preview = document.createElement('div');
      preview.className = `${EXTENSION_PREFIX}-item-preview`;
      preview.textContent = bookmark.content.substring(0, 50) + '...';
      
      const timestamp = document.createElement('div');
      timestamp.className = `${EXTENSION_PREFIX}-item-timestamp`;
      timestamp.textContent = formatTimestamp(bookmark.timestamp);
      
      content.appendChild(title);
      content.appendChild(preview);
      item.appendChild(content);
      item.appendChild(timestamp);
      
      // Add click handler
      item.addEventListener('click', () => {
        if (bookmark.url) {
          window.location.href = bookmark.url;
        }
      });
      
      bookmarksList.appendChild(item);
    });
  }
}

// Handle navigation changes
function handleNavigation() {
  setTimeout(() => {
    if (isChatGPTPage()) {
      // Reinitialize UI elements if needed
      if (!document.querySelector(`.${EXTENSION_PREFIX}-menu-item`)) {
        createBookmarkMenuItem();
      }
      
      // Reinitialize bookmark folders section if needed
      if (!document.querySelector(`.${EXTENSION_PREFIX}-folders-section`)) {
        createBookmarkFoldersInSidebar();
      }
      
      // Reinitialize polling for the new page
      setupPolling();
      processExistingChats();
      updateBookmarkIcons();
    }
  }, 1000);
}

// Send message to background script
function sendMessageToBackground(action, data = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action, ...data }, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

// Utility functions
function generateSimpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) {
    return 'now';
  } else if (diff < 3600000) {
    return Math.floor(diff / 60000) + 'm';
  } else if (diff < 86400000) {
    return Math.floor(diff / 3600000) + 'h';
  } else {
    return Math.floor(diff / 86400000) + 'd';
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initializeExtension, 500);
  });
} else {
  setTimeout(initializeExtension, 500);
}

// Also initialize on page load
window.addEventListener('load', () => {
  setTimeout(initializeExtension, 500);
});

// Handle extension messages
chrome.runtime.onMessage.addListener((request) => {
  switch (request.action) {
    case 'refresh':
      loadBookmarks();
      break;
    case 'search':
      if (request.query) {
        searchInput.value = request.query;
        performSearch(request.query);
      }
      break;
  }
  
  // Handle indexing status updates
  switch (request.type) {
    case 'indexingProgress':
      showIndexingIndicator(request.messageCount || 0);
      break;
    case 'indexingComplete':
      hideIndexingIndicator();
      break;
  }
});

// Cleanup function
function cleanup() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  if (mutationTimeout) {
    clearTimeout(mutationTimeout);
    mutationTimeout = null;
  }
}

// Clean up on page unload
window.addEventListener('beforeunload', cleanup);
window.addEventListener('unload', cleanup);

// Also clean up when the extension is disabled/removed
if (chrome.runtime && chrome.runtime.onSuspend) {
  chrome.runtime.onSuspend.addListener(cleanup);
}

// Add a global function for debugging
window.chatgptBookmarkDebug = {
  processChats: () => {
    console.log('Manually processing chat items...');
    processExistingChats();
    updateBookmarkIcons();
    console.log(`Processed ${lastChatCount} chat items`);
  },
  getStats: () => {
    const chatItems = document.querySelectorAll('#history a.group.__menu-item');
    const iconsCount = document.querySelectorAll('.chatgpt-bookmark-icon').length;
    return {
      totalChats: chatItems.length,
      iconsAdded: iconsCount,
      bookmarkedChats: bookmarkedChats.size,
      isInitialized: isInitialized,
      floatingPopupVisible: floatingPopup?.classList.contains('visible') || false
    };
  },
  showFloatingPopup: () => {
    showFloatingPopup();
  },
  hideFloatingPopup: () => {
    hideFloatingPopup();
  },
  toggleFloatingPopup: () => {
    toggleFloatingPopup();
  },
  startCrawl: async (isFullCrawl = false) => {
    return await startConversationCrawl(isFullCrawl);
  },
  getCrawlStatus: () => {
    return getCrawlStatus();
  },
  showBookmarkDropdown: () => {
    showBookmarkDropdown();
  },
  hideBookmarkDropdown: () => {
    hideBookmarkDropdown();
  },
  toggleBookmarkDropdown: () => {
    toggleBookmarkDropdown();
  },
  testBookmarkDropdown: () => {
    console.log('Testing bookmark dropdown...');
    console.log('bookmarkMenuItem:', bookmarkMenuItem);
    console.log('bookmarkDropdown:', bookmarkDropdown);
    if (bookmarkDropdown) {
      bookmarkDropdown.style.display = 'block';
      bookmarkDropdown.style.background = 'red';
      bookmarkDropdown.innerHTML = '<div style="padding: 20px; color: white;">TEST DROPDOWN</div>';
    }
  }
};

// Conversation crawl functions
async function startConversationCrawl(isFullCrawl = false) {
  try {
    console.log(`Starting ${isFullCrawl ? 'full' : 'incremental'} conversation crawl...`);
    
    // Get last sync time from background
    const lastSyncResponse = await sendMessageToBackground('getMeta', { key: 'lastSync' });
    const lastSync = isFullCrawl ? 0 : (lastSyncResponse.success ? lastSyncResponse.data || 0 : 0);
    
    console.log(`Last sync: ${lastSync}`);
    
    // Crawl conversations directly in content script
    const result = await crawlConversationsInContent(lastSync);
    
    if (result.success) {
      console.log(`Crawl completed successfully. Processed ${result.processed} messages.`);
      
      // Show a toast notification
      showToast(`Indexed ${result.processed} messages from your conversations`);
      
      return result;
    } else {
      console.error('Crawl failed:', result.error);
      
      // Show error toast
      showToast(`Crawl failed: ${result.error}`, 'error');
      
      return result;
    }
  } catch (error) {
    console.error('Error starting crawl:', error);
    showToast('Error starting crawl. Please try again.', 'error');
    return { success: false, error: error.message };
  }
}

async function getCrawlStatus() {
  try {
    const response = await sendMessageToBackground('getCrawlProgress');
    return response.success ? response.data : { isCrawling: false, progress: { current: 0, total: 0 } };
  } catch (error) {
    console.error('Error getting crawl status:', error);
    return { isCrawling: false, progress: { current: 0, total: 0 } };
  }
}

// Crawl conversations in content script with proper headers/cookies
async function crawlConversationsInContent(lastSync) {
  let crawlProgress = { current: 0, total: 0 };
  
  // Show indexing indicator when starting
  showIndexingIndicator(0);

  // Check if we should skip crawling based on last sync time
  const currentTime = Date.now();
  const oneHourInMs = 60 * 10 * 1000; // 10 minutes in milliseconds
  
  if (lastSync && (currentTime - lastSync) < oneHourInMs) {
    const timeSinceLastSync = Math.round((currentTime - lastSync) / (60 * 1000)); // minutes
    console.log(`Skipping crawl - last sync was ${timeSinceLastSync} minutes ago (less than 1 hour)`);
    
    // Hide indicator since we're not crawling
    hideIndexingIndicator();
    
    return { 
      success: true, 
      processed: 0, 
      skipped: true, 
      message: `Skipped - last crawl was ${timeSinceLastSync} minutes ago` 
    };
  }
  
  try {
    // Get headers that work with ChatGPT API
    const headers = getApiHeaders();
    
    // Fetch all conversations
    const conversations = await fetchAllConversationsInContent(headers);
    
    // Get existing conversation IDs from database
    const existingConvosResponse = await sendMessageToBackground('getExistingConversationIds');
    const existingConvoIds = existingConvosResponse.success ? new Set(existingConvosResponse.data || []) : new Set();
    
    // Debug: Log some existing conversation IDs and fetched conversation IDs
    console.log('Response from getExistingConversationIds:', existingConvosResponse);
    console.log('Sample existing conversation IDs from DB:', Array.from(existingConvoIds).slice(0, 5));
    console.log('Sample fetched conversation IDs:', conversations.slice(0, 5).map(c => c.id));
    console.log('Existing conversations in DB:', existingConvoIds.size);
    console.log('Total fetched conversations:', conversations.length);
    
    // Additional debug: Check if IDs are the same format
    if (existingConvoIds.size > 0 && conversations.length > 0) {
      const existingId = Array.from(existingConvoIds)[0];
      const fetchedId = conversations[0].id;
      console.log('ID format comparison - Existing:', existingId, 'Fetched:', fetchedId);
      console.log('Are they equal?', existingId === fetchedId);
      console.log('Existing ID type:', typeof existingId, 'Fetched ID type:', typeof fetchedId);
    }
    
    // Filter for conversations that don't exist in database yet
    const conversationsToProcess = conversations.filter(c => {
      const exists = existingConvoIds.has(c.id);
      return !exists;
    });
    
    // Log filtering results
    if (existingConvoIds.size > 0) {
      console.log(`Filtered conversations: ${conversations.length} total → ${conversationsToProcess.length} new`);
      if (conversationsToProcess.length > 0) {
        console.log('Sample new conversations:', conversationsToProcess.slice(0, 3).map(c => ({id: c.id, title: c.title})));
      }
    } else {
      console.log('No existing conversations in database, processing all fetched conversations');
    }
    
    console.log(`Found ${conversations.length} total conversations, ${conversationsToProcess.length} new conversations to process`);
    crawlProgress.total = conversationsToProcess.length;
    
    const allDocs = [];
    const BATCH_SIZE = 10; // Process 10 conversations in parallel
    
    // Process conversations in batches
    for (let i = 0; i < conversationsToProcess.length; i += BATCH_SIZE) {
      const batch = conversationsToProcess.slice(i, i + BATCH_SIZE);
      
      try {
        // Process batch in parallel
        const batchPromises = batch.map(async (convo) => {
          try {
            const docs = await processConversationInContent(convo, headers);
            console.log(`Processed conversation: ${convo.title || convo.id}`);
            return docs;
          } catch (error) {
            console.error(`Error processing conversation ${convo.id}:`, error);
            return []; // Return empty array on error
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        
        // Flatten results and add to allDocs
        batchResults.forEach(docs => {
          allDocs.push(...docs);
        });
        
        crawlProgress.current += batch.length;
        console.log(`Completed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(conversationsToProcess.length / BATCH_SIZE)}: ${crawlProgress.current}/${crawlProgress.total} conversations processed`);
        
        // Update indicator with actual messages processed so far
        updateIndexingProgress(allDocs.length);
        
        // Small delay between batches to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`Error processing batch starting at index ${i}:`, error);
        crawlProgress.current += batch.length; // Still increment progress even on error
      }
    }
    
    // Send all docs to background for storage
    if (allDocs.length > 0) {
      // Update indicator with final count before saving
      updateIndexingProgress(allDocs.length);
      
      const saveResponse = await sendMessageToBackground('saveDocs', { docs: allDocs });
      if (saveResponse.success) {
        console.log(`Saved ${allDocs.length} documents to database`);
      } else {
        throw new Error(`Failed to save documents: ${saveResponse.error}`);
      }
    }
    
    // Update last sync timestamp
    const now = Math.floor(Date.now());
    // Only update last sync timestamp if we actually saved some docs
    if (allDocs.length > 0) {
      await sendMessageToBackground('saveMeta', { key: 'lastSync', value: now });
    }
    console.log(`Updated last sync timestamp to ${now}`);
    
    // Hide indexing indicator when complete
    hideIndexingIndicator();
    
    return { success: true, processed: allDocs.length };
    
  } catch (error) {
    console.error('Crawl failed:', error);
    
    // Hide indexing indicator on error
    hideIndexingIndicator();
    
    return { success: false, error: error.message };
  }
}

// Get headers that work with ChatGPT API
function getApiHeaders() {
  // Get the authorization token from the page
  const authToken = getAuthToken();
  
  const headers = {
    'accept': '*/*',
    'accept-language': 'en-US,en;q=0.9',
    'content-type': 'application/json',
    'oai-language': 'en-US',
    'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': navigator.userAgent || '',
    'referer': window.location.href || ''
  };
  
  // Add authorization header only if token is valid
  if (authToken && typeof authToken === 'string' && authToken.length > 0) {
    headers.authorization = `Bearer ${authToken}`;
  }
  
  return headers;
}

// Extract authorization token from the page
function getAuthToken() {
  try {
    // Method 1: Try to extract from window.__reactRouterContext (primary method for ChatGPT)
    try {
      // Parse the stream data to find accessToken
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        if (script.textContent && script.textContent.includes('accessToken')) {
          const content = script.textContent;
          // Look for the accessToken in the script content with escaped quotes
          const accessTokenMatch = content.match(/\\"accessToken\\",\\"([^"\\]+)\\"/);
          if (accessTokenMatch && accessTokenMatch[1]) {
            console.log('Found auth token in __reactRouterContext script');
            return accessTokenMatch[1];
          }
          
          // Try alternative pattern without escaped quotes
          const altTokenMatch = content.match(/"accessToken","([^"]+)"/);
          if (altTokenMatch && altTokenMatch[1]) {
            console.log('Found auth token in script (alternative pattern)');
            return altTokenMatch[1];
          }
        }
      }
    } catch (e) {
      console.log('Error parsing __reactRouterContext:', e);
    }
    
    // Method 2: Try to get from localStorage
    const accessToken = localStorage.getItem('accessToken');
    if (accessToken) {
      console.log('Found auth token in localStorage');
      return accessToken;
    }
    
    // Method 3: Try to get from sessionStorage
    const sessionStorageToken = sessionStorage.getItem('accessToken');
    if (sessionStorageToken) {
      console.log('Found auth token in sessionStorage');
      return sessionStorageToken;
    }
    
    // Method 4: Try to extract from the page's JavaScript context
    // Look for the token in the window object or global variables
    if (window.__NEXT_DATA__ && window.__NEXT_DATA__.props && window.__NEXT_DATA__.props.accessToken) {
      console.log('Found auth token in __NEXT_DATA__');
      return window.__NEXT_DATA__.props.accessToken;
    }
    
    // Method 5: Try to get from cookies
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      if (!cookie || typeof cookie !== 'string') continue;
      
      const trimmedCookie = cookie.trim();
      if (!trimmedCookie) continue;
      
      const parts = trimmedCookie.split('=');
      if (parts.length !== 2) continue;
      
      const [name, value] = parts;
      if (name === 'accessToken' || name === 'authToken') {
        console.log('Found auth token in cookies');
        return value || null;
      }
    }
    
    // Method 6: Try to extract from the page's global state
    // ChatGPT might store the token in a global variable
    if (window.__NEXT_DATA__) {
      console.log('__NEXT_DATA__ available:', Object.keys(window.__NEXT_DATA__));
    }
    
    // Method 7: Try to get from the session token cookie
    // ChatGPT uses a session token cookie for authentication
    const sessionCookieToken = getCookie('__Secure-next-auth.session-token');
    if (sessionCookieToken) {
      console.log('Found session token in cookies');
      return sessionCookieToken;
    }
    
    // Method 8: Try to get from other common cookie names
    const commonTokenNames = [
      'session-token',
      'auth-token',
      'openai-session',
      'chatgpt-token'
    ];
    
    for (const tokenName of commonTokenNames) {
      if (!tokenName || typeof tokenName !== 'string') continue;
      
      const token = getCookie(tokenName);
      if (token && typeof token === 'string' && token.length > 0) {
        console.log(`Found token in cookie: ${tokenName}`);
        return token;
      }
    }
    
    console.warn('Could not find authorization token automatically');
    
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null
  }
}

// Helper function to get cookie by name
function getCookie(name) {
  if (!name || typeof name !== 'string') {
    return null;
  }
  
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    const result = parts.pop().split(';').shift();
    return result || null;
  }
  return null;
}

// Fetch all conversations in content script
async function fetchAllConversationsInContent(headers) {
  const conversations = [];
  let offset = 0;
  const limit = 100;
  
  // Log headers for debugging (without sensitive data)
  console.log('Using headers:', {
    ...headers,
    authorization: headers.authorization ? 'Bearer [REDACTED]' : 'Not set',
    'user-agent': headers['user-agent'] ? `${headers['user-agent'].substring(0, 20)}...` : 'Not set'
  });
  
  while (true) {
    const url = `https://chatgpt.com/backend-api/conversations?offset=${offset}&limit=${limit}&order=updated&is_archived=false`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: headers,
        credentials: 'include' // Important: include cookies
      });
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
                console.error('Auth error - headers used:', {
        ...headers,
        authorization: headers.authorization ? 'Bearer [REDACTED]' : 'Not set',
        'user-agent': headers['user-agent'] ? `${headers['user-agent'].substring(0, 20)}...` : 'Not set'
      });
          throw new Error('Authentication failed. Please refresh ChatGPT and try again.');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.items || data.items.length === 0) {
        break;
      }
      
      conversations.push(...data.items);
      
      console.log(`Fetched ${conversations.length} conversations so far...`);
      
      // Check if we've reached the end
      if (offset + limit >= data.total) {
        break;
      }
      
      offset += limit;
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`Error fetching conversations at offset ${offset}:`, error);
      throw error;
    }
  }
  
  console.log(`Total conversations fetched: ${conversations.length}`);
  return conversations;
}

// Process a single conversation in content script
async function processConversationInContent(convo, headers) {
  const docs = [];
  
  try {
    const response = await fetch(`https://chatgpt.com/backend-api/conversation/${convo.id}`, {
      method: 'GET',
      headers: headers,
      credentials: 'include'
    });
    
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Authentication failed for conversation fetch.');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Extract messages from the mapping
    const mapping = data.mapping || {};
    const title = data.title || convo.title || 'Untitled Conversation';
    
    // Validate mapping is an object
    if (!mapping || typeof mapping !== 'object') {
      console.warn(`Invalid mapping for conversation ${convo.id}`);
      return docs;
    }
    
    for (const [nodeId, node] of Object.entries(mapping)) {
      // Validate node structure
      if (!node || typeof node !== 'object') continue;
      
      const message = node.message;
      if (!message || typeof message !== 'object') continue;
      
      if (message.content && message.content.parts && Array.isArray(message.content.parts)) {
        const parts = message.content.parts;
        let textParts = [];
        
        // Process each part, handling both string parts and audio_transcription objects
        for (const part of parts) {
          if (typeof part === 'string' && part.trim().length > 0) {
            // Standard text part
            textParts.push(part.trim());
          } else if (part && typeof part === 'object' && part.audio_transcription) {
            // Voice chat transcription part
            if (part.audio_transcription.text && part.audio_transcription.text.trim().length > 0) {
              textParts.push(`[Voice] ${part.audio_transcription.text.trim()}`);
            }
          }
        }
        
        if (textParts.length > 0) {
          const text = textParts.join('\n');
          
          docs.push({
            id: message.id || `msg_${nodeId}`,
            convoId: convo.id,
            role: message.author?.role || 'unknown',
            text: text,
            time: message.create_time || convo.update_time || Date.now(),
            title: title
          });
        }
      }
    }
    
  } catch (error) {
    console.error(`Error fetching conversation ${convo.id}:`, error);
  }
  
  return docs;
}

// Toast notification function
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `${EXTENSION_PREFIX}-toast ${EXTENSION_PREFIX}-toast-${type}`;
  toast.textContent = message;
  
  // Style the toast
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'error' ? '#dc3545' : '#28a745'};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 10001;
    font-size: 14px;
    font-weight: 500;
    max-width: 300px;
    opacity: 0;
    transform: translateY(-10px);
    transition: all 0.3s ease;
  `;
  
  document.body.appendChild(toast);
  
  // Animate in
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  }, 100);
  
  // Remove after 4 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 4000);
}

// Auto-start incremental crawl when extension loads
async function autoStartCrawl() {
  try {
    const lastSync = await sendMessageToBackground('getMeta', { key: 'lastSync' });
    
    if (!lastSync.success || !lastSync.data) {
      // First time - start full crawl
      console.log('First time setup - starting full crawl');
      await startConversationCrawl(true);
    } else {
      // Check if we need incremental sync
      const lastSyncTime = lastSync.data;
      const now = Math.floor(Date.now() / 1000);
      const hoursSinceSync = (now - lastSyncTime) / 3600;
      
      // if (hoursSinceSync > 1) {
        // Auto-sync if it's been more than an hour
        console.log('Auto-starting incremental crawl');
        await startConversationCrawl(false);
      // }
    }
  } catch (error) {
    console.error('Error in auto-start crawl:', error);
  }
}

console.log('ChatGPT Bookmark Extension content script loaded');
console.log('Debug functions available: window.chatgptBookmarkDebug'); 