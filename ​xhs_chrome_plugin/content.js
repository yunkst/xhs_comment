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
      const notifications = extractNotificationsFromDOM();
      console.log('提取到的通知数据:', notifications);
      // 添加红色按钮到通知列表
      addButtonsToNotifications();
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
      const noteContent = extractNoteContentFromDOM();
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

// 为通知列表添加红色按钮
function addButtonsToNotifications() {
  // 检查是否在通知页面
  if (!window.location.href.includes('xiaohongshu.com/notification')) {
    console.log('当前不在通知页面，不添加按钮');
    return;
  }
  
  console.log('准备为通知列表添加红色按钮');
  
  // 立即尝试添加按钮
  tryAddButtons();
  
  // 再延迟执行几次，确保DOM已完全加载
  setTimeout(tryAddButtons, 500);
  setTimeout(tryAddButtons, 1000);
  setTimeout(tryAddButtons, 2000);
}

// 尝试添加按钮的函数
function tryAddButtons() {
  // 获取所有通知容器
  const containers = document.querySelectorAll('.tabs-content-container .container');
  console.log(`找到 ${containers.length} 个通知容器`);
  
  // 检查是否已经添加过按钮
  if (document.querySelector('.xhs-plugin-action-btn')) {
    console.log('已经添加过按钮，不重复添加');
    return;
  }
  
  if (containers.length === 0) {
    console.log('未找到通知容器，可能DOM结构有变化或尚未加载完成');
    // 输出页面结构帮助调试
    console.log('页面结构:', document.body.innerHTML.substring(0, 500) + '...');
    return;
  }
  
  // 遍历每个通知容器，添加红色按钮
  containers.forEach((container, index) => {
    console.log(`为第 ${index+1} 个通知添加按钮`);
    // 创建按钮元素
    const button = document.createElement('div');
    button.className = 'xhs-plugin-action-btn';
    button.dataset.index = index;
    button.style.cssText = `
      width: auto;
      height: 28px;
      padding: 0 10px;
      border-radius: 14px;
      background-color: #ff2442;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      position: absolute;
      left: -100px;
      top: 50%;
      transform: translateY(-50%);
      cursor: pointer;
      z-index: 999;
      font-size: 12px;
      font-weight: bold;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    `;
    button.innerHTML = '历史评论';
    
    // 添加点击事件，显示弹出框
    button.addEventListener('click', (event) => {
      console.log(`点击了第 ${index+1} 个通知的按钮`);
      event.stopPropagation();
      showNotificationDialog(index);
    });
    
    // 确保容器是相对定位，这样按钮的绝对定位才能正确显示
    if (window.getComputedStyle(container).position === 'static') {
      console.log('设置容器为相对定位');
      container.style.position = 'relative';
    }
    
    // 将按钮添加到容器中
    container.appendChild(button);
    console.log(`第 ${index+1} 个按钮添加成功`);
  });
  
  // 添加样式
  if (!document.querySelector('style.xhs-plugin-style')) {
    console.log('添加插件样式');
    const style = document.createElement('style');
    style.className = 'xhs-plugin-style';
    style.textContent = `
      .xhs-plugin-action-btn:hover {
        opacity: 0.9;
        transform: translateY(-50%) scale(1.05);
        transition: all 0.2s ease;
      }
      
      .xhs-plugin-dialog {
        position: fixed;
        top: 50%;
        left: 20%;
        transform: translate(-50%, -50%);
        width: 500px;
        height: 80vh;
        background-color:rgba(129, 122, 122, 0.45);
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        z-index: 10000;
        display: flex;
        flex-direction: column;
      }
      
      .xhs-plugin-dialog-header {
        padding: 10px;
        border-bottom: 1px solid #eee;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .xhs-plugin-dialog-title {
        font-weight: bold;
      }
      
      .xhs-plugin-dialog-close {
        cursor: pointer;
        font-size: 20px;
      }
      
      .xhs-plugin-dialog-content {
        flex: 1;
        padding: 20px;
        overflow: auto;
      }
      
      .xhs-plugin-dialog-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 9999;
      }
    `;
    document.head.appendChild(style);
  }
  
  console.log('成功添加红色按钮到通知列表');
}

