// 监听来自popup的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('收到消息:', request.action);
  // 获取通知数据
  if (request.action === 'getNotifications') {
    console.log('开始获取通知数据');
    // 检查当前是否在小红书通知页面
    if (window.location.href.includes('xiaohongshu.com/notification')) {
      console.log('当前在小红书通知页面');
      // 从页面DOM中提取通知数据
      const notifications = window.xhsNotificationHandler.extractNotificationsFromDOM();
      console.log('提取到的通知数据:', notifications);
      // 添加红色按钮到通知列表
      window.xhsNotificationHandler.addButtonsToNotifications();
      sendResponse({success: true, data: notifications});
    } else {
      console.log('当前不在小红书通知页面');
      // 如果不在通知页面，则返回重定向信息
      sendResponse({
        success: false, 
        error: '请先打开小红书通知页面',
        redirectUrl: 'https://www.xiaohongshu.com/notification'
      });
    }
    return true;
  }
  // 获取笔记内容
  else if (request.action === 'getNoteContent') {
    console.log('开始获取笔记内容');
    // 检查当前是否在小红书笔记页面
    if (window.location.href.includes('xiaohongshu.com/explore/')) {
      console.log('当前在小红书笔记页面');
      // 从页面DOM中提取笔记内容
      const noteContent = window.xhsNoteExtractor.extractNoteContentFromDOM();
      console.log('提取到的笔记内容:', noteContent);
      sendResponse({success: true, data: noteContent});
    } else {
      console.log('当前不在小红书笔记页面');
      // 如果不在笔记页面，则返回错误信息
      sendResponse({
        success: false, 
        error: '请先打开小红书笔记页面',
        redirectUrl: 'https://www.xiaohongshu.com/explore'
      });
    }
    return true;
  }
  // 触发上传评论按钮
  else if (request.action === 'triggerCommentsUpload') {
    console.log('触发上传评论按钮');
    // 向popup发送消息，触发上传评论操作
    chrome.runtime.sendMessage({action: 'uploadComments'});
    sendResponse({success: true});
    return true;
  }
});

// 自动上传评论配置
let autoUploadConfig = {
  enabled: false,
  lastTriggerTime: 0,
  cooldownPeriod: 10000, // 10秒冷却时间，防止频繁触发
  isInitialized: false
};

// 检查所有模块是否已加载
function areAllModulesLoaded() {
  return (
    window.xhsUtils &&
    window.xhsApiService &&
    window.xhsNoteExtractor &&
    window.xhsUserNotes &&
    window.xhsDialogManager &&
    window.xhsNotificationHandler
  );
}

// 加载自动上传评论配置
function loadAutoUploadConfig() {
  console.log('加载自动上传评论配置开始...');
  chrome.storage.local.get(['autoUploadComments'], function(result) {
    const oldValue = autoUploadConfig.enabled;
    autoUploadConfig.enabled = result.autoUploadComments === true;
    autoUploadConfig.isInitialized = true;
    console.log('已加载自动上传评论配置:', autoUploadConfig.enabled, 
                '存储中的原始值:', result.autoUploadComments);
    
    // 如果值发生变化，额外提示
    if (oldValue !== autoUploadConfig.enabled) {
      console.log(`自动上传评论配置已从 ${oldValue} 更改为 ${autoUploadConfig.enabled}`);
      // 如果在笔记页面，根据新配置决定是否开始监控
      if (window.location.href.includes('xiaohongshu.com/explore/')) {
        if (autoUploadConfig.enabled) {
          console.log('自动上传评论已启用，设置笔记页面监听器');
          setupNotePageObserver();
        } else {
          console.log('自动上传评论已禁用，清除现有监听器');
          // 如果有监听器，可以在这里清除
          if (window.notePageObserver) {
            window.notePageObserver.disconnect();
            window.notePageObserver = null;
            console.log('笔记页面监听器已清除');
          }
        }
      } else {
        console.log('当前不在笔记页面，URL:', window.location.href);
      }
      
      // 在页面上显示提示
      if (window.xhsUtils && window.xhsUtils.toastManager) {
        if (autoUploadConfig.enabled) {
          window.xhsUtils.toastManager.info('已启用自动上传评论功能');
        } else {
          window.xhsUtils.toastManager.info('已禁用自动上传评论功能');
        }
      }
    }
  });
}

// 等待所有模块加载完毕
function waitForModulesAndInitialize() {
  if (areAllModulesLoaded()) {
    console.log('所有模块已加载，开始初始化...');
    loadAutoUploadConfig();
    initializePage();
  } else {
    console.log('等待模块加载...');
    setTimeout(waitForModulesAndInitialize, 100);
  }
}

// 当前页面URL，用于检测变化
let currentPageUrl = window.location.href;

