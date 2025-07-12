// ChatGPT Bookmark Extension - Background Service Worker

// IndexedDB configuration
const DB_NAME = 'chatgpt-search';
const DB_VERSION = 3;
const BOOKMARKS_STORE = 'bookmarks';
const FOLDERS_STORE = 'folders';
const DOCS_STORE = 'docs';
const META_STORE = 'meta';

// Initialize IndexedDB
let db = null;

// FlexSearch indices
let searchIndex = null;
let docsIndex = null;

// Indexing status tracking
let isIndexing = false;
let indexingProgress = 0;

// Conversation crawl is now handled in content script

// Initialize extension
chrome.runtime.onStartup.addListener(initializeExtension);
chrome.runtime.onInstalled.addListener(initializeExtension);

async function initializeExtension() {
  try {
    await initializeDatabase();
    await migrateDataIfNeeded();
    await initializeSearchIndex();
    await initializeDocsIndex();
    console.log('ChatGPT Bookmark Extension initialized successfully');
  } catch (error) {
    console.error('Failed to initialize extension:', error);
  }
}

// Initialize IndexedDB
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      const oldVersion = event.oldVersion;
      
      // Create bookmarks store
      if (!database.objectStoreNames.contains(BOOKMARKS_STORE)) {
        const bookmarksStore = database.createObjectStore(BOOKMARKS_STORE, { keyPath: 'id' });
        bookmarksStore.createIndex('timestamp', 'timestamp', { unique: false });
        bookmarksStore.createIndex('title', 'title', { unique: false });
        bookmarksStore.createIndex('folderId', 'folderId', { unique: false });
      } else if (oldVersion < 3) {
        // Add folderId index to existing bookmarks store
        const transaction = event.target.transaction;
        const bookmarksStore = transaction.objectStore(BOOKMARKS_STORE);
        if (!bookmarksStore.indexNames.contains('folderId')) {
          bookmarksStore.createIndex('folderId', 'folderId', { unique: false });
        }
      }
      
      // Create folders store
      if (!database.objectStoreNames.contains(FOLDERS_STORE)) {
        const foldersStore = database.createObjectStore(FOLDERS_STORE, { keyPath: 'id' });
        foldersStore.createIndex('name', 'name', { unique: false });
        foldersStore.createIndex('parentId', 'parentId', { unique: false });
        foldersStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      
      // Create docs store for conversation messages
      if (!database.objectStoreNames.contains(DOCS_STORE)) {
        const docsStore = database.createObjectStore(DOCS_STORE, { keyPath: 'id' });
        docsStore.createIndex('convoId', 'convoId', { unique: false });
        docsStore.createIndex('time', 'time', { unique: false });
        docsStore.createIndex('role', 'role', { unique: false });
      }
      
      // Create metadata store for sync tracking
      if (!database.objectStoreNames.contains(META_STORE)) {
        const metaStore = database.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };
  });
}

// Initialize FlexSearch index
async function initializeSearchIndex() {
  // Simple FlexSearch implementation for background script
  searchIndex = {
    documents: new Map(),
    
    add: function(id, doc) {
      this.documents.set(id, {
        id: doc.id,
        title: doc.title.toLowerCase(),
        content: doc.content.toLowerCase(),
        timestamp: doc.timestamp
      });
    },
    
    remove: function(id) {
      this.documents.delete(id);
    },
    
    search: function(query) {
      const results = [];
      const searchTerm = query.toLowerCase();
      
      for (const [id, doc] of this.documents) {
        const titleMatch = doc.title.includes(searchTerm);
        const contentMatch = doc.content.includes(searchTerm);
        
        if (titleMatch || contentMatch) {
          results.push({
            id: doc.id,
            title: doc.title,
            content: doc.content,
            timestamp: doc.timestamp,
            score: titleMatch ? 2 : 1 // Higher score for title matches
          });
        }
      }
      
      return results.sort((a, b) => b.score - a.score || b.timestamp - a.timestamp);
    },
    
    clear: function() {
      this.documents.clear();
    }
  };
  
  // Load existing bookmarks into search index
  const bookmarks = await getAllBookmarks();
  for (const bookmark of bookmarks) {
    searchIndex.add(bookmark.id, bookmark);
  }
}

