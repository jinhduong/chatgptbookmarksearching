// Test script for conversation crawling functionality
// To run this: Open ChatGPT in browser, open DevTools console, paste this code

async function testConversationCrawl() {
  console.log('🚀 Testing conversation crawl functionality...');
  
  // Test 1: Check if extension is loaded
  if (!window.chatgptBookmarkDebug) {
    console.error('❌ Extension not loaded or debug functions not available');
    return;
  }
  
  console.log('✅ Extension debug functions available');
  
  // Test 2: Check extension stats
  const stats = window.chatgptBookmarkDebug.getStats();
  console.log('📊 Extension stats:', stats);
  
  // Test 3: Get crawl status
  const crawlStatus = await window.chatgptBookmarkDebug.getCrawlStatus();
  console.log('🔍 Crawl status:', crawlStatus);
  
  // Test 4: Test API headers
  console.log('🔧 Testing API headers...');
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
    'user-agent': navigator.userAgent,
    'referer': window.location.href
  };
  
  // Test 5: Test API call
  console.log('📡 Testing API call...');
  try {
    const response = await fetch('https://chatgpt.com/backend-api/conversations?offset=0&limit=5&order=updated&is_archived=false', {
      method: 'GET',
      headers: headers,
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API call successful:', {
        total: data.total,
        items: data.items?.length || 0,
        firstItem: data.items?.[0] ? {
          id: data.items[0].id,
          title: data.items[0].title,
          update_time: data.items[0].update_time
        } : null
      });
    } else {
      console.error('❌ API call failed:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('❌ API call error:', error);
  }
  
  // Test 6: Test floating popup
  console.log('💫 Testing floating popup...');
  window.chatgptBookmarkDebug.showFloatingPopup();
  
  setTimeout(() => {
    console.log('🎯 Hiding floating popup...');
    window.chatgptBookmarkDebug.hideFloatingPopup();
  }, 2000);
  
  // Test 7: Start a small test crawl
  console.log('🔄 Starting test crawl...');
  try {
    const result = await window.chatgptBookmarkDebug.startCrawl(false);
    console.log('✅ Test crawl result:', result);
  } catch (error) {
    console.error('❌ Test crawl failed:', error);
  }
  
  console.log('🎉 Test completed!');
}

// Run the test
testConversationCrawl().catch(console.error); 