// 显示通知弹出框
function showNotificationDialog(index) {
  console.log(`开始显示第 ${index+1} 个通知的弹出框`);
  
  // 创建遮罩层
  const overlay = document.createElement('div');
  overlay.className = 'xhs-plugin-dialog-overlay';
  
  // 创建弹出框
  const dialog = document.createElement('div');
  dialog.className = 'xhs-plugin-dialog';
  
  // 创建弹出框头部
  const header = document.createElement('div');
  header.className = 'xhs-plugin-dialog-header';
  
  // 创建标题
  const title = document.createElement('div');
  title.className = 'xhs-plugin-dialog-title';
  title.textContent = '历史评论';
  
  // 创建关闭按钮
  const closeBtn = document.createElement('div');
  closeBtn.className = 'xhs-plugin-dialog-close';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => {
    console.log('点击关闭按钮');
    document.body.removeChild(overlay);
    document.body.removeChild(dialog);
  });
  
  // 创建内容区域
  const content = document.createElement('div');
  content.className = 'xhs-plugin-dialog-content';
  
  // 创建加载提示
  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'xhs-plugin-loading';
  loadingIndicator.textContent = '正在加载历史评论...';
  loadingIndicator.style.textAlign = 'center';
  loadingIndicator.style.padding = '20px';
  loadingIndicator.style.color = 'black';
  content.appendChild(loadingIndicator);
  
  // 组装弹出框
  header.appendChild(title);
  header.appendChild(closeBtn);
  dialog.appendChild(header);
  dialog.appendChild(content);
  
  // 添加到页面
  document.body.appendChild(overlay);
  document.body.appendChild(dialog);
  console.log('弹出框已添加到页面');
  
  // 点击遮罩层关闭弹出框
  overlay.addEventListener('click', () => {
    console.log('点击遮罩层');
    document.body.removeChild(overlay);
    document.body.removeChild(dialog);
  });
  
  // 获取当前通知的用户ID
  try {
    const container = document.querySelectorAll('.tabs-content-container .container')[index];
    if (!container) {
      content.innerHTML = '<p style="color: black;">无法获取用户信息</p>';
      return;
    }
    
    // 尝试获取用户链接中的用户ID
    const userLink = container.querySelector('.user-info a');
    if (!userLink) {
      content.innerHTML = '<p style="color: black;">无法获取用户链接</p>';
      return;
    }
    
    const userUrl = userLink.href;
    const userId = extractUserIdFromUrl(userUrl);
    
    if (!userId) {
      content.innerHTML = '<p style="color: black;">无法从链接中提取用户ID</p>';
      return;
    }
    
    console.log(`获取到用户ID: ${userId}`);
    
    // 从后端API获取历史评论数据
    fetchUserHistoricalComments(userId)
      .then(historicalComments => {
        if (!historicalComments || historicalComments.length === 0) {
          content.innerHTML = '<p style="color: black;">该用户没有历史评论</p>';
          return;
        }
        
        // 清除加载提示
        content.innerHTML = '';
        
        // 渲染历史评论树状图
        renderHistoricalComments(content, historicalComments);
      })
      .catch(error => {
        console.error('获取历史评论时出错:', error);
        content.innerHTML = `<p style="color: black;">获取历史评论失败: ${error.message}</p>`;
      });
  } catch (error) {
    console.error('处理历史评论时出错:', error);
    content.innerHTML = `<p style="color: black;">处理历史评论时出错: ${error.message}</p>`;
  }
  
  console.log(`显示第 ${index+1} 个通知的弹出框完成`);
}