// Initialize FlexSearch Async index for conversation documents
async function initializeDocsIndex() {
  // Use simple search implementation for service worker
  docsIndex = {
    documents: new Map(),
    
    add: async function(doc) {
      this.documents.set(doc.id, {
        id: doc.id,
        convoId: doc.convoId,
        role: doc.role,
        text: doc.text.toLowerCase(),
        title: doc.title.toLowerCase(),
        time: doc.time
      });
    },
    
    remove: async function(id) {
      this.documents.delete(id);
    },
    
    search: async function(query, options = {}) {
      const results = [];
      const searchTerm = query.toLowerCase();
      const limit = options.limit || 20;
      
      for (const [id, doc] of this.documents) {
        const titleMatch = doc.title.includes(searchTerm);
        const textMatch = doc.text.includes(searchTerm);
        
        if (titleMatch || textMatch) {
          results.push({
            id: doc.id,
            convoId: doc.convoId,
            role: doc.role,
            text: doc.text,
            title: doc.title,
            time: doc.time,
            score: titleMatch ? 2 : 1
          });
        }
      }
      
      return results
        .sort((a, b) => b.score - a.score || b.time - a.time)
        .slice(0, limit);
    },
    
    clear: function() {
      this.documents.clear();
    }
  };
  
  // Load existing documents
  const docs = await getAllDocs();
  for (const doc of docs) {
    await docsIndex.add(doc);
  }
  
  console.log(`Loaded ${docs.length} documents into search index`);
}

// Update indexing status
function updateIndexingStatus(indexing, progress = 0) {
  isIndexing = indexing;
  indexingProgress = progress;
  
  // Send progress update to all popup instances
  if (indexing) {
    broadcastMessage({
      type: 'indexingProgress',
      messageCount: progress
    });
  } else {
    broadcastMessage({
      type: 'indexingComplete'
    });
  }
}

// Broadcast message to all extension contexts
function broadcastMessage(message) {
  // Send to popup
  chrome.runtime.sendMessage(message).catch(() => {
    // Ignore errors if no popup is open
  });
  
  // Send to all content scripts
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, message).catch(() => {
        // Ignore errors if content script not loaded
      });
    });
  });
}

// Migration function to handle data structure changes
async function migrateDataIfNeeded() {
  if (!db) await initializeDatabase();
  
  try {
    const schemaVersion = await getMeta('schemaVersion');
    
    if (!schemaVersion || schemaVersion < 3) {
      console.log('Migrating data to support folders...');
      
      // Create default folder if it doesn't exist
      const defaultFolder = await getFolder('default');
      if (!defaultFolder) {
        await saveFolder({
          id: 'default',
          name: 'Uncategorized',
          parentId: null,
          createdAt: Date.now()
        });
      }
      
      // Update existing bookmarks to have folderId
      const bookmarks = await getAllBookmarks();
      for (const bookmark of bookmarks) {
        if (!bookmark.folderId) {
          bookmark.folderId = 'default';
          await saveBookmark(bookmark);
        }
      }
      
      // Update schema version
      await saveMeta('schemaVersion', 3);
      console.log('Data migration completed successfully');
    }
  } catch (error) {
    console.error('Failed to migrate data:', error);
  }
}

// Database operations
async function getAllBookmarks() {
  if (!db) await initializeDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([BOOKMARKS_STORE], 'readonly');
    const store = transaction.objectStore(BOOKMARKS_STORE);
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// Get all existing conversation IDs from the database
async function getExistingConversationIds() {
  if (!db) await initializeDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DOCS_STORE], 'readonly');
    const store = transaction.objectStore(DOCS_STORE);
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      // Extract unique conversation IDs from all documents
      const convoIds = new Set();
      request.result.forEach(doc => {
        if (doc.convoId) {
          convoIds.add(doc.convoId);
        }
      });
      
      const uniqueConvoIds = Array.from(convoIds);
      console.log(`Found ${uniqueConvoIds.length} existing conversation IDs in database`);
      console.log('Sample existing conversation IDs:', uniqueConvoIds.slice(0, 5));
      resolve(uniqueConvoIds);
    };
  });
}

