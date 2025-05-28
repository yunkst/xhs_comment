// 存储网络请求数据
let requestLog = [];
let MAX_LOG_SIZE = 1000; // 默认最多保存1000条记录

// 插件配置
let pluginConfig = {
    enableMonitoring: true,
    enableEnhanced: true,
    urlPatterns: [
        { pattern: '*.xiaohongshu.com/*', enabled: true },
        { pattern: '*.xhscdn.com/*', enabled: true },
        { pattern: '*.fegine.com/*', enabled: true }
    ],
    monitorTypes: {
        xhr: true,
        fetch: true,
        images: true,
        scripts: true,
        styles: true,
        documents: true
    },
    maxLogSize: 1000,
    logRequestBody: true,
    logResponseBody: true
};

// 初始化时加载配置
chrome.storage.sync.get(['xhs_monitor_config'], function(result) {
    if (result.xhs_monitor_config) {
        pluginConfig = { ...pluginConfig, ...result.xhs_monitor_config };
        MAX_LOG_SIZE = pluginConfig.maxLogSize;
        console.log('插件配置已加载:', pluginConfig);
    }
});

// 检查URL是否匹配配置的模式
function isUrlMatched(url) {
    if (!pluginConfig.enableMonitoring) {
        return false;
    }

    return pluginConfig.urlPatterns.some(pattern => {
        if (!pattern.enabled) return false;
        return matchUrlPattern(url, pattern.pattern);
    });
}

// URL模式匹配函数
function matchUrlPattern(url, pattern) {
    // 将通配符模式转换为正则表达式
    const regexPattern = pattern
        .replace(/\./g, '\\.')  // 转义点号
        .replace(/\*/g, '.*')   // 通配符转换为.*
        .replace(/\?/g, '\\?'); // 转义问号
    
    const regex = new RegExp('^' + regexPattern + '$', 'i');
    return regex.test(url);
}

// 检查请求类型是否应该被监控
function shouldMonitorRequestType(type) {
    const typeMapping = {
        'xmlhttprequest': 'xhr',
        'fetch': 'fetch',
        'image': 'images',
        'script': 'scripts',
        'stylesheet': 'styles',
        'main_frame': 'documents',
        'sub_frame': 'documents'
    };
    
    const configKey = typeMapping[type] || 'xhr';
    return pluginConfig.monitorTypes[configKey];
}

// 监听所有网络请求
chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    // 检查是否应该监控这个URL和请求类型
    if (isUrlMatched(details.url) && shouldMonitorRequestType(details.type)) {
      const requestData = {
        id: details.requestId,
        url: details.url,
        method: details.method,
        type: details.type,
        timestamp: Date.now(),
        timeString: new Date().toLocaleString('zh-CN'),
        tabId: details.tabId,
        requestBody: null
      };

      // 如果配置允许记录请求体且有请求体数据
      if (pluginConfig.logRequestBody && details.requestBody) {
        requestData.requestBody = details.requestBody;
      }

      addToLog(requestData);
    }
  },
  {urls: ["<all_urls>"]},
  ["requestBody"]
);

// 监听请求头
chrome.webRequest.onBeforeSendHeaders.addListener(
  function(details) {
    if (isUrlMatched(details.url)) {
      updateLogWithHeaders(details.requestId, 'requestHeaders', details.requestHeaders);
    }
  },
  {urls: ["<all_urls>"]},
  ["requestHeaders"]
);

// 监听响应头
chrome.webRequest.onHeadersReceived.addListener(
  function(details) {
    if (isUrlMatched(details.url)) {
      updateLogWithHeaders(details.requestId, 'responseHeaders', details.responseHeaders);
      updateLogWithStatus(details.requestId, details.statusCode);
    }
  },
  {urls: ["<all_urls>"]},
  ["responseHeaders"]
);

// 监听请求完成
chrome.webRequest.onCompleted.addListener(
  function(details) {
    if (isUrlMatched(details.url)) {
      updateLogWithCompletion(details.requestId, details.statusCode, 'completed');
      // 记录响应大小和类型信息
      updateLogWithResponseInfo(details.requestId, {
        responseSize: details.responseSize,
        contentLength: details.responseHeaders ? 
          details.responseHeaders.find(h => h.name.toLowerCase() === 'content-length')?.value : null
      });
    }
  },
  {urls: ["<all_urls>"]},
  ["responseHeaders"]
);

// 监听请求错误
chrome.webRequest.onErrorOccurred.addListener(
  function(details) {
    if (isUrlMatched(details.url)) {
      updateLogWithCompletion(details.requestId, null, 'error', details.error);
    }
  },
  {urls: ["<all_urls>"]}
);

