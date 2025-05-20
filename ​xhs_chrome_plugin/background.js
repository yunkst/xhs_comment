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

  // 代理API请求 - 解决跨域问题
  if (message.action === 'proxyApiRequest') {
    // 记录请求信息
    console.log(`代理API请求: ${message.method} ${message.url}`);
    
    // 异步执行请求
    (async () => {
      try {
        // 从存储中获取API令牌
        const { apiBaseUrl, apiToken } = await new Promise((resolve) => {
          chrome.storage.local.get(['apiBaseUrl', 'apiToken'], (result) => {
            resolve(result);
          });
        });
        
        // 添加认证头
        const headers = message.headers || {};
        if (apiToken && !headers['Authorization']) {
          headers['Authorization'] = `Bearer ${apiToken}`;
        }
        
        // 执行跨域请求
        const response = await fetch(message.url, {
          method: message.method || 'GET',
          headers: headers,
          body: message.body ? JSON.stringify(message.body) : undefined
        });
        
        // 处理响应
        if (message.responseType === 'blob' || message.url.includes('qrcode')) {
          // 处理二进制数据（如二维码图片）
          const blob = await response.blob();
          
          // 转换为base64
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = function() {
            const base64data = reader.result.split(',')[1]; // 去掉前缀部分
            sendResponse({
              success: true,
              status: response.status,
              statusText: response.statusText,
              data: base64data
            });
          };
          return true; // 保持连接打开，直到FileReader完成读取
        } else {
          // 处理普通响应
          const text = await response.text();
          let data;
          try {
            data = JSON.parse(text);
          } catch (e) {
            data = text;
          }
          
          // 返回响应
          sendResponse({
            success: true,
            status: response.status,
            statusText: response.statusText,
            data: data
          });
        }
      } catch (error) {
        console.error('代理API请求失败:', error);
        sendResponse({
          success: false,
          error: error.message
        });
      }
    })();
    
    return true; // 异步响应
  }

  // 监听消息
  if (message.action === 'autoUploadComments') {
    // 转发消息到活动标签页的popup
    chrome.runtime.sendMessage(message);
  }
}); 