async function getAllDocs() {
  if (!db) await initializeDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DOCS_STORE], 'readonly');
    const store = transaction.objectStore(DOCS_STORE);
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function getDoc(id) {
  if (!db) await initializeDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DOCS_STORE], 'readonly');
    const store = transaction.objectStore(DOCS_STORE);
    const request = store.get(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function saveDoc(doc) {
  if (!db) await initializeDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DOCS_STORE], 'readwrite');
    const store = transaction.objectStore(DOCS_STORE);
    const request = store.put(doc);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = async () => {
      // Update search index
      if (docsIndex) {
        await docsIndex.add(doc);
      }
      resolve(request.result);
    };
  });
}

async function saveDocs(docs) {
  if (!db) await initializeDatabase();
  
  // Update indexing status to show we're starting
  updateIndexingStatus(true, 0);
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DOCS_STORE], 'readwrite');
    const store = transaction.objectStore(DOCS_STORE);
    
    let processed = 0;
    const total = docs.length;
    
    docs.forEach(doc => {
      const request = store.put(doc);
      
      request.onerror = () => {
        // Mark indexing as complete even on error
        updateIndexingStatus(false, processed);
        reject(request.error);
      };
      
      request.onsuccess = async () => {
        processed++;
        
        // Update progress every 10 documents or on completion
        if (processed % 10 === 0 || processed === total) {
          updateIndexingStatus(true, processed);
        }
        
        if (processed === total) {
          // Update search index for all docs
          if (docsIndex) {
            for (const doc of docs) {
              await docsIndex.add(doc);
            }
          }
          
          // Mark indexing as complete
          updateIndexingStatus(false, processed);
          resolve(processed);
        }
      };
    });
  });
}

async function getMeta(key) {
  if (!db) await initializeDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([META_STORE], 'readonly');
    const store = transaction.objectStore(META_STORE);
    const request = store.get(key);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result?.value || null);
  });
}

