// ChatGPT Bookmark Extension - Popup Script

// DOM elements
let bookmarksList = null;
let searchInput = null;
let bookmarkCount = null;
let emptyState = null;
let loading = null;
let indexingStatus = null;
let indexingProgress = null;
let stats = null;
let filterButtons = null;
let folderTree = null;
let allBookmarksCount = null;
let contextMenu = null;
let newFolderForm = null;
let newFolderInput = null;
let createFolderBtn = null;
let cancelFolderBtn = null;
let defaultFolderSelect = null;
let addFolderButton = null;
let toggleSidebarBtn = null;

// State
let allBookmarks = [];
let allFolders = [];
let filteredBookmarks = [];
let currentFilter = 'all';
let currentFolderId = 'all';
let searchTimeout = null;
let contextMenuTarget = null;
let sidebarHidden = false;

// Initialize popup
document.addEventListener('DOMContentLoaded', initializePopup);

async function initializePopup() {
  try {
    // Get DOM elements
    bookmarksList = document.getElementById('bookmarksList');
    searchInput = document.getElementById('searchInput');
    bookmarkCount = document.getElementById('bookmarkCount');
    emptyState = document.getElementById('emptyState');
    loading = document.getElementById('loading');
    indexingStatus = document.getElementById('indexingStatus');
    indexingProgress = document.getElementById('indexingProgress');
    stats = document.getElementById('stats');
    filterButtons = document.getElementById('filterButtons');
    folderTree = document.getElementById('folderTree');
    allBookmarksCount = document.getElementById('allBookmarksCount');
    contextMenu = document.getElementById('contextMenu');
    newFolderForm = document.getElementById('newFolderForm');
    newFolderInput = document.getElementById('newFolderInput');
    createFolderBtn = document.getElementById('createFolderBtn');
    cancelFolderBtn = document.getElementById('cancelFolderBtn');
    defaultFolderSelect = document.getElementById('defaultFolderSelect');
    addFolderButton = document.getElementById('addFolderButton');
    toggleSidebarBtn = document.getElementById('toggleSidebarBtn');

    // Setup event listeners
    setupEventListeners();

    // Load folders and bookmarks
    await loadFolders();
    await loadBookmarks();
    
    // Check indexing status
    checkIndexingStatus();

    // Load sidebar state
    loadSidebarState();

  } catch (error) {
    console.error('Failed to initialize popup:', error);
    showError('Failed to initialize popup');
  }
}

// Setup event listeners
function setupEventListeners() {
  // Search input
  if (searchInput) {
    searchInput.addEventListener('input', handleSearchInput);
    searchInput.addEventListener('keydown', handleSearchKeydown);
  }

  // Filter buttons
  if (filterButtons) {
    filterButtons.addEventListener('click', handleFilterClick);
  }

  // Folder tree
  if (folderTree) {
    folderTree.addEventListener('click', handleFolderClick);
    folderTree.addEventListener('contextmenu', handleFolderContextMenu);
  }

  // Context menu
  if (contextMenu) {
    contextMenu.addEventListener('click', handleContextMenuClick);
  }

  // New folder form
  if (createFolderBtn) {
    createFolderBtn.addEventListener('click', handleCreateFolder);
  }
  if (cancelFolderBtn) {
    cancelFolderBtn.addEventListener('click', hideNewFolderForm);
  }
  if (newFolderInput) {
    newFolderInput.addEventListener('keydown', handleNewFolderKeydown);
  }

  // Default folder selector
  if (defaultFolderSelect) {
    defaultFolderSelect.addEventListener('change', handleDefaultFolderChange);
  }
  
  // Add folder button
  if (addFolderButton) {
    console.log('Setting up addFolderButton click handler');
    addFolderButton.addEventListener('click', async (e) => {
      console.log('Add folder button clicked');
      e.preventDefault();
      e.stopPropagation();
      
      // Check if user can create more folders
      try {
        const [isPremiumResponse, folderCountResponse] = await Promise.all([
          sendMessageToBackground('getUserPremiumStatus'),
          sendMessageToBackground('getFolderCount')
        ]);
        
        if (isPremiumResponse.success && folderCountResponse.success) {
          const isPremium = isPremiumResponse.data;
          const folderCount = folderCountResponse.data;
          
          if (!isPremium && folderCount >= 3) {
            showUpgradePrompt('You\'ve reached the maximum of 3 folders. Upgrade to premium for unlimited folders.');
            return;
          }
        }
        
        showNewFolderForm();
      } catch (error) {
        console.error('Failed to check folder limit:', error);
        showNewFolderForm(); // Show form anyway if check fails
      }
    });
  } else {
    console.error('addFolderButton not found');
  }

  // Toggle sidebar button
  if (toggleSidebarBtn) {
    toggleSidebarBtn.addEventListener('click', toggleSidebar);
  }

  // Close context menu and forms when clicking outside
  document.addEventListener('click', (e) => {
    // Don't hide context menu if clicking inside it
    if (contextMenu && contextMenu.contains(e.target)) {
      return;
    }
    
    if (e.target.classList.contains('bookmark-item')) {
      return; // Allow bookmark clicks
    }
    
    // Add a small delay to ensure context menu clicks are processed first
    setTimeout(() => {
      hideContextMenu();
      if (newFolderForm && !newFolderForm.contains(e.target)) {
        hideNewFolderForm();
      }
    }, 10);
  });
}