// 在页面加载完成后初始化
window.addEventListener('load', () => {
  console.log('页面加载完成，等待所有模块加载...');
  waitForModulesAndInitialize();
});

// 监听URL变化 - 使用定时器检查
setInterval(() => {
  const newUrl = window.location.href;
  if (newUrl !== currentPageUrl) {
    console.log(`检测到URL变化: ${currentPageUrl} -> ${newUrl}`);
    currentPageUrl = newUrl;
    
    // 等待一段时间让页面完全加载
    setTimeout(() => {
      console.log('URL变化后，重新初始化页面功能...');
      if (areAllModulesLoaded()) {
        initializePage();
      } else {
        waitForModulesAndInitialize();
      }
    }, 1000);
  }
}, 500);

// 初始化页面
function initializePage() {
  console.log('正在初始化页面，当前URL:', window.location.href);
  
  // 确保配置已加载
  if (!autoUploadConfig.isInitialized) {
    console.log('配置尚未初始化，先加载配置...');
    loadAutoUploadConfig();
  }
  
  if (window.location.href.includes('xiaohongshu.com/notification')) {
    console.log('检测到小红书通知页面，开始初始化功能');
    // 先初始化用户备注数据
    window.xhsApiService.initializeUserNotes().then(() => {
      // 然后添加按钮和备注输入框
      console.log('初始化用户备注完成，添加按钮...');
      window.xhsNotificationHandler.addButtonsToNotifications();
    }).catch(error => {
      console.error('初始化用户备注失败:', error);
    });
    
    // 设置DOM变化监听器
    setupDOMObserver();
  } else if (window.location.href.includes('xiaohongshu.com/explore/')) {
    console.log('检测到小红书笔记页面，设置自动上传评论监听');
    // 设置笔记页面观察器，用于自动上传评论
    setupNotePageObserver();
  } else {
    console.log('未识别的页面类型，URL:', window.location.href);
  }
}

// 检查是否应该触发自动上传评论
function shouldTriggerAutoUpload() {
  // 检查功能是否启用
  if (!autoUploadConfig.enabled || !autoUploadConfig.isInitialized) {
    console.log('自动上传评论未启用或配置尚未初始化，当前状态:', {
      enabled: autoUploadConfig.enabled,
      isInitialized: autoUploadConfig.isInitialized
    });
    return false;
  }
  
  // 检查冷却时间
  const now = Date.now();
  if (now - autoUploadConfig.lastTriggerTime < autoUploadConfig.cooldownPeriod) {
    console.log('自动上传评论冷却中，跳过此次触发, 剩余冷却时间:', 
      (autoUploadConfig.cooldownPeriod - (now - autoUploadConfig.lastTriggerTime)) / 1000, '秒');
    return false;
  }
  
  console.log('自动上传评论检查通过，可以触发');
  return true;
}