async function saveMeta(key, value) {
  if (!db) await initializeDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([META_STORE], 'readwrite');
    const store = transaction.objectStore(META_STORE);
    const request = store.put({ key, value });
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// Folder CRUD operations
async function getAllFolders() {
  if (!db) await initializeDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([FOLDERS_STORE], 'readonly');
    const store = transaction.objectStore(FOLDERS_STORE);
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function getFolder(id) {
  if (!db) await initializeDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([FOLDERS_STORE], 'readonly');
    const store = transaction.objectStore(FOLDERS_STORE);
    const request = store.get(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function saveFolder(folder) {
  if (!db) await initializeDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([FOLDERS_STORE], 'readwrite');
    const store = transaction.objectStore(FOLDERS_STORE);
    const request = store.put(folder);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function deleteFolder(id) {
  if (!db) await initializeDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([FOLDERS_STORE], 'readwrite');
    const store = transaction.objectStore(FOLDERS_STORE);
    const request = store.delete(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function getFoldersByParent(parentId) {
  if (!db) await initializeDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([FOLDERS_STORE], 'readonly');
    const store = transaction.objectStore(FOLDERS_STORE);
    const index = store.index('parentId');
    const request = index.getAll(parentId);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function getBookmarksByFolder(folderId) {
  if (!db) await initializeDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([BOOKMARKS_STORE], 'readonly');
    const store = transaction.objectStore(BOOKMARKS_STORE);
    const index = store.index('folderId');
    const request = index.getAll(folderId);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function moveBookmark(bookmarkId, newFolderId) {
  const bookmark = await getBookmark(bookmarkId);
  if (bookmark) {
    bookmark.folderId = newFolderId;
    await saveBookmark(bookmark);
    
    // Update search index
    searchIndex.remove(bookmarkId);
    searchIndex.add(bookmarkId, bookmark);
  }
}

async function createFolder(name, parentId = null) {
  const folder = {
    id: generateFolderId(name, parentId),
    name,
    parentId,
    createdAt: Date.now()
  };
  
  await saveFolder(folder);
  return folder;
}

async function getBookmark(id) {
  if (!db) await initializeDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([BOOKMARKS_STORE], 'readonly');
    const store = transaction.objectStore(BOOKMARKS_STORE);
    const request = store.get(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function saveBookmark(bookmark) {
  if (!db) await initializeDatabase();
  
  // Ensure bookmark has a folderId - use default folder if not specified
  if (!bookmark.folderId) {
    const lastUsedFolder = await getMeta('lastUsedFolder');
    bookmark.folderId = lastUsedFolder || 'default';
  }
  
  return new Promise(async (resolve, reject) => {
    const transaction = db.transaction([BOOKMARKS_STORE], 'readwrite');
    const store = transaction.objectStore(BOOKMARKS_STORE);
    const request = store.put(bookmark);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = async () => {
      // Update search index
      if (searchIndex) {
        searchIndex.add(bookmark.id, bookmark);
      }
      
      // Save as last used folder (but don't await to avoid blocking)
      saveMeta('lastUsedFolder', bookmark.folderId).catch(console.error);
      
      resolve(request.result);
    };
  });
}

async function deleteBookmark(id) {
  if (!db) await initializeDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([BOOKMARKS_STORE], 'readwrite');
    const store = transaction.objectStore(BOOKMARKS_STORE);
    const request = store.delete(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      // Update search index
      if (searchIndex) {
        searchIndex.remove(id);
      }
      resolve(request.result);
    };
  });
}

// Search functionality
async function searchBookmarks(query) {
  if (!searchIndex) await initializeSearchIndex();
  
  if (!query || query.trim() === '') {
    return await getAllBookmarks();
  }
  
  return searchIndex.search(query.trim());
}

async function searchConversations(query, options = {}) {
  if (!docsIndex) await initializeDocsIndex();
  
  if (!query || query.trim() === '') {
    return await getAllDocs();
  }
  
  const results = await docsIndex.search(query.trim(), options);
  
  // Group results by conversation and add snippets
  const conversations = new Map();
  
  for (const result of results) {
    const doc = typeof result === 'string' ? await getDoc(result) : result;
    if (!doc) continue;
    
    const convoId = doc.convoId;
    if (!conversations.has(convoId)) {
      conversations.set(convoId, {
        id: convoId,
        title: doc.title,
        messages: [],
        lastUpdate: doc.time
      });
    }
    
    const convo = conversations.get(convoId);
    convo.messages.push({
      id: doc.id,
      role: doc.role,
      text: doc.text,
      time: doc.time,
      snippet: generateSnippet(doc.text, query)
    });
    
    if (doc.time > convo.lastUpdate) {
      convo.lastUpdate = doc.time;
    }
  }
  
  return Array.from(conversations.values())
    .sort((a, b) => b.lastUpdate - a.lastUpdate)
    .slice(0, options.limit || 20);
}

function generateSnippet(text, query) {
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  const index = textLower.indexOf(queryLower);
  
  if (index === -1) {
    return text.substring(0, 150) + '...';
  }
  
  const start = Math.max(0, index - 50);
  const end = Math.min(text.length, index + query.length + 50);
  
  let snippet = text.substring(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  
  return snippet;
}

// Conversation crawling is now handled in content script

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender, sendResponse);
  return true; // Keep message channel open for async responses
});

async function handleMessage(request, sender, sendResponse) {
  try {
    switch (request.action) {
      case 'getAllBookmarks':
        const allBookmarks = await getAllBookmarks();
        sendResponse({ success: true, data: allBookmarks });
        break;
        
      case 'getBookmark':
        const bookmark = await getBookmark(request.id);
        sendResponse({ success: true, data: bookmark });
        break;
        
      case 'saveBookmark':
        await saveBookmark(request.bookmark);
        sendResponse({ success: true });
        break;
        
      case 'deleteBookmark':
        await deleteBookmark(request.id);
        sendResponse({ success: true });
        break;
        
      case 'searchBookmarks':
        const results = await searchBookmarks(request.query);
        sendResponse({ success: true, data: results });
        break;
        
      case 'searchConversations':
        const conversations = await searchConversations(request.query, request.options);
        sendResponse({ success: true, data: conversations });
        break;
        
      case 'getCrawlProgress':
        sendResponse({ 
          success: true, 
          data: { 
            isCrawling: false, 
            progress: { current: 0, total: 0 } 
          } 
        });
        break;
        
      case 'getAllDocs':
        const allDocs = await getAllDocs();
        sendResponse({ success: true, data: allDocs });
        break;
        
      case 'getExistingConversationIds':
        const existingConvoIds = await getExistingConversationIds();
        sendResponse({ success: true, data: existingConvoIds });
        break;
        
      case 'getMeta':
        const metaValue = await getMeta(request.key);
        sendResponse({ success: true, data: metaValue });
        break;
        
      case 'saveMeta':
        await saveMeta(request.key, request.value);
        sendResponse({ success: true });
        break;
        
      case 'getIndexingStatus':
        sendResponse({ 
          success: true, 
          data: { 
            isIndexing: isIndexing, 
            progress: indexingProgress 
          } 
        });
        break;
        
      case 'saveDocs':
        const savedCount = await saveDocs(request.docs);
        sendResponse({ success: true, data: savedCount });
        break;
        
      case 'isBookmarked':
        const existingBookmark = await getBookmark(request.id);
        sendResponse({ success: true, data: !!existingBookmark });
        break;
        
      case 'toggleBookmark':
        const exists = await getBookmark(request.id);
        if (exists) {
          await deleteBookmark(request.id);
          sendResponse({ success: true, bookmarked: false });
        } else {
          await saveBookmark(request.bookmark);
          sendResponse({ success: true, bookmarked: true });
        }
        break;
        
      case 'getBookmarkCount':
        const bookmarks = await getAllBookmarks();
        sendResponse({ success: true, data: bookmarks.length });
        break;
        
      case 'getAllFolders':
        const allFolders = await getAllFolders();
        sendResponse({ success: true, data: allFolders });
        break;
        
      case 'getFolder':
        const folder = await getFolder(request.id);
        sendResponse({ success: true, data: folder });
        break;
        
      case 'saveFolder':
        await saveFolder(request.folder);
        sendResponse({ success: true });
        break;
        
      case 'deleteFolder':
        await deleteFolder(request.id);
        sendResponse({ success: true });
        break;
        
      case 'createFolder':
        const newFolder = await createFolder(request.name, request.parentId);
        sendResponse({ success: true, data: newFolder });
        break;
        
      case 'getFoldersByParent':
        const childFolders = await getFoldersByParent(request.parentId);
        sendResponse({ success: true, data: childFolders });
        break;
        
      case 'getBookmarksByFolder':
        const folderBookmarks = await getBookmarksByFolder(request.folderId);
        sendResponse({ success: true, data: folderBookmarks });
        break;
        
      case 'moveBookmark':
        await moveBookmark(request.bookmarkId, request.newFolderId);
        sendResponse({ success: true });
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  } catch (error) {
    console.error('Background script error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Utility functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function generateBookmarkId(title, content) {
  // Create a simple hash-based ID
  const str = title + content;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

function generateFolderId(name, parentId) {
  // Create a simple hash-based ID for folders
  const str = name + (parentId || '');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return 'folder_' + Math.abs(hash).toString(36) + Date.now().toString(36);
}

// Helper function to format timestamps
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) { // Less than 1 minute
    return 'Just now';
  } else if (diff < 3600000) { // Less than 1 hour
    return Math.floor(diff / 60000) + 'm ago';
  } else if (diff < 86400000) { // Less than 24 hours
    return Math.floor(diff / 3600000) + 'h ago';
  } else if (diff < 2592000000) { // Less than 30 days
    return Math.floor(diff / 86400000) + 'd ago';
  } else {
    return date.toLocaleDateString();
  }
}

// Export functions for use in popup and content scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getAllBookmarks,
    getBookmark,
    saveBookmark,
    deleteBookmark,
    searchBookmarks,
    escapeHtml,
    generateBookmarkId,
    formatTimestamp
  };
}

// Initialize on script load
initializeExtension(); 