// Load folders from background script
async function loadFolders() {
  try {
    const response = await sendMessageToBackground('getAllFolders');
    if (response.success) {
      allFolders = response.data || [];
      buildFolderTree();
      updateFolderUsageDisplay(); // Update usage display after loading folders
    } else {
      throw new Error(response.error || 'Failed to load folders');
    }
  } catch (error) {
    console.error('Failed to load folders:', error);
    showError('Failed to load folders');
  }
}

// Build folder tree UI
function buildFolderTree() {
  if (!folderTree) return;
  
  // Keep the "All Bookmarks" item and add actual folders
  const existingAllItem = folderTree.querySelector('[data-folder-id="all"]');
  folderTree.innerHTML = '';
  
  if (existingAllItem) {
    folderTree.appendChild(existingAllItem.parentElement);
    
    // Add drop event listeners to "All Bookmarks"
    existingAllItem.addEventListener('dragover', handleFolderDragOver);
    existingAllItem.addEventListener('drop', handleFolderDrop);
    existingAllItem.addEventListener('dragleave', handleFolderDragLeave);
  }
  
  // Add actual folders
  allFolders.forEach(folder => {
    const folderItem = createFolderElement(folder);
    folderTree.appendChild(folderItem);
  });
  
  updateFolderCounts();
  updateDefaultFolderSelector();
}

// Create folder element
function createFolderElement(folder) {
  const li = document.createElement('li');
  li.className = 'folder-item';
  
  const link = document.createElement('a');
  link.className = 'folder-link';
  link.dataset.folderId = folder.id;
  
  const icon = document.createElement('svg');
  icon.className = 'folder-icon';
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.innerHTML = '<path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"/>';
  
  const name = document.createElement('span');
  name.className = 'folder-name';
  name.textContent = folder.name;
  
  const count = document.createElement('span');
  count.className = 'folder-count';
  count.textContent = '0';
  count.id = `folder-count-${folder.id}`;
  
  link.appendChild(icon);
  link.appendChild(name);
  link.appendChild(count);
  li.appendChild(link);
  
  // Add drop event listeners
  link.addEventListener('dragover', handleFolderDragOver);
  link.addEventListener('drop', handleFolderDrop);
  link.addEventListener('dragleave', handleFolderDragLeave);
  
  return li;
}

// Update folder counts
function updateFolderCounts() {
  if (!allBookmarksCount) return;
  
  // Update "All Bookmarks" count
  allBookmarksCount.textContent = allBookmarks.length;
  
  // Update individual folder counts
  allFolders.forEach(folder => {
    const countElement = document.getElementById(`folder-count-${folder.id}`);
    if (countElement) {
      const count = allBookmarks.filter(b => b.folderId === folder.id).length;
      countElement.textContent = count;
    }
  });
}

// Update default folder selector
function updateDefaultFolderSelector() {
  if (!defaultFolderSelect) return;
  
  // Clear existing options except the default one
  defaultFolderSelect.innerHTML = '<option value="default">Uncategorized</option>';
  
  // Add all folders as options
  allFolders.forEach(folder => {
    const option = document.createElement('option');
    option.value = folder.id;
    option.textContent = folder.name;
    defaultFolderSelect.appendChild(option);
  });
  
  // Set current value from storage
  loadDefaultFolder();
}

// Load default folder from storage
async function loadDefaultFolder() {
  try {
    const response = await sendMessageToBackground('getMeta', { key: 'lastUsedFolder' });
    if (response.success && response.data) {
      defaultFolderSelect.value = response.data;
    }
  } catch (error) {
    console.error('Failed to load default folder:', error);
  }
}

// Handle default folder change
async function handleDefaultFolderChange() {
  const selectedFolder = defaultFolderSelect.value;
  
  try {
    const response = await sendMessageToBackground('saveMeta', { 
      key: 'lastUsedFolder', 
      value: selectedFolder 
    });
    
    if (response.success) {
      const folderName = selectedFolder === 'default' ? 'Uncategorized' : 
        (allFolders.find(f => f.id === selectedFolder)?.name || 'Unknown');
      showSuccess(`Default folder set to ${folderName}`);
    }
  } catch (error) {
    console.error('Failed to save default folder:', error);
    showError('Failed to save default folder');
  }
}

// Handle folder click
function handleFolderClick(e) {
  const folderLink = e.target.closest('.folder-link');
  if (!folderLink) return;

  const folderId = folderLink.dataset.folderId;

  // If 'All Bookmarks' is clicked, show all bookmarks as before
  if (folderId === 'all') {
    currentFolderId = 'all';
    folderTree.querySelectorAll('.folder-link').forEach(link => link.classList.remove('active'));
    folderLink.classList.add('active');
    applyCurrentFilter();
    return;
  }

  // For a specific folder, show its subfolders and their bookmarks
  currentFolderId = folderId;
  folderTree.querySelectorAll('.folder-link').forEach(link => link.classList.remove('active'));
  folderLink.classList.add('active');

  // Fetch and display subfolders and their bookmarks
  showSubfoldersAndBookmarks(folderId);
}

