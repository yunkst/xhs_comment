// 扩展安装或更新时
chrome.runtime.onInstalled.addListener(function(details) {
  if (details.reason === 'install') {
    // 首次安装时的操作
    console.log('小红书通知列表获取插件已安装');
  } else if (details.reason === 'update') {
    // 更新时的操作
    console.log('小红书通知列表获取插件已更新');
  }
});

// 处理来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'saveNotifications' && message.data) {
    // 保存通知数据到存储
    chrome.storage.local.set({ 
      notifications: message.data,
      lastUpdate: new Date().toISOString()
    }, function() {
      sendResponse({ success: true });
    });
    return true; // 异步响应
  }
  
  if (message.action === 'getStoredNotifications') {
    // 获取存储的通知数据
    chrome.storage.local.get(['notifications', 'lastUpdate'], function(result) {
      sendResponse({
        success: true,
        data: result.notifications || [],
        lastUpdate: result.lastUpdate
      });
    });
    return true; // 异步响应
  }
}); 