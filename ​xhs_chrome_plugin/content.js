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
});

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

// 等待所有模块加载完毕
function waitForModulesAndInitialize() {
  if (areAllModulesLoaded()) {
    console.log('所有模块已加载，开始初始化...');
    initializePage();
  } else {
    console.log('等待模块加载...');
    setTimeout(waitForModulesAndInitialize, 100);
  }
}

// 初始化页面
function initializePage() {
  console.log('正在初始化页面，当前URL:', window.location.href);
  
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
  }
}

// 设置DOM变化监听器
function setupDOMObserver() {
  console.log('设置DOM变化监听器');
  const observer = new MutationObserver((mutations) => {
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
}

// 在页面加载完成后初始化
window.addEventListener('load', () => {
  console.log('页面加载完成，等待所有模块加载...');
  waitForModulesAndInitialize();
});

// 也可以直接尝试初始化，但要确保所有模块已加载
setTimeout(() => {
  waitForModulesAndInitialize();
}, 500); 