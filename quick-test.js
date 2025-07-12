// Quick test for the ChatGPT conversation crawling functionality
// Paste this into the browser console on ChatGPT to test

console.log('🔍 Testing ChatGPT Search Extension...');

// Copy the getAuthToken function from content-script.js
function getAuthToken() {
  try {
    // Method 1: Try to get from localStorage
    const accessToken = localStorage.getItem('accessToken');
    if (accessToken) {
      console.log('Found auth token in localStorage');
      return accessToken;
    }
    
    // Method 2: Try to get from sessionStorage
    const sessionStorageToken = sessionStorage.getItem('accessToken');
    if (sessionStorageToken) {
      console.log('Found auth token in sessionStorage');
      return sessionStorageToken;
    }
    
    // Method 3: Try to extract from the page's JavaScript context
    if (window.__NEXT_DATA__ && window.__NEXT_DATA__.props && window.__NEXT_DATA__.props.accessToken) {
      console.log('Found auth token in __NEXT_DATA__');
      return window.__NEXT_DATA__.props.accessToken;
    }
    
    // Method 4: Try to get from cookies
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'accessToken' || name === 'authToken') {
        console.log('Found auth token in cookies');
        return value;
      }
    }
    
    // Method 5: Try to get from the session token cookie
    const sessionCookieToken = getCookie('__Secure-next-auth.session-token');
    if (sessionCookieToken) {
      console.log('Found session token in cookies');
      return sessionCookieToken;
    }
    
    // Method 6: Try to get from other common cookie names
    const commonTokenNames = [
      'session-token',
      'auth-token',
      'openai-session',
      'chatgpt-token'
    ];
    
    for (const tokenName of commonTokenNames) {
      const token = getCookie(tokenName);
      if (token) {
        console.log(`Found token in cookie: ${tokenName}`);
        return token;
      }
    }
    
    // console.warn('Could not find authorization token automatically');
    return null;
    
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
}

// Helper function to get cookie by name
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

// Test the API call directly
async function testAPI() {
  try {
    // Try to get auth token
    const authToken = getAuthToken();
    console.log('Auth token found:', authToken ? 'Yes' : 'No');
    
    const headers = {
      'accept': '*/*',
      'accept-language': 'en-US,en;q=0.9',
      'content-type': 'application/json',
      'oai-language': 'en-US',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'user-agent': navigator.userAgent,
      'referer': window.location.href
    };
    
    if (authToken) {
      headers.authorization = `Bearer ${authToken}`;
    }
    
    const response = await fetch('https://chatgpt.com/backend-api/conversations?offset=0&limit=5&order=updated&is_archived=false', {
      method: 'GET',
      headers: headers,
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API works! Found', data.total, 'conversations');
      console.log('First conversation:', data.items[0]);
      return true;
    } else {
      console.error('❌ API failed:', response.status, response.statusText);
      return false;
    }
  } catch (error) {
    console.error('❌ API error:', error);
    return false;
  }
}

// Test the extension
async function testExtension() {
  if (window.chatgptBookmarkDebug) {
    console.log('✅ Extension loaded');
    
    // Test floating popup
    console.log('Testing floating popup...');
    window.chatgptBookmarkDebug.showFloatingPopup();
    
    setTimeout(() => {
      window.chatgptBookmarkDebug.hideFloatingPopup();
    }, 2000);
    
    // Test crawl
    console.log('Starting crawl...');
    const result = await window.chatgptBookmarkDebug.startCrawl(false);
    console.log('Crawl result:', result);
    
    return true;
  } else {
    console.error('❌ Extension not loaded');
    return false;
  }
}

// Run tests
async function runTests() {
  console.log('1. Testing API...');
  const apiWorks = await testAPI();
  
  console.log('2. Testing extension...');
  const extensionWorks = await testExtension();
  
  console.log('Results:', { apiWorks, extensionWorks });
  
  if (apiWorks && extensionWorks) {
    console.log('🎉 All tests passed! The extension should work.');
  } else {
    console.log('❌ Some tests failed. Check the errors above.');
  }
}

runTests(); 