// Placeholder: Will implement fetching and rendering subfolders and their bookmarks in the next step
async function showSubfoldersAndBookmarks(parentFolderId) {
  if (!bookmarksList) return;
  bookmarksList.innerHTML = '';

  // Fetch subfolders
  const subfoldersResponse = await sendMessageToBackground('getFoldersByParent', { parentId: parentFolderId });
  const subfolders = subfoldersResponse.success ? subfoldersResponse.data || [] : [];

  if (subfolders.length === 0) {
    // No subfolders: show bookmarks for this folder
    const bookmarksResponse = await sendMessageToBackground('getBookmarksByFolder', { folderId: parentFolderId });
    const bookmarks = bookmarksResponse.success ? bookmarksResponse.data || [] : [];
    if (bookmarks.length === 0) {
      bookmarksList.innerHTML = '<div class="empty-state"><h3>No bookmarks in this folder</h3></div>';
    } else {
      bookmarksList.innerHTML = `<div class="subfolder-section"><div class="subfolder-title">Bookmarks</div></div>`;
      const section = bookmarksList.querySelector('.subfolder-section');
      bookmarks.forEach(b => section.appendChild(createBookmarkElement(b)));
    }
    return;
  }

  // For each subfolder, fetch and display its bookmarks
  let hasAnyBookmarks = false;
  for (const subfolder of subfolders) {
    const bookmarksResponse = await sendMessageToBackground('getBookmarksByFolder', { folderId: subfolder.id });
    const bookmarks = bookmarksResponse.success ? bookmarksResponse.data || [] : [];
    const section = document.createElement('div');
    section.className = 'subfolder-section';
    section.innerHTML = `<div class="subfolder-title">${subfolder.name}</div>`;
    if (bookmarks.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = '<p>No bookmarks in this subfolder</p>';
      section.appendChild(empty);
    } else {
      hasAnyBookmarks = true;
      bookmarks.forEach(b => section.appendChild(createBookmarkElement(b)));
    }
    bookmarksList.appendChild(section);
  }
  if (!hasAnyBookmarks) {
    bookmarksList.innerHTML += '<div class="empty-state"><h3>No bookmarks in any subfolder</h3></div>';
  }
}

// Handle folder context menu
function handleFolderContextMenu(e) {
  e.preventDefault();
  console.log('Folder context menu triggered');
  
  const folderLink = e.target.closest('.folder-link');
  console.log('Folder link found:', folderLink);
  
  if (!folderLink) {
    console.error('No folder link found');
    return;
  }
  
  const folderId = folderLink.dataset.folderId;
  console.log('Folder ID:', folderId);
  
  // Don't show context menu for "All Bookmarks"
  if (folderId === 'all') {
    console.log('All Bookmarks clicked, showing new folder form');
    
    // Check if user can create more folders
    (async () => {
      try {
        const [isPremiumResponse, folderCountResponse] = await Promise.all([
          sendMessageToBackground('getUserPremiumStatus'),
          sendMessageToBackground('getFolderCount')
        ]);
        
        if (isPremiumResponse.success && folderCountResponse.success) {
          const isPremium = isPremiumResponse.data;
          const folderCount = folderCountResponse.data;
          
          if (!isPremium && folderCount >= 3) {
            showUpgradePrompt('You\'ve reached the maximum of 3 folders. Upgrade to premium for unlimited folders.');
            return;
          }
        }
        
        showNewFolderForm();
      } catch (error) {
        console.error('Failed to check folder limit:', error);
        showNewFolderForm(); // Show form anyway if check fails
      }
    })();
    return;
  }
  
  contextMenuTarget = folderId;
  console.log('Setting contextMenuTarget to:', contextMenuTarget);
  showContextMenu(e.clientX, e.clientY);
}

// Show context menu
function showContextMenu(x, y) {
  console.log('showContextMenu called with coordinates:', x, y);
  console.log('contextMenu element:', contextMenu);
  
  if (!contextMenu) {
    console.error('Context menu element not found');
    return;
  }
  
  contextMenu.style.left = x + 'px';
  contextMenu.style.top = y + 'px';
  contextMenu.classList.add('show');
  console.log('Context menu shown at:', x, y);
  
  // Adjust position if menu goes off screen
  const rect = contextMenu.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  if (rect.right > viewportWidth) {
    contextMenu.style.left = (x - rect.width) + 'px';
    console.log('Adjusted left position to:', x - rect.width);
  }
  if (rect.bottom > viewportHeight) {
    contextMenu.style.top = (y - rect.height) + 'px';
    console.log('Adjusted top position to:', y - rect.height);
  }
}

// Hide context menu
function hideContextMenu() {
  setTimeout(() => {
    if (contextMenu) {
      contextMenu.classList.remove('show');
      contextMenuTarget = null;
    }
  }, 100);
}