// 设置笔记页面观察器，监控noteContainer元素的出现
function setupNotePageObserver() {
  console.log('调用setupNotePageObserver函数, 当前URL:', window.location.href);
  console.log('当前自动上传配置状态:', JSON.stringify(autoUploadConfig));
  
  // 如果自动上传评论功能未启用，则不设置监听器
  if (!autoUploadConfig.enabled) {
    console.log('自动上传评论功能未启用，跳过设置笔记页面监听器');
    return;
  }
  
  console.log('设置笔记页面观察器，用于自动上传评论');
  
  // 如果已经有观察器了，先断开
  if (window.notePageObserver) {
    console.log('检测到已存在的观察器，断开连接');
    window.notePageObserver.disconnect();
  }

  // 需要观察的选择器列表，按优先级排序
  const POSSIBLE_SELECTORS = [
    '#noteContainer',               // 原始选择器
    '.comment-container',           // 可能的评论容器
    '.comments-container',          // 另一种评论容器
    '.note-container',              // 笔记容器 
    '.note-content',                // 笔记内容
    '.comments-wrapper',            // 评论包装器
    '.comment-list-container',      // 评论列表容器
    '.feed-comments'                // 动态评论
  ];
  
  // 检查所有可能的评论容器元素
  let foundContainer = null;
  let foundSelector = '';
  
  for (const selector of POSSIBLE_SELECTORS) {
    const element = document.querySelector(selector);
    if (element) {
      foundContainer = element;
      foundSelector = selector;
      console.log(`找到可能的评论容器: ${selector}`, element);
      break;
    }
  }
  
  if (foundContainer) {
    console.log(`页面加载时已存在评论容器 ${foundSelector}，尝试触发自动上传`);
    triggerAutoUploadComments();
  } else {
    console.log('页面上未找到任何可能的评论容器，将等待DOM变化');
  }
  
  // 设置DOM变化监听器
  const observer = new MutationObserver((mutations) => {
    console.log('DOM变化检测 - 突变数:', mutations.length, '当前URL:', window.location.href);
    
    // 记录重要的DOM变化
    mutations.forEach((mutation, index) => {
      if (index < 3) { // 限制日志数量
        if (mutation.type === 'childList') {
          console.log(`突变[${index}] - 添加节点:`, mutation.addedNodes.length, 
                     '删除节点:', mutation.removedNodes.length);
          
          // 检查新添加的节点是否包含我们感兴趣的容器
          if (mutation.addedNodes.length > 0) {
            for (const addedNode of mutation.addedNodes) {
              if (addedNode.nodeType === Node.ELEMENT_NODE) {
                // 检查添加的节点本身是否是我们要找的容器
                for (const selector of POSSIBLE_SELECTORS) {
                  if (addedNode.matches && addedNode.matches(selector)) {
                    console.log(`突变中直接添加了感兴趣的容器: ${selector}`);
                    triggerAutoUploadComments();
                    return;
                  }
                  
                  // 检查添加的节点内部是否包含我们要找的容器
                  const containerInside = addedNode.querySelector && addedNode.querySelector(POSSIBLE_SELECTORS.join(','));
                  if (containerInside) {
                    console.log(`突变中添加的节点包含感兴趣的容器: ${containerInside.tagName}`);
                    triggerAutoUploadComments();
                    return;
                  }
                }
              }
            }
          }
        }
      }
    });
    
    if (!window.location.href.includes('xiaohongshu.com/explore/')) {
      console.log('URL不匹配xiaohongshu.com/explore/，跳过处理');
      return;
    }
    
    if (!autoUploadConfig.enabled) {
      console.log('自动上传评论功能已禁用，跳过处理');
      return; // 再次检查是否启用
    }
    
    // 检查所有可能的选择器
    for (const selector of POSSIBLE_SELECTORS) {
      const element = document.querySelector(selector);
      if (element) {
        console.log(`DOM变化后检测到元素: ${selector}`);
        triggerAutoUploadComments();
        return; // 找到一个就立即返回
      }
    }
    
    // 如果没有找到任何预定义的选择器，尝试其他可能的选择器
    const possibleContainers = document.querySelectorAll('.comment, .comments, .feed-comment, [class*="comment"]');
    console.log('未找到预定义容器，尝试其他可能的评论相关元素:', possibleContainers.length);
    if (possibleContainers.length > 0) {
      console.log('找到可能的评论相关元素:', Array.from(possibleContainers).slice(0, 3).map(el => el.className).join(', '));
      // 如果找到了评论相关元素，考虑触发上传
      if (possibleContainers.length > 5) { // 设定一个阈值，避免误判
        console.log('评论相关元素数量超过阈值，尝试触发上传');
        triggerAutoUploadComments();
      }
    }
  });

  // 启动观察器
  console.log('启动笔记页面DOM观察器，观察整个body');
  observer.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
  
  // 保存观察器引用，以便之后可以停止
  window.notePageObserver = observer;
  console.log('观察器引用已保存到window.notePageObserver');
}

// 设置DOM变化监听器
function setupDOMObserver() {
  console.log('设置DOM变化监听器');
  
  // 如果已存在观察器，先断开连接
  if (window.globalDOMObserver) {
    console.log('清除已存在的全局DOM观察器');
    window.globalDOMObserver.disconnect();
  }
  
  const observer = new MutationObserver((mutations) => {
    // 检查当前是否仍在通知页面
    if (!window.location.href.includes('xiaohongshu.com/notification')) {
      console.log('页面已不再是通知页面，停止通知页DOM监控');
      observer.disconnect();
      return;
    }
    
    if (window.location.href.includes('xiaohongshu.com/notification')) {
      // 延迟执行以确保DOM完全更新
      setTimeout(() => {
        // 获取所有容器
        const allContainers = document.querySelectorAll('.tabs-content-container .container');
        // 检查无按钮或无备注输入框的容器
        const containersNeedProcess = Array.from(allContainers).filter(container => 
          !container.querySelector('.xhs-plugin-action-btn') || !container.querySelector('.xhs-note-input')
        );
        
        if (containersNeedProcess.length > 0) {
          console.log(`全局Observer检测到 ${containersNeedProcess.length} 个需处理的容器`);
          window.xhsNotificationHandler.addButtonsToNotifications();
        }
      }, 100);
    }
  });

  // 启动观察器
  console.log('启动全局DOM观察器');
  observer.observe(document.body, { 
    childList: true, 
    subtree: true 
  });
  
  // 保存观察器引用以便后续管理
  window.globalDOMObserver = observer;
}