// 添加到日志
function addToLog(requestData) {
  console.log('[Background Debug] 添加新请求到日志:', requestData.url, requestData.method);
  
  requestLog.unshift(requestData);
  
  // 限制日志大小
  if (requestLog.length > MAX_LOG_SIZE) {
    requestLog = requestLog.slice(0, MAX_LOG_SIZE);
    console.log('[Background Debug] 日志已裁剪到', MAX_LOG_SIZE, '条');
  }
  
  console.log('[Background Debug] 当前日志总数:', requestLog.length);
  
  // 保存到本地存储
  saveToStorage();
  
  // 更新徽章计数
  updateBadge();
}

// 更新日志中的请求头信息
function updateLogWithHeaders(requestId, headerType, headers) {
  const logEntry = requestLog.find(entry => entry.id === requestId);
  if (logEntry) {
    logEntry[headerType] = headers;
    saveToStorage();
  }
}

// 更新日志中的状态码
function updateLogWithStatus(requestId, statusCode) {
  const logEntry = requestLog.find(entry => entry.id === requestId);
  if (logEntry) {
    logEntry.statusCode = statusCode;
    saveToStorage();
  }
}

// 更新日志中的完成状态
function updateLogWithCompletion(requestId, statusCode, status, error = null) {
  const logEntry = requestLog.find(entry => entry.id === requestId);
  if (logEntry) {
    logEntry.status = status;
    if (statusCode) logEntry.statusCode = statusCode;
    if (error) logEntry.error = error;
    logEntry.completedAt = Date.now();
    // 计算响应时间
    if (logEntry.timestamp) {
      logEntry.responseTime = Date.now() - logEntry.timestamp;
    }
    saveToStorage();
  }
}

// 更新日志中的响应信息
function updateLogWithResponseInfo(requestId, responseInfo) {
  const logEntry = requestLog.find(entry => entry.id === requestId);
  if (logEntry) {
    logEntry.responseSize = responseInfo.responseSize;
    logEntry.contentLength = responseInfo.contentLength;
    saveToStorage();
  }
}

// 更新日志中的自定义响应数据
function updateLogWithCustomResponse(responseData) {
  const logEntry = requestLog.find(entry => entry.id === responseData.requestId);
  if (logEntry) {
    if (pluginConfig.logResponseBody) {
      logEntry.response = {
        status: responseData.response.status,
        statusText: responseData.response.statusText,
        headers: responseData.response.headers,
        body: responseData.response.body,
        contentType: responseData.response.contentType,
        responseTime: responseData.response.responseTime,
        bodySize: responseData.response.bodySize
      };
    } else {
      logEntry.response = {
        status: responseData.response.status,
        statusText: responseData.response.statusText,
        headers: responseData.response.headers,
        contentType: responseData.response.contentType,
        responseTime: responseData.response.responseTime,
        bodySize: responseData.response.bodySize
      };
    }
    
    logEntry.statusCode = responseData.response.status;
    logEntry.status = 'completed';
    logEntry.completedAt = Date.now();
    
    if (responseData.response.responseTime) {
      logEntry.responseTime = responseData.response.responseTime;
    }
    
    saveToStorage();
  }
}

// 更新日志中的性能数据
function updateLogWithPerformanceData(performanceData) {
  const logEntry = requestLog.find(entry => entry.id === performanceData.requestId);
  if (logEntry) {
    logEntry.performanceData = performanceData.performanceData;
    logEntry.responseTime = performanceData.performanceData.duration;
    logEntry.responseSize = performanceData.performanceData.transferSize;
    saveToStorage();
  } else {
    // 如果没有找到对应的请求记录，创建一个新的
    if (isUrlMatched(performanceData.url)) {
      const requestData = {
        id: performanceData.requestId,
        url: performanceData.url,
        method: performanceData.method,
        type: 'performance_detected',
        timestamp: Date.now(),
        timeString: new Date().toLocaleString('zh-CN'),
        performanceData: performanceData.performanceData,
        responseTime: performanceData.performanceData.duration,
        responseSize: performanceData.performanceData.transferSize,
        source: 'performance_observer'
      };
      
      addToLog(requestData);
    }
  }
}

// 保存到本地存储
function saveToStorage() {
  chrome.storage.local.set({
    'xhs_request_log': requestLog,
    'last_updated': Date.now()
  });
}

// 从本地存储加载数据
function loadFromStorage() {
  console.log('[Background Debug] 开始从storage加载数据...');
  
  chrome.storage.local.get(['xhs_request_log'], function(result) {
    console.log('[Background Debug] Storage结果:', result);
    
    if (result.xhs_request_log) {
      requestLog = result.xhs_request_log;
      console.log('[Background Debug] 从storage加载了', requestLog.length, '条记录');
      updateBadge();
    } else {
      console.log('[Background Debug] Storage中没有找到请求日志');
    }
  });
}

