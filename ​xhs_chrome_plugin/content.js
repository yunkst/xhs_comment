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
  // 获取笔记内容
  else if (request.action === 'getNoteContent') {
    // 检查当前是否在小红书笔记页面
    if (window.location.href.includes('xiaohongshu.com/explore/')) {
      // 从页面DOM中提取笔记内容
      const noteContent = extractNoteContentFromDOM();
      sendResponse({success: true, data: noteContent});
    } else {
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

// 从页面DOM中提取笔记内容
function extractNoteContentFromDOM() {
  try {
    // 提取笔记ID
    let noteId = null;
    
    // 优先从URL中提取
    const urlMatch = window.location.href.match(/\/explore\/([^/?]+)/);
    if (urlMatch && urlMatch[1]) {
      noteId = urlMatch[1];
      console.log(`从URL中提取到笔记ID: ${noteId}`);
    } else {
      // 尝试从页面元素中提取
      const noteElement = document.querySelector('[note-id], #noteContainer, .note-detail'); 
      if (noteElement && noteElement.getAttribute('note-id')) {
        noteId = noteElement.getAttribute('note-id');
        console.log(`从元素属性中提取到笔记ID: ${noteId}`);
      } else {
        console.warn("无法从页面中提取笔记ID");
      }
    }
    
    // 提取笔记标题和内容 - 更新标题选择器
    const titleElement = document.querySelector('#detail-title, .title, [id="detail-title"]');
    const descElement = document.querySelector('#detail-desc, .desc .note-text');
    
    // 提取作者信息
    const authorElement = document.querySelector('.author-wrapper .info .name');
    const authorId = authorElement ? extractUserIdFromAuthorLink(authorElement.href) : null;
    
    // 提取发布时间
    const dateElement = document.querySelector('.bottom-container .date, .date');
    const publishTime = dateElement ? dateElement.textContent.trim() : '';
    
    // 提取交互数据（点赞数、评论数）- 更新点赞选择器
    let likeCount = 0;
    // 尝试多种可能的选择器来获取点赞数
    const likeSelectors = [
      '.engage-bar-container .like-wrapper .count',
      '.engage-bar .left .like-wrapper .count',
      '.engage-bar .buttons .left .like-wrapper .count',
      '.like-active .count',
      '.xg-v2-collect [data-type="like"] .count',
      '.like-wrapper .count',
      '[class*="like-wrapper"] .count'
    ];
    
    for (const selector of likeSelectors) {
      const likeElement = document.querySelector(selector);
      if (likeElement) {
        likeCount = parseInteractionCount(likeElement.textContent.trim());
        console.log(`通过选择器 ${selector} 获取到点赞数: ${likeCount}`);
        break;
      }
    }
    
    let commentCount = 0;
    const commentsElement = document.querySelector('.comments-container .total, .comments-container .comment-title .count');
    if (commentsElement) {
      const commentText = commentsElement.textContent.trim();
      const commentMatch = commentText.match(/共\s*(\d+)\s*条评论/);
      if (commentMatch && commentMatch[1]) {
        commentCount = parseInt(commentMatch[1], 10);
      }
    }
    
    // 构建笔记内容对象
    const noteContent = {
      noteId: noteId,
      noteContent: descElement ? extractTextContentWithTags(descElement) : '',
      noteLike: likeCount,
      noteCommitCount: commentCount,
      publishTime: publishTime,
      authorId: authorId,
      title: titleElement ? titleElement.textContent.trim() : ''
    };
    
    console.log('提取的笔记内容:', noteContent);
    return noteContent;
  } catch (error) {
    console.error('提取笔记内容出错:', error);
    return null;
  }
}

// 从作者链接中提取用户ID
function extractUserIdFromAuthorLink(url) {
  if (!url) return null;
  
  try {
    const match = url.match(/\/user\/profile\/([^/?]+)/);
    return match ? match[1] : null;
  } catch (error) {
    console.error('从作者链接提取ID出错:', error);
    return null;
  }
}

// 解析交互数量（处理单位 如"1.2k"）
function parseInteractionCount(countText) {
  if (!countText) return 0;
  
  try {
    if (countText.includes('k') || countText.includes('K')) {
      return Math.round(parseFloat(countText.replace(/[kK]/g, '')) * 1000);
    } else if (countText.includes('w') || countText.includes('W')) {
      return Math.round(parseFloat(countText.replace(/[wW]/g, '')) * 10000);
    } else {
      return parseInt(countText, 10) || 0;
    }
  } catch (error) {
    console.error('解析交互数量出错:', error);
    return 0;
  }
}

// 提取包含标签的文本内容
function extractTextContentWithTags(element) {
  if (!element) return '';
  
  try {
    // 克隆节点以避免修改原始DOM
    const clone = element.cloneNode(true);
    
    // 处理emoji图片
    const emojiImgs = clone.querySelectorAll('img.note-content-emoji');
    emojiImgs.forEach(img => {
      img.replaceWith('[emoji]');
    });
    
    // 提取标签文本
    const tags = Array.from(clone.querySelectorAll('.tag')).map(tag => tag.textContent.trim());
    
    // 获取主要文本内容
    const mainText = clone.textContent.trim();
    
    return mainText;
  } catch (error) {
    console.error('提取文本内容出错:', error);
    return '';
  }
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