// 监听来自popup的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  // 获取通知数据
  if (request.action === 'getNotifications') {
    // 检查当前是否在小红书通知页面
    if (window.location.href.includes('xiaohongshu.com/notification')) {
      // 从页面DOM中提取通知数据
      const notifications = extractNotificationsFromDOM();
      sendResponse({success: true, data: notifications});
    } else {
      // 如果不在通知页面，则返回重定向信息
      sendResponse({
        success: false, 
        error: '请先打开小红书通知页面',
        redirectUrl: 'https://www.xiaohongshu.com/notification'
      });
    }
    return true;
  }
});

// 从页面DOM中提取通知数据
function extractNotificationsFromDOM() {
  const notifications = [];
  
  // 获取当前激活的标签类型
  const activeTabType = getActiveTabType();
  
  // 获取所有通知容器
  const containerElements = document.querySelectorAll('.tabs-content-container .container');
  
  // 判断是否有数据
  if (containerElements.length === 0) {
    console.log('未找到通知数据，可能页面结构已变化或无数据');
  }
  
  // 遍历每个通知容器
  containerElements.forEach((container, index) => {
    try {
      // 提取用户信息
      const userLink = container.querySelector('.user-info a');
      const userName = userLink ? userLink.textContent.trim() : '';
      const userUrl = userLink ? userLink.href : '';
      const userId = extractUserIdFromUrl(userUrl);
      const userAvatar = container.querySelector('.user-avatar img')?.src || '';
      const userTag = container.querySelector('.user-tag')?.textContent.trim() || '';
      
      // 提取交互信息
      const interactionType = container.querySelector('.interaction-hint span:first-child')?.textContent.trim() || '';
      const interactionTime = container.querySelector('.interaction-hint .interaction-time')?.textContent.trim() || '';
      
      // 提取内容
      const content = extractTextContent(container.querySelector('.interaction-content'));
      
      // 提取引用内容（如果有）
      const quoteInfo = extractTextContent(container.querySelector('.quote-info'));
      
      // 提取图片信息
      const extraImage = container.querySelector('.extra img')?.src || '';
      
      // 获取笔记信息（如果有）
      const noteInfo = extractNoteInfo(extraImage);
      
      // 构建通知对象
      const notification = {
        id: index.toString(), // 使用索引作为ID
        tabType: activeTabType, // 标签类型
        userInfo: {
          id: userId,
          name: userName,
          avatar: userAvatar,
          url: userUrl,
          tag: userTag
        },
        interaction: {
          type: interactionType,
          time: interactionTime
        },
        content: content,
        quoteContent: quoteInfo,
        noteInfo: noteInfo,
        extraImage: extraImage
      };
      
      notifications.push(notification);
    } catch (error) {
      console.error('提取通知数据出错:', error);
    }
  });
  
  return notifications;
}

// 获取当前激活的标签类型
function getActiveTabType() {
  const activeTab = document.querySelector('.reds-tabs-list .reds-tab-item.active');
  return activeTab ? activeTab.textContent.trim() : '未知';
}

// 从URL中提取用户ID
function extractUserIdFromUrl(url) {
  if (!url) return '';
  
  try {
    const match = url.match(/\/profile\/([^?]+)/);
    return match ? match[1] : '';
  } catch (error) {
    return '';
  }
}

// 从图片URL中提取笔记信息
function extractNoteInfo(imageUrl) {
  // 如果没有图片URL，返回空对象
  if (!imageUrl) return {};
  
  // 尝试从URL中提取笔记ID等信息
  try {
    // 这里是一个示例，实际提取逻辑可能需要根据小红书的具体URL格式调整
    const noteIdMatch = imageUrl.match(/\/([^\/]+)$/);
    const noteId = noteIdMatch ? noteIdMatch[1] : '';
    
    return {
      id: noteId,
      url: '' // 由于图片URL不一定包含笔记URL，可能需要其他方式获取
    };
  } catch (error) {
    return {};
  }
}

// 提取元素的文本内容（包括emoji）
function extractTextContent(element) {
  if (!element) return '';
  
  // 克隆节点以避免修改原始DOM
  const clone = element.cloneNode(true);
  
  // 处理emoji图片
  const emojiImgs = clone.querySelectorAll('img.note-content-emoji');
  emojiImgs.forEach(img => {
    // 替换emoji图片为[emoji]标记
    img.replaceWith('[emoji]');
  });
  
  return clone.textContent.trim();
}

// 导航到通知页面
function navigateToNotificationPage() {
  window.location.href = 'https://www.xiaohongshu.com/notification';
} 