// Handle context menu click
function handleContextMenuClick(e) {
  const action = e.target.dataset.action;
  console.log('Context menu clicked, action:', action);
  console.log('Target element:', e.target);
  console.log('Current contextMenuTarget:', contextMenuTarget);
  
  if (!action) {
    console.error('No action found on clicked element');
    return;
  }
  
  // Don't hide context menu immediately - let each action handle it
  // hideContextMenu();
  
  switch (action) {
    case 'new-folder':
      console.log('Creating new folder');
      hideContextMenu();
      
      // Check if user can create more folders
      (async () => {
        try {
          const [isPremiumResponse, folderCountResponse] = await Promise.all([
            sendMessageToBackground('getUserPremiumStatus'),
            sendMessageToBackground('getFolderCount')
          ]);
          
          if (isPremiumResponse.success && folderCountResponse.success) {
            const isPremium = isPremiumResponse.data;
            const folderCount = folderCountResponse.data;
            
            if (!isPremium && folderCount >= 3) {
              showUpgradePrompt('You\'ve reached the maximum of 3 folders. Upgrade to premium for unlimited folders.');
              return;
            }
          }
          
          showNewFolderForm();
        } catch (error) {
          console.error('Failed to check folder limit:', error);
          showNewFolderForm(); // Show form anyway if check fails
        }
      })();
      break;
    case 'rename-folder':
      console.log('Renaming folder');
      hideContextMenu();
      handleRenameFolder();
      break;
    case 'delete-folder':
      console.log('Deleting folder');
      hideContextMenu();
      handleDeleteFolder();
      break;
    default:
      console.error('Unknown action:', action);
      hideContextMenu();
  }
}

// Show new folder form
function showNewFolderForm() {
  console.log('showNewFolderForm called');
  console.log('newFolderForm:', newFolderForm);
  
  if (!newFolderForm) {
    console.error('newFolderForm is null');
    return;
  }
  
  newFolderForm.classList.add('show');
  console.log('Added show class to newFolderForm');
  
  if (newFolderInput) {
    newFolderInput.focus();
    newFolderInput.value = '';
  }
}

// Hide new folder form
function hideNewFolderForm() {
  if (!newFolderForm) return;
  
  newFolderForm.classList.remove('show');
  newFolderInput.value = '';
}

// Handle new folder keydown
function handleNewFolderKeydown(e) {
  if (e.key === 'Enter') {
    handleCreateFolder();
  } else if (e.key === 'Escape') {
    hideNewFolderForm();
  }
}

// Handle create folder
async function handleCreateFolder() {
  const name = newFolderInput.value.trim();
  if (!name) return;
  
  try {
    const response = await sendMessageToBackground('createFolder', { name });
    if (response.success) {
      await loadFolders();
      hideNewFolderForm();
      showSuccess('Folder created successfully');
      updateFolderUsageDisplay(); // Update usage display after creating folder
    } else {
      if (response.errorType === 'FOLDER_LIMIT_REACHED') {
        hideNewFolderForm();
        showUpgradePrompt(response.error);
      } else {
        throw new Error(response.error || 'Failed to create folder');
      }
    }
  } catch (error) {
    console.error('Failed to create folder:', error);
    showError('Failed to create folder');
  }
}

// Handle rename folder
async function handleRenameFolder() {
  if (!contextMenuTarget) return;
  
  const folder = allFolders.find(f => f.id === contextMenuTarget);
  if (!folder) return;
  
  const newName = prompt('Enter new folder name:', folder.name);
  if (!newName || newName.trim() === '') return;
  
  try {
    const updatedFolder = { ...folder, name: newName.trim() };
    const response = await sendMessageToBackground('saveFolder', { folder: updatedFolder });
    if (response.success) {
      await loadFolders();
      showSuccess('Folder renamed successfully');
    } else {
      throw new Error(response.error || 'Failed to rename folder');
    }
  } catch (error) {
    console.error('Failed to rename folder:', error);
    showError('Failed to rename folder');
  }
}

// Handle delete folder
async function handleDeleteFolder() {
  console.log('handleDeleteFolder called');
  console.log('contextMenuTarget:', contextMenuTarget);
  
  if (!contextMenuTarget) {
    console.error('No contextMenuTarget set');
    return;
  }
  
  const folder = allFolders.find(f => f.id === contextMenuTarget);
  console.log('Found folder:', folder);
  
  if (!folder) {
    console.error('Folder not found for ID:', contextMenuTarget);
    return;
  }
  
  // Check if folder has bookmarks
  const bookmarkCount = allBookmarks.filter(b => b.folderId === contextMenuTarget).length;
  
  let confirmMessage = `Are you sure you want to delete the folder "${folder.name}"?`;
  if (bookmarkCount > 0) {
    confirmMessage += `\n\nThis folder contains ${bookmarkCount} bookmark${bookmarkCount === 1 ? '' : 's'}. They will be moved to "Uncategorized".`;
  }
  
  if (!confirm(confirmMessage)) return;
  
  try {
    // Move bookmarks to default folder
    const bookmarksToMove = allBookmarks.filter(b => b.folderId === contextMenuTarget);
    for (const bookmark of bookmarksToMove) {
      await sendMessageToBackground('moveBookmark', { 
        bookmarkId: bookmark.id, 
        newFolderId: 'default' 
      });
    }
    
    // Delete folder
    const response = await sendMessageToBackground('deleteFolder', { id: contextMenuTarget });
    if (response.success) {
      await loadFolders();
      await loadBookmarks();
      
      // Switch to "All Bookmarks" if we deleted the current folder
      if (currentFolderId === contextMenuTarget) {
        currentFolderId = 'all';
        const allLink = folderTree.querySelector('[data-folder-id="all"]');
        if (allLink) {
          folderTree.querySelectorAll('.folder-link').forEach(link => {
            link.classList.remove('active');
          });
          allLink.classList.add('active');
        }
      }
      
      showSuccess('Folder deleted successfully');
    } else {
      throw new Error(response.error || 'Failed to delete folder');
    }
  } catch (error) {
    console.error('Failed to delete folder:', error);
    showError('Failed to delete folder');
  }
}