// 更新扩展图标徽章
function updateBadge() {
  const count = requestLog.length;
  chrome.action.setBadgeText({
    text: count > 0 ? count.toString() : ''
  });
  chrome.action.setBadgeBackgroundColor({
    color: '#FF6B6B'
  });
}

// 监听来自popup和content script的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  switch(request.action) {
    case 'getRequestLog':
      console.log('[Background Debug] 收到getRequestLog请求');
      console.log('[Background Debug] 当前requestLog长度:', requestLog.length);
      console.log('[Background Debug] 当前配置:', pluginConfig);
      
      const response = {
        log: requestLog,
        totalCount: requestLog.length,
        config: pluginConfig
      };
      
      console.log('[Background Debug] 发送响应:', {
        logLength: response.log.length,
        totalCount: response.totalCount,
        configKeys: Object.keys(response.config)
      });
      
      sendResponse(response);
      break;
    
    case 'clearLog':
      requestLog = [];
      saveToStorage();
      updateBadge();
      sendResponse({success: true});
      break;
    
    case 'exportLog':
      try {
        const dataStr = JSON.stringify(requestLog, null, 2);
        // 在Service Worker中使用data URI代替Blob URL
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        
        chrome.downloads.download({
          url: dataUri,
          filename: `xiaohongshu_requests_${new Date().toISOString().slice(0, 10)}.json`,
          saveAs: true
        }, function(downloadId) {
          if (chrome.runtime.lastError) {
            console.error('下载失败:', chrome.runtime.lastError);
            sendResponse({success: false, error: chrome.runtime.lastError.message});
          } else {
            console.log('文件下载开始，下载ID:', downloadId);
            sendResponse({success: true, downloadId: downloadId});
          }
        });
      } catch (error) {
        console.error('导出错误:', error);
        sendResponse({success: false, error: error.message});
      }
      break;
    
    case 'configUpdated':
      // 配置更新时重新加载配置
      pluginConfig = { ...pluginConfig, ...request.config };
      MAX_LOG_SIZE = pluginConfig.maxLogSize;
      
      // 如果日志超过新的限制，裁剪日志
      if (requestLog.length > MAX_LOG_SIZE) {
        requestLog = requestLog.slice(0, MAX_LOG_SIZE);
        saveToStorage();
        updateBadge();
      }
      
      console.log('配置已更新:', pluginConfig);
      sendResponse({success: true});
      break;
    
    case 'getConfig':
      sendResponse({config: pluginConfig});
      break;
    
    case 'logCustomRequest':
      // 处理来自content script的自定义请求
      if (request.data) {
        // 检查URL是否匹配配置
        if (!isUrlMatched(request.data.url)) {
          sendResponse({success: false, reason: 'URL not matched'});
          break;
        }
        
        if (request.data.type?.includes('_response') || request.data.type === 'refetch_response') {
          // 处理响应数据
          updateLogWithCustomResponse(request.data);
          sendResponse({success: true});
        } else if (request.data.type === 'performance_entry') {
          // 处理性能数据
          updateLogWithPerformanceData(request.data);
          sendResponse({success: true});
        } else {
          // 处理请求数据
          const requestData = {
            id: request.data.requestId || `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            url: request.data.url,
            method: request.data.method,
            type: request.data.type,
            timestamp: request.data.timestamp,
            timeString: request.data.timeString,
            tabId: sender.tab ? sender.tab.id : null,
            requestHeaders: request.data.headers ? Object.entries(request.data.headers).map(([name, value]) => ({name, value})) : null,
            requestBody: (pluginConfig.logRequestBody && request.data.body) ? {raw: [{bytes: new TextEncoder().encode(request.data.body)}]} : null,
            source: request.data.source,
            performanceData: request.data.performanceData
          };
          
          // 如果包含错误信息
          if (request.data.error) {
            requestData.error = request.data.error;
            requestData.status = 'error';
          }
          
          addToLog(requestData);
          sendResponse({success: true});
        }
      } else {
        sendResponse({error: 'No data provided'});
      }
      break;
    
    default:
      sendResponse({error: 'Unknown action'});
  }
  return true; // 保持消息通道开放
});

// 监听配置变化
chrome.storage.onChanged.addListener(function(changes, namespace) {
  if (namespace === 'sync' && changes.xhs_monitor_config) {
    pluginConfig = { ...pluginConfig, ...changes.xhs_monitor_config.newValue };
    MAX_LOG_SIZE = pluginConfig.maxLogSize;
    console.log('配置已自动更新:', pluginConfig);
  }
});

// 扩展启动时加载数据
loadFromStorage();

console.log('小红书网络请求监控插件已启动'); 