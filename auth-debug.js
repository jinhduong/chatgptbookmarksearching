// Debug script to find authorization token on ChatGPT
// Paste this in the browser console on ChatGPT

console.log('🔍 Debugging authorization token...');

function debugAuthToken() {
  console.log('=== Authorization Token Debug ===');
  
  // Check localStorage
  console.log('1. localStorage:');
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.toLowerCase().includes('token') || key.toLowerCase().includes('auth')) {
      console.log(`   ${key}: ${localStorage.getItem(key).substring(0, 20)}...`);
    }
  }
  
  // Check sessionStorage
  console.log('2. sessionStorage:');
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key.toLowerCase().includes('token') || key.toLowerCase().includes('auth')) {
      console.log(`   ${key}: ${sessionStorage.getItem(key).substring(0, 20)}...`);
    }
  }
  
  // Check cookies
  console.log('3. Cookies:');
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name.toLowerCase().includes('token') || name.toLowerCase().includes('auth')) {
      console.log(`   ${name}: ${value.substring(0, 20)}...`);
    }
  }
  
  // Check __NEXT_DATA__
  console.log('4. __NEXT_DATA__:');
  if (window.__NEXT_DATA__) {
    console.log('   Available keys:', Object.keys(window.__NEXT_DATA__));
    if (window.__NEXT_DATA__.props) {
      console.log('   Props keys:', Object.keys(window.__NEXT_DATA__.props));
    }
  } else {
    console.log('   Not available');
  }
  
  // Check global variables
  console.log('5. Global variables:');
  const globalVars = Object.keys(window).filter(key => 
    key.toLowerCase().includes('token') || 
    key.toLowerCase().includes('auth') ||
    key.toLowerCase().includes('openai')
  );
  console.log('   Found:', globalVars);
  
  // Try to make a test API call
  console.log('6. Testing API call...');
  testApiCall();
}

async function testApiCall() {
  try {
    // Try without auth first
    const response1 = await fetch('https://chatgpt.com/backend-api/conversations?offset=0&limit=1', {
      method: 'GET',
      headers: {
        'accept': '*/*',
        'content-type': 'application/json',
        'oai-language': 'en-US',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': navigator.userAgent,
        'referer': window.location.href
      },
      credentials: 'include'
    });
    
    console.log('   Response without auth:', response1.status, response1.statusText);
    
    if (response1.ok) {
      const data = await response1.json();
      console.log('   ✅ API works without explicit auth token!');
      console.log('   Data:', data);
    } else {
      console.log('   ❌ API requires auth token');
    }
    
  } catch (error) {
    console.error('   ❌ API call error:', error);
  }
}

// Run the debug
debugAuthToken();

// Also provide a function to test with a specific token
window.testWithToken = function(token) {
  console.log('Testing with token:', token.substring(0, 20) + '...');
  
  fetch('https://chatgpt.com/backend-api/conversations?offset=0&limit=1', {
    method: 'GET',
    headers: {
      'accept': '*/*',
      'authorization': `Bearer ${token}`,
      'content-type': 'application/json',
      'oai-language': 'en-US',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'user-agent': navigator.userAgent,
      'referer': window.location.href
    },
    credentials: 'include'
  })
  .then(response => {
    console.log('Response:', response.status, response.statusText);
    if (response.ok) {
      return response.json();
    }
    throw new Error(`HTTP ${response.status}`);
  })
  .then(data => {
    console.log('✅ Success! Data:', data);
  })
  .catch(error => {
    console.error('❌ Error:', error);
  });
}; 