// Drag and drop handlers
function handleBookmarkDragStart(e) {
  const bookmarkId = e.target.dataset.bookmarkId;
  e.dataTransfer.setData('text/plain', bookmarkId);
  e.dataTransfer.effectAllowed = 'move';
  
  // Add visual feedback
  e.target.classList.add('dragging');
  
  // Store the dragged bookmark ID
  e.target.dataset.dragging = 'true';
}

function handleBookmarkDragEnd(e) {
  // Remove visual feedback
  e.target.classList.remove('dragging');
  e.target.removeAttribute('data-dragging');
  
  // Remove drag-over class from all folders
  document.querySelectorAll('.folder-link').forEach(link => {
    link.classList.remove('drag-over');
  });
}

function handleFolderDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  
  // Add visual feedback
  e.currentTarget.classList.add('drag-over');
}

function handleFolderDragLeave(e) {
  // Remove visual feedback
  e.currentTarget.classList.remove('drag-over');
}

async function handleFolderDrop(e) {
  e.preventDefault();
  
  const bookmarkId = e.dataTransfer.getData('text/plain');
  const targetFolderId = e.currentTarget.dataset.folderId;
  
  // Remove visual feedback
  e.currentTarget.classList.remove('drag-over');
  
  if (!bookmarkId || !targetFolderId) return;
  
  // Don't move if it's the same folder
  const bookmark = allBookmarks.find(b => b.id === bookmarkId);
  if (bookmark && bookmark.folderId === targetFolderId) return;
  
  try {
    // Handle "All Bookmarks" drop (move to default folder)
    const actualTargetFolderId = targetFolderId === 'all' ? 'default' : targetFolderId;
    
    const response = await sendMessageToBackground('moveBookmark', {
      bookmarkId: bookmarkId,
      newFolderId: actualTargetFolderId
    });
    
    if (response.success) {
      // Update local bookmark data
      const bookmarkIndex = allBookmarks.findIndex(b => b.id === bookmarkId);
      if (bookmarkIndex !== -1) {
        allBookmarks[bookmarkIndex].folderId = actualTargetFolderId;
      }
      
      // Update UI
      updateFolderCounts();
      applyCurrentFilter();
      
      // Show success message
      const targetFolderName = targetFolderId === 'all' ? 'All Bookmarks' : 
        (allFolders.find(f => f.id === targetFolderId)?.name || 'Unknown');
      showSuccess(`Bookmark moved to ${targetFolderName}`);
    } else {
      throw new Error(response.error || 'Failed to move bookmark');
    }
  } catch (error) {
    console.error('Failed to move bookmark:', error);
    showError('Failed to move bookmark');
  }
}

// Load bookmarks from background script
async function loadBookmarks() {
  try {
    showLoading();
    
    const response = await sendMessageToBackground('getAllBookmarks');
    if (response.success) {
      allBookmarks = response.data || [];
      updateBookmarkCount();
      updateStats();
      updateFolderCounts();
      applyCurrentFilter();
      
      if (allBookmarks.length > 0) {
        showFilterButtons();
      }
    } else {
      throw new Error(response.error || 'Failed to load bookmarks');
    }
  } catch (error) {
    console.error('Failed to load bookmarks:', error);
    showError('Failed to load bookmarks');
  } finally {
    hideLoading();
  }
}

// Handle search input
function handleSearchInput(e) {
  const query = e.target.value.trim();
  
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    if (query.length === 0) {
      applyCurrentFilter();
    } else {
      performSearch(query);
    }
  }, 300);
}

// Handle search keydown
function handleSearchKeydown(e) {
  if (e.key === 'Enter') {
    const query = e.target.value.trim();
    if (query) {
      performSearch(query);
    }
  } else if (e.key === 'Escape') {
    e.target.value = '';
    applyCurrentFilter();
  }
}

// Perform search
async function performSearch(query) {
  try {
    const response = await sendMessageToBackground('searchBookmarks', { query });
    if (response.success) {
      let searchResults = response.data || [];
      
      // Filter search results by current folder if not "all"
      if (currentFolderId !== 'all') {
        searchResults = searchResults.filter(bookmark => bookmark.folderId === currentFolderId);
      }
      
      filteredBookmarks = searchResults;
      displayBookmarks(filteredBookmarks);
    }
  } catch (error) {
    console.error('Search failed:', error);
    showError('Search failed');
  }
}

