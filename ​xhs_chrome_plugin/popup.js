document.addEventListener('DOMContentLoaded', function() {
  // 获取DOM元素
  const getNotificationsButton = document.getElementById('getNotifications');
  const getCommentsButton = document.getElementById('getComments');
  const expandCommentsButton = document.getElementById('expandComments');
  const statusElement = document.getElementById('status');
  const modeInfoElement = document.getElementById('modeInfo');
  const openSettingsLink = document.getElementById('openSettings');
  
  // 存储获取到的数据
  let currentData = [];
  let apiConfig = {
    host: '',
    token: ''
  };
  
  // 加载API配置
  loadApiConfig();
  
  // 获取通知按钮点击事件
  getNotificationsButton.addEventListener('click', function() {
    handleDataFetch('notifications');
  });
  
  // 获取评论按钮点击事件
  getCommentsButton.addEventListener('click', function() {
    handleDataFetch('comments');
  });
  
  // 展开评论按钮点击事件
  expandCommentsButton.addEventListener('click', function() {
    handleExpandComments();
  });
  
  // 打开设置页面
  openSettingsLink.addEventListener('click', function(e) {
    e.preventDefault();
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  });
  
  // 处理数据获取请求
  function handleDataFetch(fetchType) {
    let targetUrlPattern, extractionFunction, dataTypeLabel;
    
    if (fetchType === 'notifications') {
      updateStatus('正在获取通知列表...', '');
      targetUrlPattern = 'xiaohongshu.com/notification';
      extractionFunction = extractNotificationsFromPage;
      dataTypeLabel = '通知';
    } else if (fetchType === 'comments') {
      updateStatus('正在获取推文评论...', '');
      targetUrlPattern = 'xiaohongshu.com/explore/';
      extractionFunction = extractCommentsFromPage;
      dataTypeLabel = '评论';
    } else {
      updateStatus('无效的数据类型', 'error');
      return;
    }
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs.length === 0) {
        updateStatus('无法获取当前标签页信息', 'error');
        return;
      }
      
      const currentTab = tabs[0];
      
      // 检查URL是否匹配
      if (!currentTab.url.includes(targetUrlPattern)) {
        const expectedPage = fetchType === 'notifications' ? '通知页面' : '笔记页面';
        const expectedUrl = fetchType === 'notifications'
          ? 'https://www.xiaohongshu.com/notification'
          : 'https://www.xiaohongshu.com/explore/... (任意笔记)';
        updateStatus(`请先打开小红书${expectedPage} (例如: ${expectedUrl})`, 'error');
        
        // 如果是获取通知，尝试跳转
        if (fetchType === 'notifications') {
          updateStatus(`正在跳转到小红书通知页面...`, '');
          chrome.tabs.update(currentTab.id, {
            url: 'https://www.xiaohongshu.com/notification'
          });
        }
        return;
      }
      
      // 特别提示：评论获取需要滚动加载
      if (fetchType === 'comments') {
         updateStatus('正在获取评论... 建议先展开所有评论。', '');
      }
      
      // 执行脚本获取数据
      chrome.scripting.executeScript({
        target: {tabId: currentTab.id},
        function: extractionFunction
      }).then(results => {
        if (!results || results.length === 0 || !results[0].result) {
          updateStatus(`获取${dataTypeLabel}失败: 无法从页面提取数据`, 'error');
          return;
        }
        
        currentData = results[0].result;
        
        if (currentData.length === 0) {
             updateStatus(`当前页面未找到${dataTypeLabel}数据。`, '');
             if(fetchType === 'comments') {
                updateStatus(`当前页面未找到评论。请先尝试展开所有评论。`, '');
             }
        } else {
            // 如果是评论数据，还需获取笔记内容
            if (fetchType === 'comments') {
                // 获取笔记内容
                chrome.scripting.executeScript({
                    target: {tabId: currentTab.id},
                    function: getNoteContent
                }).then(noteResults => {
                    if (noteResults && noteResults.length > 0 && noteResults[0].result) {
                        const noteData = noteResults[0].result;
                        console.log('获取到笔记内容:', noteData);
                        
                        // 处理合并的数据
                        processDataWithNote(currentData, noteData);
                    } else {
                        console.warn('获取笔记内容失败，仅处理评论数据');
                        processData(currentData, dataTypeLabel);
                    }
                }).catch(error => {
                    console.error('获取笔记内容时出错:', error);
                    updateStatus('获取笔记内容失败，仅处理评论数据', 'error');
                    processData(currentData, dataTypeLabel);
                });
            } else {
                // 处理数据（发送或下载）
                processData(currentData, dataTypeLabel);
            }
        }
      }).catch(error => {
        console.error(`执行${dataTypeLabel}提取脚本出错:`, error);
        updateStatus(`获取${dataTypeLabel}失败: ` + (error.message || '未知错误'), 'error');
      });
    });
  }
  
  // 处理展开评论请求
  function handleExpandComments() {
    updateStatus('正在尝试展开所有评论...', '');
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs.length === 0) {
        updateStatus('无法获取当前标签页信息', 'error');
        return;
      }
      const currentTab = tabs[0];

      if (!currentTab.url.includes('xiaohongshu.com/explore/')) {
        updateStatus('请先打开小红书笔记页面再执行此操作', 'error');
        return;
      }
      
      // 注入滚动和展开函数
      chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        function: expandCommentsAndReplies,
        args: [{ clickDelayBase: 500, clickDelayRandom: 200, maxScrollAttempts: 50, scrollCheckDelay: 1500, scrollTickDelayBase: 80, scrollTickDelayRandom: 120 }] // 传入延迟参数
      }).then(results => {
        if (chrome.runtime.lastError) {
           updateStatus('展开评论脚本注入失败: ' + chrome.runtime.lastError.message, 'error');
           return;
        }
        if (results && results[0] && results[0].result) {
          const result = results[0].result;
          if (result.success) {
             updateStatus(`评论展开完成。共展开 ${result.expandedCount} 个回复区域。`, 'success');
          } else {
             updateStatus(`评论展开失败: ${result.message}`, 'error');
          }
        } else {
          updateStatus('评论展开脚本未返回有效结果。', 'error');
        }
      }).catch(error => {
        console.error('执行展开评论脚本出错:', error);
        updateStatus('展开评论失败: ' + (error.message || '未知错误'), 'error');
      });
    });
  }
  
  // 加载API配置
  function loadApiConfig() {
    chrome.storage.sync.get(['apiHost', 'apiToken'], function(result) {
      apiConfig.host = result.apiHost || '';
      apiConfig.token = result.apiToken || '';
      
      updateModeInfo();
    });
  }
  
  // 更新模式信息
  function updateModeInfo() {
    if (apiConfig.host && apiConfig.token) {
      modeInfoElement.textContent = `数据将发送到: ${apiConfig.host}`;
    } else {
      modeInfoElement.textContent = '尚未配置API，将下载到本地';
    }
  }
  
  // 更新状态信息
  function updateStatus(message, type) {
    statusElement.textContent = message;
    statusElement.className = 'status ' + (type === 'error' ? 'error' : (type === 'success' ? 'success' : ''));
    // 如果正在进行中，可以考虑禁用按钮
    const buttons = document.querySelectorAll('button');
    if (!type) { // 假设空type表示进行中
        buttons.forEach(btn => btn.disabled = true);
    } else {
        buttons.forEach(btn => btn.disabled = false);
    }
  }
  
  // 处理数据（发送或下载）
  function processData(data, dataTypeLabel) {
    if (apiConfig.host && apiConfig.token) {
      sendDataToApi(data, dataTypeLabel);
    } else {
      downloadData(data, dataTypeLabel);
    }
  }
  
  // 处理带笔记内容的数据
  function processDataWithNote(commentsData, noteData) {
    if (!noteData) {
        // 笔记数据为空，只处理评论数据
        processData(commentsData, '评论');
        return;
    }
    
    // 发送评论数据
    processData(commentsData, '评论');
    
    // 处理笔记数据
    const noteDataArray = [noteData]; // 转为数组，以便API处理
    
    if (apiConfig.host && apiConfig.token) {
        // 发送笔记数据到API
        sendDataToApi(noteDataArray, '笔记');
    } else {
        // 下载笔记数据
        downloadData(noteDataArray, '笔记');
    }
  }
  
  // 发送数据到API
  function sendDataToApi(data, dataTypeLabel) {
    updateStatus(`正在将${dataTypeLabel}数据发送到服务器...`, '');
    
    // 准备要发送的数据
    const payload = {
      type: dataTypeLabel,
      data: data
    };
    
    // 发送请求
    fetch(apiConfig.host, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiConfig.token}`
      },
      body: JSON.stringify(payload)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`服务器返回错误状态: ${response.status} ${response.statusText}`);
      }
      return response.json();
    })
    .then(result => {
      console.log('数据发送成功:', result);
      updateStatus(`${dataTypeLabel}数据发送成功: ${result.message || '服务器已接收'}`, 'success');
    })
    .catch(error => {
      console.error('发送数据出错:', error);
      updateStatus(`发送${dataTypeLabel}数据失败: ${error.message || '未知错误'}`, 'error');
    });
  }
  
  // 下载数据
  function downloadData(data, dataTypeLabel) {
    updateStatus(`正在准备下载${dataTypeLabel}数据...`, '');
    
    // 创建要下载的数据内容
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // 创建并点击下载链接
    const timestamp = new Date().toISOString().replace(/[:.-]/g, '_');
    const filename = `xiaohongshu_${dataTypeLabel}_${timestamp}.json`;
    
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = filename;
    downloadLink.click();
    
    // 释放URL对象
    URL.revokeObjectURL(url);
    
    updateStatus(`${dataTypeLabel}数据已下载到本地`, 'success');
  }
});

// 获取笔记内容
function getNoteContent() {
  try {
    // 从当前URL中提取笔记ID
    const urlMatch = window.location.href.match(/\/explore\/([^/?]+)/);
    let noteId = urlMatch ? urlMatch[1] : null;
    
    // 提取笔记内容
    // 尝试从页面元素中获取笔记详细信息
    const titleElement = document.querySelector('#detail-title, .title');
    const descElement = document.querySelector('#detail-desc, .desc .note-text');
    
    // 提取作者信息
    const authorElement = document.querySelector('.author-wrapper .info .name');
    let authorId = null;
    if (authorElement && authorElement.href) {
      const authorMatch = authorElement.href.match(/\/user\/profile\/([^/?]+)/);
      authorId = authorMatch ? authorMatch[1] : null;
    }
    
    // 提取发布时间
    const dateElement = document.querySelector('.bottom-container .date, .date');
    const publishTime = dateElement ? dateElement.textContent.trim() : '';
    
    // 提取点赞数和评论数
    const likeElement = document.querySelector('.xg-v2-collect [data-type="like"] .count');
    const likeCount = likeElement ? extractInteractionCount(likeElement.textContent.trim()) : 0;
    
    const commentsElement = document.querySelector('.comments-container .total, .comments-container .comment-title .count');
    let commentCount = 0;
    if (commentsElement) {
      const commentText = commentsElement.textContent.trim();
      const commentMatch = commentText.match(/共\s*(\d+)\s*条评论/);
      if (commentMatch && commentMatch[1]) {
        commentCount = parseInt(commentMatch[1], 10);
      }
    }
    
    // 构建笔记数据对象
    const noteData = {
      noteId: noteId,
      noteContent: descElement ? extractNoteContent(descElement) : '',
      noteLike: likeCount,
      noteCommitCount: commentCount,
      publishTime: publishTime,
      authorId: authorId,
      title: titleElement ? titleElement.textContent.trim() : '',
      fetchTimestamp: new Date().toISOString()
    };
    
    console.log('提取的笔记内容:', noteData);
    return noteData;
  } catch (error) {
    console.error('提取笔记内容时出错:', error);
    return null;
  }
  
  // 提取交互数量
  function extractInteractionCount(text) {
    if (!text) return 0;
    
    try {
      if (text.includes('k') || text.includes('K')) {
        return Math.round(parseFloat(text.replace(/[kK]/, '')) * 1000);
      } else if (text.includes('w') || text.includes('W')) {
        return Math.round(parseFloat(text.replace(/[wW]/, '')) * 10000);
      } else {
        return parseInt(text, 10) || 0;
      }
    } catch (e) {
      return 0;
    }
  }
  
  // 提取笔记内容
  function extractNoteContent(element) {
    if (!element) return '';
    
    // 克隆节点以避免修改原始DOM
    const clone = element.cloneNode(true);
    
    // 处理emoji图片
    const emojiImgs = clone.querySelectorAll('img.note-content-emoji');
    emojiImgs.forEach(img => {
      img.replaceWith('[emoji]');
    });
    
    return clone.textContent.trim();
  }
}

// 提取通知函数
function extractNotificationsFromPage() {
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
        extraImage: extraImage,
        timestamp: new Date().toISOString() // 添加获取时间戳
      };
      
      notifications.push(notification);
    } catch (error) {
      console.error('提取通知数据出错:', error);
    }
  });
  
  return notifications;
}

// 提取评论函数 (根据实际HTML调整)
function extractCommentsFromPage() {
  let noteId = null;

  // --- 1. 提取笔记 ID ---
  try {
    // 优先尝试从 URL 提取
    const urlMatch = window.location.href.match(/\/explore\/([^/?]+)/);
    if (urlMatch && urlMatch[1]) {
      noteId = urlMatch[1];
      console.log(`从 URL 中提取到 Note ID: ${noteId}`);
    } else {
      // 如果 URL 提取失败，尝试查找 note-id 属性
      // 尝试几个可能的选择器
      const noteElement = document.querySelector('[note-id], #noteContainer, .note-detail'); 
      if (noteElement && noteElement.getAttribute('note-id')) {
          noteId = noteElement.getAttribute('note-id');
          console.log(`从 note-id 属性中提取到 Note ID: ${noteId}`);
      } else {
          console.warn("无法从 URL 或 note-id 属性中提取 Note ID。");
      }
    }
  } catch(e) {
      console.error("提取 Note ID 时出错:", e);
  }

  // --- 2. 内部辅助函数 ---
  function getElementText(element, selector) {
    const child = element?.querySelector(selector);
    return child ? child.textContent.trim() : '';
  }

  function getElementAttribute(element, selector, attribute) {
     const child = element?.querySelector(selector);
     return child ? child.getAttribute(attribute) : '';
  }

  function extractContentWithEmoji(element) {
    if (!element) return '';
    const clone = element.cloneNode(true);
    const emojiImgs = clone.querySelectorAll('img.note-content-emoji');
    emojiImgs.forEach(img => { img.replaceWith('[emoji]'); });
    const innerSpan = clone.querySelector('span');
    return (innerSpan || clone).textContent.trim();
  }

  // --- 3. 提取单个评论 ---
  function extractSingleComment(commentElement, isSubComment = false, currentNoteId) {
    if (!commentElement) return null;

    const container = isSubComment ? commentElement : commentElement.querySelector('.comment-item');
    if (!container) return null;

    try {
      let repliedToUser = null;
      let actualContent = '';

      const contentElement = container.querySelector('.content');
      if (contentElement) {
        const nicknameElement = contentElement.querySelector('span.nickname');
        const noteTextElement = contentElement.querySelector('span.note-text');

        if (nicknameElement && noteTextElement) {
          repliedToUser = nicknameElement.textContent.trim();
          actualContent = extractContentWithEmoji(noteTextElement);
        } else if (noteTextElement) {
          actualContent = extractContentWithEmoji(noteTextElement);
        } else {
           let fullContent = extractContentWithEmoji(contentElement);
           if(fullContent.startsWith('回复 ')) {
               fullContent = fullContent.substring(3).trim();
           }
           actualContent = fullContent;
        }
      }

      const commentData = {
          id: container.id || '',
          noteId: currentNoteId, // 添加笔记ID
          authorName: getElementText(container, '.author .name'),
          authorUrl: getElementAttribute(container, '.author .name', 'href'),
          authorAvatar: getElementAttribute(container, '.avatar img.avatar-item', 'src'),
          content: actualContent,
          repliedToUser: repliedToUser,
          timestamp: getElementText(container, '.info .date > span:first-child'),
          likeCount: getElementText(container, '.info .interactions .like .count') || '0',
          ipLocation: getElementText(container, '.info .date .location'),
          replies: []
      };

      if (!isSubComment) {
          const repliesContainer = commentElement.querySelector('.reply-container .list-container');
          if (repliesContainer) {
              const replyElements = repliesContainer.querySelectorAll(':scope > .comment-item-sub');
              replyElements.forEach(replyElement => {
                  const replyData = extractSingleComment(replyElement, true, currentNoteId); // 传递 noteId
                  if (replyData) {
                      commentData.replies.push(replyData);
                  }
              });
          }
      }
      return commentData;
    } catch (error) {
        console.error("提取评论时出错:", error, commentElement);
        return null;
    }
  }

  // --- 4. 主逻辑 ---
  const comments = [];
  const commentElements = document.querySelectorAll('.comments-container .parent-comment');

  if (commentElements.length === 0) {
    console.log("未找到顶级评论容器 (.parent-comment)。选择器可能需要更新或页面未加载评论。");
  }

  commentElements.forEach((commentElement, index) => {
    const extractedComment = extractSingleComment(commentElement, false, noteId); // 传递提取到的 noteId
    if(extractedComment) {
        if(!extractedComment.id) {
           extractedComment.id = `comment-parent-${index}`;
        }
        comments.push(extractedComment);
    }
  });

  console.log(`提取到 ${comments.length} 条顶级评论。`);
  return comments;
}

// 滚动并展开评论函数 (新增)
async function expandCommentsAndReplies(config) {
  // 增加延迟时间，降低频率
  const { clickDelayBase = 500, clickDelayRandom = 200, maxScrollAttempts = 50, scrollCheckDelay = 1500, scrollTickDelayBase = 80, scrollTickDelayRandom = 120 } = config || {};
  let expandedCount = 0;

  // --- 辅助函数：检查元素是否在视口内 ---
  function isElementInViewport(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  // --- 滚动函数 (模拟滚轮，更慢，增加结束标志判断) ---
  async function scrollToBottom() {
    const scrollContainer = document.querySelector('.note-scroller');
    if (!scrollContainer) {
      console.error("找不到评论滚动容器 (.note-scroller)");
      return { success: false, message: "找不到滚动容器" };
    }

    console.log('开始模拟滚动加载评论 (较慢模式)...');
    let lastHeight = 0;
    let scrollAttempts = 0;
    // 初始化 consecutiveSameHeight 计数器
    scrollContainer.dataset.consecutiveSameHeight = '0'; // 使用字符串

    while (scrollAttempts < maxScrollAttempts) {
      lastHeight = scrollContainer.scrollHeight;
      console.log(`开始第 ${scrollAttempts + 1}/${maxScrollAttempts} 次向下滚动尝试...`);

      let scrollPixelsRemaining = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight;
      let scrollThisAttempt = 0;

      while (scrollPixelsRemaining > 5) {
        const scrollAmount = Math.min(80 + Math.random() * 100, scrollPixelsRemaining);
        const scrollTickDelay = scrollTickDelayBase + Math.random() * scrollTickDelayRandom;

        scrollContainer.scrollTop += scrollAmount;
        scrollPixelsRemaining -= scrollAmount;
        scrollThisAttempt += scrollAmount;

        await new Promise(resolve => setTimeout(resolve, scrollTickDelay));

        if (Math.abs(scrollContainer.scrollHeight - lastHeight) > 500) {
           console.log("滚动中检测到高度剧烈变化，重新评估...");
           break;
        }

        if (scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 10 && scrollPixelsRemaining > 10) {
            console.warn("ScrollTop似乎卡在底部附近，跳出内部滚动循环。");
            break;
        }
      }

       if (scrollContainer.scrollTop + scrollContainer.clientHeight < scrollContainer.scrollHeight) {
           console.log("确保滚动到达绝对底部。");
           scrollContainer.scrollTop = scrollContainer.scrollHeight;
       }

      console.log(`第 ${scrollAttempts + 1} 次滚动尝试完成 (模拟滚动 ${scrollThisAttempt.toFixed(0)}px)，当前高度: ${scrollContainer.scrollHeight}`);

      // 等待潜在的内容加载和渲染
      await new Promise(resolve => setTimeout(resolve, scrollCheckDelay));

      // 检查结束标志是否可见
      const endMarker = document.querySelector('.comments-container .end-container');
      if (endMarker && isElementInViewport(endMarker)) {
          console.log('检测到".end-container"元素可见，判定到达底部。');
          break; // 到达底部，结束滚动
      }

      // 如果结束标志不可见，再检查高度变化
      const currentHeight = scrollContainer.scrollHeight;
      if (currentHeight <= lastHeight + 20) {
          console.log(`".end-container"不可见，且滚动高度未显著增加，尝试次数: ${scrollAttempts + 1}`);
          // 使用 dataset 存储计数器，避免全局变量
          let consecutiveSameHeight = parseInt(scrollContainer.dataset.consecutiveSameHeight || '0') + 1;
          scrollContainer.dataset.consecutiveSameHeight = consecutiveSameHeight.toString(); // 存储为字符串
          if (consecutiveSameHeight >= 3) {
               console.log('滚动高度连续未显著增加，判定加载完成。');
               break;
          }
      } else {
          scrollContainer.dataset.consecutiveSameHeight = '0'; // 高度变化，重置计数器
          console.log(`".end-container"不可见，但检测到新内容，高度增加到: ${currentHeight}`);
      }
      scrollAttempts++;
    }

    if (scrollAttempts >= maxScrollAttempts) {
      console.warn("达到最大滚动尝试次数，可能未加载完所有评论，或者'.end-container'未找到或始终不可见。");
    }
    console.log('评论滚动加载模拟完成。');
    // 清理计数器
    if(scrollContainer) delete scrollContainer.dataset.consecutiveSameHeight;
    return { success: true };
  }

  // --- 展开回复函数 (更慢) ---
  async function clickExpandButtons() {
    console.log('开始查找并展开回复 (较慢模式)...');
    let buttonsToClick = document.querySelectorAll('.comments-container .show-more');
    let totalClicked = 0;

    while(buttonsToClick.length > 0) {
        console.log(`发现 ${buttonsToClick.length} 个未展开的回复按钮。`);
        const button = buttonsToClick[0];
        try {
            console.log(`展开回复:`, button.innerText);
            button.scrollIntoView({ block: 'center', behavior: 'smooth' });
            await new Promise(resolve => setTimeout(resolve, 300));
            button.click();
            totalClicked++;
            expandedCount++;
            const currentClickDelay = clickDelayBase + Math.random() * clickDelayRandom;
            await new Promise(resolve => setTimeout(resolve, currentClickDelay));
        } catch (e) {
            console.error(`点击展开按钮时出错:`, e, button);
        }
        buttonsToClick = document.querySelectorAll('.comments-container .show-more');
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`完成展开操作，共点击了 ${totalClicked} 次展开按钮。`);
    return expandedCount;
  }

  // --- 主逻辑 ---
  try {
    const scrollResult = await scrollToBottom();
    if (scrollResult.success) {
      expandedCount = await clickExpandButtons();
      return { success: true, expandedCount: expandedCount };
    } else {
      return { success: false, message: scrollResult.message || '滚动加载评论失败' };
    }
  } catch (error) {
    console.error("展开评论和回复时发生错误:", error);
    return { success: false, message: error.message || '未知错误' };
  }
} 