// 监听storage变化，实时更新自动上传配置
chrome.storage.onChanged.addListener(function(changes, namespace) {
  if (namespace === 'local' && changes.autoUploadComments) {
    const oldValue = autoUploadConfig.enabled;
    autoUploadConfig.enabled = changes.autoUploadComments.newValue === true;
    console.log('自动上传评论配置已更新:', autoUploadConfig.enabled, '(原值:', oldValue, ')');
    
    // 配置发生变化时，重新初始化页面监听
    if (oldValue !== autoUploadConfig.enabled) {
      if (window.location.href.includes('xiaohongshu.com/explore/')) {
        if (autoUploadConfig.enabled) {
          console.log('自动上传评论已启用，设置笔记页面监听器');
          setupNotePageObserver();
        } else {
          console.log('自动上传评论已禁用，清除现有监听器');
          if (window.notePageObserver) {
            window.notePageObserver.disconnect();
            window.notePageObserver = null;
            console.log('笔记页面监听器已清除');
          }
        }
      }
      
      // 在页面上显示提示
      if (window.xhsUtils && window.xhsUtils.toastManager) {
        if (autoUploadConfig.enabled) {
          window.xhsUtils.toastManager.info('已启用自动上传评论功能');
        } else {
          window.xhsUtils.toastManager.info('已禁用自动上传评论功能');
        }
      }
    }
  }
});

// 也可以直接尝试初始化，但要确保所有模块已加载
setTimeout(() => {
  waitForModulesAndInitialize();
}, 500);

// 触发自动上传评论
function triggerAutoUploadComments() {
  console.log('进入triggerAutoUploadComments函数, 当前配置:', {
    enabled: autoUploadConfig.enabled,
    lastTrigger: new Date(autoUploadConfig.lastTriggerTime).toLocaleString(),
    cooldown: autoUploadConfig.cooldownPeriod / 1000 + '秒',
    url: window.location.href
  });
  
  if (!shouldTriggerAutoUpload()) return;
  
  console.log('自动触发上传评论操作 - 时间:', new Date().toLocaleString());
  // 更新最后触发时间
  autoUploadConfig.lastTriggerTime = Date.now();
  
  // 直接获取当前页面上的评论数据，发送上传请求
  try {
    console.log('正在获取当前页面评论数据，URL:', window.location.href);
    
    // 显示页面上的提示
    if (window.xhsUtils && window.xhsUtils.toastManager) {
      window.xhsUtils.toastManager.info('检测到评论数据，正在自动上传...');
    }
    
    // 向popup发送消息，触发上传评论操作
    chrome.runtime.sendMessage({
      action: 'uploadComments',
      url: window.location.href,
      timestamp: Date.now()
    }, function(response) {
      console.log('发送uploadComments消息，响应:', response);
      
      if (chrome.runtime.lastError) {
        console.error('发送触发上传评论消息失败:', chrome.runtime.lastError);
        
        // 显示错误提示
        if (window.xhsUtils && window.xhsUtils.toastManager) {
          window.xhsUtils.toastManager.error('自动上传失败: ' + chrome.runtime.lastError.message);
        }
        
        // 可能popup未打开，尝试直接注入脚本
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          console.log('查询当前标签页:', tabs);
          
          if (tabs.length > 0) {
            const currentTab = tabs[0];
            console.log('尝试在标签页执行脚本:', currentTab.id);
            
            // 尝试执行获取评论的逻辑
            chrome.scripting.executeScript({
              target: {tabId: currentTab.id},
              function: function() {
                // 显示提示
                if (window.xhsUtils && window.xhsUtils.toastManager) {
                  window.xhsUtils.toastManager.info('已自动触发评论获取，请点击扩展图标查看');
                }
                // 这里无法直接访问popup脚本中的函数，需要通过消息重试
                console.log('发送retryUploadComments消息');
                chrome.runtime.sendMessage({
                  action: 'retryUploadComments',
                  url: window.location.href,
                  tabId: chrome.runtime.id,
                  timestamp: Date.now()
                });
              }
            }).then(results => {
              console.log('脚本执行结果:', results);
            }).catch(err => {
              console.error('脚本执行错误:', err);
              
              // 最后尝试通过页面提示用户手动操作
              if (window.xhsUtils && window.xhsUtils.toastManager) {
                window.xhsUtils.toastManager.warning('自动上传失败，请点击扩展图标手动获取评论');
              }
            });
          }
        });
      } else {
        console.log('发送触发上传评论消息成功:', response);
        
        // 显示成功提示
        if (window.xhsUtils && window.xhsUtils.toastManager) {
          window.xhsUtils.toastManager.success('自动上传评论请求已发送');
        }
      }
    });
  } catch (error) {
    console.error('自动上传评论出错:', error);
    
    // 显示错误提示
    if (window.xhsUtils && window.xhsUtils.toastManager) {
      window.xhsUtils.toastManager.error('自动上传评论失败，请手动点击扩展图标: ' + error.message);
    }
  }
} 