// Handle filter button clicks
function handleFilterClick(e) {
  if (e.target.classList.contains('filter-button')) {
    const filter = e.target.dataset.filter;
    
    // Update active button
    filterButtons.querySelectorAll('.filter-button').forEach(btn => {
      btn.classList.remove('active');
    });
    e.target.classList.add('active');
    
    // Apply filter
    currentFilter = filter;
    applyCurrentFilter();
  }
}

// Apply current filter
function applyCurrentFilter() {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  // First filter by folder
  let bookmarksToFilter = allBookmarks;
  if (currentFolderId !== 'all') {
    bookmarksToFilter = allBookmarks.filter(bookmark => bookmark.folderId === currentFolderId);
  }
  
  // Then apply time filter
  switch (currentFilter) {
    case 'all':
      filteredBookmarks = [...bookmarksToFilter];
      break;
    case 'recent':
      filteredBookmarks = bookmarksToFilter.filter(bookmark => 
        new Date(bookmark.timestamp) > oneDayAgo
      );
      break;
    case 'week':
      filteredBookmarks = bookmarksToFilter.filter(bookmark => 
        new Date(bookmark.timestamp) > oneWeekAgo
      );
      break;
    default:
      filteredBookmarks = [...bookmarksToFilter];
  }
  
  // Sort by timestamp (newest first)
  filteredBookmarks.sort((a, b) => b.timestamp - a.timestamp);
  
  displayBookmarks(filteredBookmarks);
}

// Display bookmarks
function displayBookmarks(bookmarks) {
  if (!bookmarksList) return;
  
  bookmarksList.innerHTML = '';
  
  if (bookmarks.length === 0) {
    showEmptyState();
    return;
  }
  
  hideEmptyState();
  
  bookmarks.forEach(bookmark => {
    const bookmarkElement = createBookmarkElement(bookmark);
    bookmarksList.appendChild(bookmarkElement);
  });
}

// Create bookmark element
function createBookmarkElement(bookmark) {
  const item = document.createElement('div');
  item.className = 'bookmark-item';
  item.dataset.bookmarkId = bookmark.id;
  item.draggable = true;
  
  const content = document.createElement('div');
  content.className = 'bookmark-content';
  
  const title = document.createElement('div');
  title.className = 'bookmark-title';
  title.textContent = bookmark.title;
  title.title = bookmark.title;
  
  const preview = document.createElement('div');
  preview.className = 'bookmark-preview';
  preview.textContent = bookmark.content;
  
  const timestamp = document.createElement('div');
  timestamp.className = 'bookmark-timestamp';
  timestamp.textContent = formatTimestamp(bookmark.timestamp);
  
  const actions = document.createElement('div');
  actions.className = 'bookmark-actions';
  
  const openButton = document.createElement('button');
  openButton.className = 'bookmark-action';
  openButton.textContent = 'Open';
  openButton.title = 'Open in ChatGPT';
  openButton.addEventListener('click', (e) => {
    e.stopPropagation();
    openBookmark(bookmark);
  });
  
  const deleteButton = document.createElement('button');
  deleteButton.className = 'bookmark-action delete';
  deleteButton.textContent = 'Delete';
  deleteButton.title = 'Delete bookmark';
  deleteButton.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteBookmark(bookmark.id);
  });
  
  actions.appendChild(openButton);
  actions.appendChild(deleteButton);
  
  content.appendChild(title);
  content.appendChild(preview);
  content.appendChild(timestamp);
  
  item.appendChild(content);
  item.appendChild(actions);
  
  // Add click handler for entire item
  item.addEventListener('click', () => {
    openBookmark(bookmark);
  });
  
  // Add drag event listeners
  item.addEventListener('dragstart', handleBookmarkDragStart);
  item.addEventListener('dragend', handleBookmarkDragEnd);
  
  return item;
}

// Open bookmark
async function openBookmark(bookmark) {
  try {
    // Try to open the bookmark URL
    if (bookmark.url) {
      await chrome.tabs.create({ url: bookmark.url });
    } else {
      // Fallback to creating a new chat URL
      const chatUrl = `https://chat.openai.com/c/${bookmark.id}`;
      await chrome.tabs.create({ url: chatUrl });
    }
    
    // Close popup
    window.close();
  } catch (error) {
    console.error('Failed to open bookmark:', error);
    showError('Failed to open bookmark');
  }
}

// Delete bookmark
async function deleteBookmark(bookmarkId) {
  try {
    const response = await sendMessageToBackground('deleteBookmark', { id: bookmarkId });
    if (response.success) {
      // Remove from local arrays
      allBookmarks = allBookmarks.filter(bookmark => bookmark.id !== bookmarkId);
      filteredBookmarks = filteredBookmarks.filter(bookmark => bookmark.id !== bookmarkId);
      
      // Update UI
      updateBookmarkCount();
      updateStats();
      displayBookmarks(filteredBookmarks);
      
      // Show success feedback
      showSuccess('Bookmark deleted');
    } else {
      throw new Error(response.error || 'Failed to delete bookmark');
    }
  } catch (error) {
    console.error('Failed to delete bookmark:', error);
    showError('Failed to delete bookmark');
  }
}