// 从后端API获取用户历史评论
async function fetchUserHistoricalComments(userId) {
  try {
    console.log(`开始获取用户 ${userId} 的历史评论`);
    
    // 从storage获取API地址和令牌
    const { apiBaseUrl, apiToken } = await getApiConfig();
    
    if (!apiBaseUrl) {
      throw new Error('未配置API地址，请在插件选项中设置');
    }
    
    if (!apiToken) {
      throw new Error('未配置API令牌，请在插件选项中设置');
    }
    
    const url = `${apiBaseUrl}/api/user/${userId}/comments`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API请求失败 (${response.status}): ${errorText}`);
    }
    
    const data = await response.json();
    console.log(`成功获取到用户 ${userId} 的历史评论:`, data);
    return data;
  } catch (error) {
    console.error(`获取用户 ${userId} 的历史评论时出错:`, error);
    throw error;
  }
}

// 从storage获取API配置
function getApiConfig() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['apiBaseUrl', 'apiToken'], function(result) {
      if (chrome.runtime.lastError) {
        reject(new Error(`获取存储数据时出错: ${chrome.runtime.lastError.message}`));
        return;
      }
      
      // 默认API地址，如果未配置则使用默认值
      const apiBaseUrl = result.apiBaseUrl || 'http://localhost:8000';
      const apiToken = result.apiToken || '';
      
      resolve({ apiBaseUrl, apiToken });
    });
  });
}

// 渲染历史评论树状图
function renderHistoricalComments(container, historicalComments) {
  // 创建总容器
  const commentsContainer = document.createElement('div');
  commentsContainer.className = 'xhs-plugin-comments-container';
  commentsContainer.style.color = 'black';
  
  if (historicalComments.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.textContent = '没有历史评论';
    emptyMessage.style.color = 'black';
    emptyMessage.style.textAlign = 'center';
    emptyMessage.style.padding = '20px';
    commentsContainer.appendChild(emptyMessage);
    container.appendChild(commentsContainer);
    return;
  }
  
  // 先输出API返回的数据到控制台，方便调试
  console.log('历史评论数据:', historicalComments);
  
  // 按笔记分组渲染
  historicalComments.forEach((noteData, noteIndex) => {
    // 创建笔记容器
    const noteContainer = document.createElement('div');
    noteContainer.className = 'xhs-plugin-note-container';
    noteContainer.style.marginBottom = '15px';
    noteContainer.style.padding = '10px';
    noteContainer.style.border = '1px solid #eee';
    noteContainer.style.borderRadius = '8px';
    noteContainer.style.backgroundColor = '#f9f9f9';
    
    // 格式化发布时间
    let publishTimeDisplay = '未知时间';
    if (noteData.publishTime) {
      // 如果publishTime是ISO格式的日期字符串
      try {
        const publishDate = new Date(noteData.publishTime);
        publishTimeDisplay = publishDate.toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch (e) {
        // 如果解析失败，直接显示原始值
        publishTimeDisplay = noteData.publishTime;
      }
    }
    
    // 创建笔记标题
    const noteHeader = document.createElement('div');
    noteHeader.className = 'xhs-plugin-note-header';
    noteHeader.style.fontWeight = 'bold';
    noteHeader.style.padding = '5px 0';
    noteHeader.style.borderBottom = '1px solid #eee';
    noteHeader.style.marginBottom = '8px';
    noteHeader.style.color = 'black';
    noteHeader.innerHTML = `
      <div style="display: flex; justify-content: space-between;">
        <div>${noteIndex + 1}. ${noteData.title || '无标题笔记'}</div>
        <div style="font-size: 0.85em; font-weight: normal;">${publishTimeDisplay}</div>
      </div>
    `;
    noteContainer.appendChild(noteHeader);
    
    // 检查是否有comments数组
    if (!noteData.comments || !Array.isArray(noteData.comments) || noteData.comments.length === 0) {
      const noCommentsMsg = document.createElement('div');
      noCommentsMsg.textContent = '该笔记下没有评论';
      noCommentsMsg.style.color = 'black';
      noCommentsMsg.style.textAlign = 'center';
      noCommentsMsg.style.padding = '10px';
      noteContainer.appendChild(noCommentsMsg);
      commentsContainer.appendChild(noteContainer);
      return;
    }
    
    console.log(`笔记${noteIndex+1}的评论数量:`, noteData.comments.length);
    
    // 创建评论列表
    const commentsList = document.createElement('div');
    commentsList.className = 'xhs-plugin-comments-list';
    
    // 构建评论树结构
    const commentsMap = new Map(); // 所有评论的映射
    const rootComments = []; // 顶级评论（无回复对象或回复对象不在当前集合中）
    const replyMap = new Map(); // 回复关系映射
    
    // 第一遍扫描，建立评论映射
    noteData.comments.forEach(comment => {
      commentsMap.set(comment.commentId, comment);
    });
    
    // 第二遍扫描，建立回复关系
    noteData.comments.forEach(comment => {
      if (!comment.replyToCommentId || !commentsMap.has(comment.replyToCommentId)) {
        // 如果没有回复ID，或者回复的评论不在当前集合中，作为根评论
        rootComments.push(comment);
      } else {
        // 否则添加到回复映射中
        if (!replyMap.has(comment.replyToCommentId)) {
          replyMap.set(comment.replyToCommentId, []);
        }
        replyMap.get(comment.replyToCommentId).push(comment);
      }
    });
    
    // 递归渲染评论树
    function renderCommentTree(comment, level = 0) {
      const commentElem = createCommentElement(comment);
      commentElem.style.marginLeft = `${level * 20}px`;
      
      // 如果是目标用户的评论，添加背景色高亮
      if (comment.isTargetUser) {
        commentElem.style.backgroundColor = 'rgba(255, 36, 66, 0.05)';
        commentElem.style.borderRadius = '4px';
        commentElem.style.padding = '5px';
      }
      
      commentsList.appendChild(commentElem);
      
      // 渲染回复
      const replies = replyMap.get(comment.commentId) || [];
      replies.forEach(reply => {
        renderCommentTree(reply, level + 1);
      });
    }
    
    // 如果没有根评论（所有评论都是回复，但回复对象不在当前集合中）
    if (rootComments.length === 0 && noteData.comments.length > 0) {
      // 直接平铺所有评论
      noteData.comments.forEach(comment => {
        const commentElem = createCommentElement(comment);
        
        // 如果是目标用户的评论，添加背景色高亮
        if (comment.isTargetUser) {
          commentElem.style.backgroundColor = 'rgba(255, 36, 66, 0.05)';
          commentElem.style.borderRadius = '4px';
          commentElem.style.padding = '5px';
        }
        
        commentsList.appendChild(commentElem);
      });
    } else {
      // 渲染根评论及其回复
      rootComments.forEach(comment => {
        renderCommentTree(comment);
      });
    }
    
    noteContainer.appendChild(commentsList);
    commentsContainer.appendChild(noteContainer);
  });
  
  container.appendChild(commentsContainer);
}

// 创建单个评论元素
function createCommentElement(comment) {
  const commentElem = document.createElement('div');
  commentElem.className = 'xhs-plugin-comment';
  commentElem.style.padding = '5px 0';
  commentElem.style.marginBottom = '5px';
  commentElem.style.color = 'black';
  
  // 格式化评论时间
  let commentTimeDisplay = '';
  if (comment.time) {
    commentTimeDisplay = comment.time;
  }
  
  // 评论元数据行
  const metaRow = document.createElement('div');
  metaRow.style.display = 'flex';
  metaRow.style.justifyContent = 'space-between';
  metaRow.style.fontSize = '0.9em';
  metaRow.style.color = '#666';
  metaRow.innerHTML = `
    <div style="font-weight: bold; color: #333;">${comment.userName || '未知用户'}</div>
    <div>${commentTimeDisplay}</div>
  `;
  
  // 评论内容
  const contentRow = document.createElement('div');
  contentRow.style.margin = '3px 0';
  contentRow.style.wordBreak = 'break-word';
  contentRow.style.color = 'black';
  contentRow.textContent = comment.content || '无内容';
  
  commentElem.appendChild(metaRow);
  commentElem.appendChild(contentRow);
  
  return commentElem;
}

// 从页面DOM中提取通知数据
function extractNotificationsFromDOM() {
  console.log('开始从DOM提取通知数据');
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

// 在页面加载完成后检查是否在通知页面，如果是，则添加按钮
window.addEventListener('load', () => {
  console.log('页面加载完成，当前URL:', window.location.href);
  if (window.location.href.includes('xiaohongshu.com/notification')) {
    console.log('检测到通知页面，开始添加红色按钮');
    addButtonsToNotifications();
  }
});

// 直接执行一次检查，不等待load事件
console.log('直接检查当前页面:', window.location.href);
if (window.location.href.includes('xiaohongshu.com/notification')) {
  console.log('初始检测到通知页面，开始添加红色按钮');
  // 延迟执行以确保DOM已经渲染
  setTimeout(addButtonsToNotifications, 500);
}

// DOM 变化监听，处理页面动态加载的情况
console.log('设置DOM变化监听器');
const observer = new MutationObserver((mutations) => {
  console.log('检测到DOM变化，变化数量:', mutations.length);
  if (window.location.href.includes('xiaohongshu.com/notification')) {
    // 检查DOM变化是否包含新的通知容器
    const hasNewContainers = mutations.some(mutation => {
      return Array.from(mutation.addedNodes).some(node => {
        const isElement = node.nodeType === 1;
        const hasContainer = node.classList?.contains('container') || node.querySelector?.('.container');
        if (isElement && hasContainer) {
          console.log('检测到新的通知容器:', node);
          return true;
        }
        return false;
      });
    });
    
    if (hasNewContainers) {
      console.log('检测到新的通知容器，添加红色按钮');
      addButtonsToNotifications();
    }
  }
});

// 启动观察器
console.log('启动DOM观察器');
observer.observe(document.body, { 
  childList: true, 
  subtree: true 
}); 