// Update bookmark count
function updateBookmarkCount() {
  if (bookmarkCount) {
    bookmarkCount.textContent = allBookmarks.length.toString();
  }
}

// Update stats
function updateStats() {
  if (!stats) return;
  
  const totalCount = document.getElementById('totalCount');
  const weekCount = document.getElementById('weekCount');
  
  if (totalCount) {
    totalCount.textContent = allBookmarks.length.toString();
  }
  
  if (weekCount) {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weekBookmarks = allBookmarks.filter(bookmark => 
      new Date(bookmark.timestamp) > oneWeekAgo
    );
    weekCount.textContent = weekBookmarks.length.toString();
  }
  
  if (allBookmarks.length > 0) {
    stats.style.display = 'flex';
  } else {
    stats.style.display = 'none';
  }
}

// Show/hide UI elements
function showLoading() {
  if (loading) loading.style.display = 'block';
  if (bookmarksList) bookmarksList.style.display = 'none';
  if (emptyState) emptyState.style.display = 'none';
}

function hideLoading() {
  if (loading) loading.style.display = 'none';
  if (bookmarksList) bookmarksList.style.display = 'block';
}

function showEmptyState() {
  if (emptyState) emptyState.style.display = 'block';
  if (bookmarksList) bookmarksList.style.display = 'none';
}

function hideEmptyState() {
  if (emptyState) emptyState.style.display = 'none';
  if (bookmarksList) bookmarksList.style.display = 'block';
}

function showFilterButtons() {
  if (filterButtons) filterButtons.style.display = 'flex';
}

// Show success message
function showSuccess(message) {
  // Create temporary success notification
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #4ade80;
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 1000;
    animation: slideIn 0.3s ease;
  `;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Show error message
function showError(message) {
  // Create temporary error notification
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #ef4444;
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 1000;
    animation: slideIn 0.3s ease;
  `;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 5000);
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

// Format timestamp
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) { // Less than 1 minute
    return 'Just now';
  } else if (diff < 3600000) { // Less than 1 hour
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m ago`;
  } else if (diff < 86400000) { // Less than 24 hours
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  } else if (diff < 2592000000) { // Less than 30 days
    const days = Math.floor(diff / 86400000);
    return `${days}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}

// Check indexing status
async function checkIndexingStatus() {
  try {
    const response = await sendMessageToBackground('getIndexingStatus');
    if (response.success && response.data) {
      const { isIndexing, progress } = response.data;
      if (isIndexing) {
        showIndexingStatus(progress || 0);
      } else {
        hideIndexingStatus();
      }
    }
  } catch (error) {
    console.error('Failed to check indexing status:', error);
  }
}

// Show indexing status
function showIndexingStatus(messageCount = 0) {
  if (indexingStatus) {
    indexingStatus.classList.add('show');
  }
  if (indexingProgress) {
    indexingProgress.textContent = `${messageCount} messages`;
  }
}

// Hide indexing status
function hideIndexingStatus() {
  if (indexingStatus) {
    indexingStatus.classList.remove('show');
  }
}

// Update indexing progress
function updateIndexingProgress(messageCount) {
  if (indexingProgress) {
    indexingProgress.textContent = `${messageCount} messages`;
  }
}

// Listen for indexing updates from background script
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'indexingProgress') {
    showIndexingStatus(message.messageCount);
  } else if (message.type === 'indexingComplete') {
    hideIndexingStatus();
    // Refresh bookmarks to show any new ones
    loadBookmarks();
  }
});

// Add CSS animation for notifications
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
`;
document.head.appendChild(style);

// Handle popup focus
window.addEventListener('focus', () => {
  // Refresh bookmarks when popup gains focus
  loadBookmarks();
});

// Handle keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey) {
    switch (e.key) {
      case 'f':
        e.preventDefault();
        searchInput?.focus();
        break;
      case 'r':
        e.preventDefault();
        loadBookmarks();
        break;
      case 'b':
        e.preventDefault();
        toggleSidebar();
        break;
    }
  }
});

// Show upgrade prompt for premium features
function showUpgradePrompt(message) {
  // Create upgrade prompt modal
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  
  const content = document.createElement('div');
  content.style.cssText = `
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 12px;
    padding: 24px;
    max-width: 300px;
    text-align: center;
  `;
  
  content.innerHTML = `
    <div style="color: #ffd700; font-size: 32px; margin-bottom: 16px;">⭐</div>
    <h3 style="color: #ececec; font-size: 16px; font-weight: 600; margin-bottom: 12px;">Upgrade to Premium</h3>
    <p style="color: #999; font-size: 14px; line-height: 1.4; margin-bottom: 20px;">${message}</p>
    <div style="display: flex; gap: 8px;">
      <button onclick="this.closest('div[style*=\"position: fixed\"]').remove()" 
              style="flex: 1; background: #4a4a4a; color: #ececec; border: none; border-radius: 6px; padding: 8px 16px; font-size: 13px; cursor: pointer;">
        Maybe Later
      </button>
      <button onclick="window.open('https://your-upgrade-url.com', '_blank'); this.closest('div[style*=\"position: fixed\"]').remove()" 
              style="flex: 1; background: #ffd700; color: #171717; border: none; border-radius: 6px; padding: 8px 16px; font-size: 13px; font-weight: 600; cursor: pointer;">
        Upgrade Now
      </button>
    </div>
  `;
  
  modal.appendChild(content);
  document.body.appendChild(modal);
  
  // Remove modal when clicking outside
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// Update folder usage display
async function updateFolderUsageDisplay() {
  try {
    const [isPremiumResponse, folderCountResponse] = await Promise.all([
      sendMessageToBackground('getUserPremiumStatus'),
      sendMessageToBackground('getFolderCount')
    ]);
    
    if (isPremiumResponse.success && folderCountResponse.success) {
      const isPremium = isPremiumResponse.data;
      const folderCount = folderCountResponse.data;
      
      // Find or create usage display element
      let usageDisplay = document.getElementById('folderUsageDisplay');
      if (!usageDisplay) {
        usageDisplay = document.createElement('div');
        usageDisplay.id = 'folderUsageDisplay';
        usageDisplay.style.cssText = `
          padding: 8px 12px;
          background: #2a2a2a;
          border-radius: 4px;
          margin-bottom: 8px;
          font-size: 11px;
          color: #8e8e8e;
          text-align: center;
        `;
        
        // Insert before folder tree
        const folderTree = document.getElementById('folderTree');
        if (folderTree && folderTree.parentNode) {
          folderTree.parentNode.insertBefore(usageDisplay, folderTree);
        }
      }
      
      if (isPremium) {
        usageDisplay.textContent = `${folderCount} folders • Premium`;
        usageDisplay.style.color = '#ffd700';
      } else {
        usageDisplay.textContent = `${folderCount}/3 folders used`;
        usageDisplay.style.color = folderCount >= 3 ? '#ff6b6b' : '#8e8e8e';
      }
      
      // Update add folder button state
      const addFolderButton = document.getElementById('addFolderButton');
      if (addFolderButton) {
        const isLimitReached = !isPremium && folderCount >= 3;
        addFolderButton.disabled = isLimitReached;
        addFolderButton.style.opacity = isLimitReached ? '0.5' : '1';
        addFolderButton.style.cursor = isLimitReached ? 'not-allowed' : 'pointer';
        addFolderButton.title = isLimitReached ? 'Upgrade to premium for unlimited folders' : 'Add new folder';
      }
    }
  } catch (error) {
    console.error('Failed to update folder usage display:', error);
  }
}

// Toggle sidebar visibility
function toggleSidebar() {
  sidebarHidden = !sidebarHidden;
  
  const sidebar = document.querySelector('.sidebar');
  const mainContainer = document.querySelector('.main-container');
  
  if (sidebarHidden) {
    sidebar.classList.add('hidden');
    mainContainer.classList.add('sidebar-hidden');
    toggleSidebarBtn.title = 'Show folder list (Ctrl+B)';
    // Change icon to show folder icon
    toggleSidebarBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"/></svg>';
  } else {
    sidebar.classList.remove('hidden');
    mainContainer.classList.remove('sidebar-hidden');
    toggleSidebarBtn.title = 'Hide folder list (Ctrl+B)';
    // Change icon back to hamburger menu
    toggleSidebarBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>';
  }
  
  // Save state
  saveSidebarState();
}

// Load sidebar state from storage
async function loadSidebarState() {
  try {
    const response = await sendMessageToBackground('getMeta', { key: 'sidebarHidden' });
    if (response.success && response.data) {
      sidebarHidden = response.data;
      
      // Apply the state immediately
      const sidebar = document.querySelector('.sidebar');
      const mainContainer = document.querySelector('.main-container');
      
      if (sidebarHidden) {
        sidebar.classList.add('hidden');
        mainContainer.classList.add('sidebar-hidden');
        toggleSidebarBtn.title = 'Show folder list (Ctrl+B)';
        toggleSidebarBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"/></svg>';
      }
    }
  } catch (error) {
    console.error('Failed to load sidebar state:', error);
  }
}

// Save sidebar state to storage
async function saveSidebarState() {
  try {
    await sendMessageToBackground('saveMeta', { 
      key: 'sidebarHidden', 
      value: sidebarHidden 
    });
  } catch (error) {
    console.error('Failed to save sidebar state:', error);
  }
}

console.log('ChatGPT Bookmark Extension popup loaded');

// Test function for sidebar toggle feature (can be called from console)
window.testSidebarToggle = function() {
  console.log('Testing sidebar toggle...');
  console.log('Current sidebar state:', sidebarHidden);
  console.log('Toggle button found:', !!toggleSidebarBtn);
  console.log('Sidebar element found:', !!document.querySelector('.sidebar'));
  console.log('Main container found:', !!document.querySelector('.main-container'));
  
  // Test the toggle
  toggleSidebar();
  
  setTimeout(() => {
    console.log('After toggle - sidebar state:', sidebarHidden);
    console.log('Sidebar has hidden class:', document.querySelector('.sidebar').classList.contains('hidden'));
    console.log('Main container has sidebar-hidden class:', document.querySelector('.main-container').classList.contains('sidebar-hidden'));
  }, 100);
}; 