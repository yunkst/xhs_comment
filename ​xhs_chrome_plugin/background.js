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

// 存储API配置，使background可以访问
let apiConfig = {
  host: '',
  token: '',
  autoUploadComments: false
};

// 加载API配置
function loadApiConfig() {
  chrome.storage.local.get(['apiBaseUrl', 'apiToken', 'autoUploadComments'], function(result) {
    apiConfig.host = result.apiBaseUrl || '';
    apiConfig.token = result.apiToken || '';
    apiConfig.autoUploadComments = result.autoUploadComments === true;
    
    console.log('background已加载API配置:', {
      hasHost: !!apiConfig.host,
      hasToken: !!apiConfig.token,
      autoUpload: apiConfig.autoUploadComments
    });
  });
}

// 初始化时加载API配置
loadApiConfig();

// 监听storage变化，更新API配置
chrome.storage.onChanged.addListener(function(changes, namespace) {
  if (namespace === 'local') {
    let needsUpdate = false;
    
    if (changes.apiBaseUrl) {
      apiConfig.host = changes.apiBaseUrl.newValue || '';
      needsUpdate = true;
    }
    
    if (changes.apiToken) {
      apiConfig.token = changes.apiToken.newValue || '';
      needsUpdate = true;
    }
    
    if (changes.autoUploadComments) {
      apiConfig.autoUploadComments = changes.autoUploadComments.newValue === true;
      needsUpdate = true;
    }
    
    if (needsUpdate) {
      console.log('background检测到API配置变化，已更新本地缓存');
    }
  }
});

// 检查popup是否打开
async function isPopupOpen() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({action: 'ping'}, response => {
      if (chrome.runtime.lastError) {
        // 如果有错误，popup可能没有打开
        resolve(false);
      } else {
        // 如果收到响应，popup打开了
        resolve(true);
      }
    });
    
    // 设置超时，如果短时间内没收到响应，认为popup未打开
    setTimeout(() => resolve(false), 100);
  });
}

// 直接从当前标签页提取评论数据
async function extractCommentsFromCurrentTab() {
  try {
    console.log('background尝试直接从当前标签页提取评论数据');
    
    // 查询当前活动标签页
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    if (!tabs || tabs.length === 0) {
      throw new Error('无法获取当前标签页');
    }
    
    const currentTab = tabs[0];
    
    // 检查URL是否匹配小红书笔记页面
    if (!currentTab.url.includes('xiaohongshu.com/explore/')) {
      throw new Error('当前页面不是小红书笔记页面');
    }
    
    console.log('当前标签页是小红书笔记页面，准备提取评论数据');
    
    // 同时获取笔记内容和评论数据，提高效率
    const [noteContentResults, commentResults] = await Promise.all([
      // 获取笔记内容
      chrome.scripting.executeScript({
        target: {tabId: currentTab.id},
        function: function() {
          try {
            // 从当前URL中提取笔记ID
            const urlMatch = window.location.href.match(/\/explore\/([^/?]+)/);
            let noteId = urlMatch ? urlMatch[1] : null;
            
            // 提取笔记内容
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
            
            return noteData;
            
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
          } catch (error) {
            console.error('提取笔记内容时出错:', error);
            return {error: error.message};
          }
        }
      }),
      
      // 提取评论数据
      chrome.scripting.executeScript({
        target: {tabId: currentTab.id},
        function: function() {
          try {
            // 从URL中提取笔记ID
            const urlMatch = window.location.href.match(/\/explore\/([^/?]+)/);
            const noteId = urlMatch ? urlMatch[1] : null;
            
            // 提取单个评论
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
                            const replyData = extractSingleComment(replyElement, true, currentNoteId);
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
            
            // 获取所有顶级评论
            const comments = [];
            const commentElements = document.querySelectorAll('.comments-container .parent-comment');
            
            if (commentElements.length === 0) {
              console.log("未找到顶级评论容器，尝试其他选择器");
              
              // 尝试其他可能的评论容器选择器
              const alternativeSelectors = [
                '.comment-list-wrapper .comment-item',
                '.feed-comments .comment',
                '[data-type="comments"] .comment-item'
              ];
              
              for (const selector of alternativeSelectors) {
                const altElements = document.querySelectorAll(selector);
                if (altElements.length > 0) {
                  console.log(`使用替代选择器 ${selector} 找到 ${altElements.length} 个评论`);
                  altElements.forEach((commentElement, index) => {
                    const extractedComment = extractSingleComment(commentElement, false, noteId);
                    if(extractedComment) {
                      if(!extractedComment.id) {
                        extractedComment.id = `comment-alt-${index}`;
                      }
                      comments.push(extractedComment);
                    }
                  });
                  break;
                }
              }
            } else {
              commentElements.forEach((commentElement, index) => {
                const extractedComment = extractSingleComment(commentElement, false, noteId);
                if(extractedComment) {
                  if(!extractedComment.id) {
                    extractedComment.id = `comment-parent-${index}`;
                  }
                  comments.push(extractedComment);
                }
              });
            }
            
            return {
              comments: comments,
              count: comments.length,
              timestamp: new Date().toISOString()
            };
          } catch (error) {
            console.error('提取评论数据时出错:', error);
            return {error: error.message};
          }
        }
      })
    ]);
    
    if (!noteContentResults || noteContentResults.length === 0 || !noteContentResults[0].result) {
      throw new Error('提取笔记内容失败');
    }
    
    if (!commentResults || commentResults.length === 0 || !commentResults[0].result) {
      throw new Error('提取评论数据失败');
    }
    
    const noteData = noteContentResults[0].result;
    const commentData = commentResults[0].result;
    
    if (noteData.error) {
      throw new Error('提取笔记内容时出错: ' + noteData.error);
    }
    
    if (commentData.error) {
      throw new Error('提取评论数据时出错: ' + commentData.error);
    }
    
    console.log('成功提取笔记内容和评论数据');
    
    // 准备数据并发送到服务器 - 无需显示多余的Toast提示
    if (apiConfig.host && apiConfig.token) {
      // 进行评论和笔记数据上传
      sendDataToApi(commentData.comments, '评论', noteData, currentTab.id);
    } else {
      console.log('未配置API或未登录，无法上传评论数据');
      
      // 向浏览器提示
      chrome.scripting.executeScript({
        target: {tabId: currentTab.id},
        function: function() {
          if (window.xhsUtils && window.xhsUtils.toastManager) {
            window.xhsUtils.toastManager.warning('未配置API或未登录，无法上传评论数据');
          }
        }
      });
    }
    
    return {
      success: true,
      comments: commentData.comments,
      note: noteData
    };
  } catch (error) {
    console.error('background提取评论数据失败:', error);
    
    // 尝试通知页面显示错误
    try {
      const tabs = await chrome.tabs.query({active: true, currentWindow: true});
      if (tabs && tabs.length > 0) {
        chrome.scripting.executeScript({
          target: {tabId: tabs[0].id},
          function: function(errorMessage) {
            if (window.xhsUtils && window.xhsUtils.toastManager) {
              window.xhsUtils.toastManager.error('自动提取评论失败: ' + errorMessage);
            }
          },
          args: [error.message]
        });
      }
    } catch (e) {
      console.error('无法显示错误提示:', e);
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

// 发送数据到API
async function sendDataToApi(commentData, dataTypeLabel, noteData, tabId) {
  try {
    console.log(`background准备发送${dataTypeLabel}数据到API`);
    
    if (!apiConfig.host || !apiConfig.token) {
      throw new Error('API配置不完整，无法发送数据');
    }
    
    // 选择正确的API端点
    let apiEndpoint;
    if (dataTypeLabel === '评论') {
      apiEndpoint = '/api/comments/data';
    } else if (dataTypeLabel === '笔记') {
      apiEndpoint = '/api/notes/data';
    } else {
      throw new Error(`不支持的数据类型: ${dataTypeLabel}`);
    }
    
    // 构建完整的API URL
    const apiUrl = apiConfig.host + apiEndpoint;
    
    // 准备发送的数据
    const payload = {
      type: dataTypeLabel,
      data: commentData
    };
    
    // 只在开始上传评论时显示一次提示，笔记数据上传无需额外提示
    if (dataTypeLabel === '评论') {
      // 在页面上显示上传中提示
      chrome.scripting.executeScript({
        target: {tabId: tabId},
        function: function() {
          if (window.xhsUtils && window.xhsUtils.toastManager) {
            window.xhsUtils.toastManager.info('正在自动上传评论数据...');
          }
        }
      });
    }
    
    // 发送请求
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiConfig.token}`
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`服务器返回错误状态: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log(`${dataTypeLabel}数据发送成功:`, result);
    
    // 只在评论和笔记都上传完成后显示一次成功提示
    if (dataTypeLabel === '评论' && noteData) {
      // 先不显示评论成功提示，等笔记也上传完再显示综合提示
      
      // 将笔记数据转为数组形式
      const noteDataArray = [noteData];
      
      // 发送笔记数据
      await sendDataToApi(noteDataArray, '笔记', null, tabId);
      
      // 笔记和评论都上传完成后显示一次成功提示
      chrome.scripting.executeScript({
        target: {tabId: tabId},
        function: function() {
          if (window.xhsUtils && window.xhsUtils.toastManager) {
            window.xhsUtils.toastManager.success('评论和笔记数据已成功上传');
          }
        }
      });
    } else if (dataTypeLabel === '评论' && !noteData) {
      // 只有评论没有笔记数据时显示提示
      chrome.scripting.executeScript({
        target: {tabId: tabId},
        function: function() {
          if (window.xhsUtils && window.xhsUtils.toastManager) {
            window.xhsUtils.toastManager.success('评论数据已成功上传');
          }
        }
      });
    }
    // 笔记数据单独上传成功无需显示提示
    
    return {
      success: true,
      result: result
    };
  } catch (error) {
    console.error(`发送${dataTypeLabel}数据出错:`, error);
    
    // 只有评论上传失败才显示错误提示
    if (dataTypeLabel === '评论') {
      chrome.scripting.executeScript({
        target: {tabId: tabId},
        function: function(errorMessage) {
          if (window.xhsUtils && window.xhsUtils.toastManager) {
            window.xhsUtils.toastManager.error(`数据上传失败: ${errorMessage}`);
          }
        },
        args: [error.message]
      });
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

// 处理来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('background.js收到消息:', message, '来源:', sender?.tab?.url || '非标签页');
  
  if (message.action === 'saveNotifications' && message.data) {
    // 保存通知数据到存储
    chrome.storage.local.set({ 
      notifications: message.data,
      lastUpdate: new Date().toISOString()
    }, function() {
      sendResponse({ success: true });
      console.log('已保存通知数据');
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
      console.log('已返回存储的通知数据');
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
            console.log('已完成代理请求(blob):', message.url);
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
          console.log('已完成代理请求:', message.url);
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

  // 处理ping消息，用于检查popup是否打开
  if (message.action === 'ping') {
    sendResponse({pong: true, timestamp: Date.now()});
    return false; // 同步响应
  }
  
  // 处理uploadComments消息
  if (message.action === 'uploadComments' || message.action === 'retryUploadComments') {
    console.log(`background收到${message.action}请求，正在处理...`);
    
    // 尝试异步处理评论上传
    (async () => {
      try {
        // 检查popup是否打开
        const popupIsOpen = await isPopupOpen();
        console.log('Popup是否打开:', popupIsOpen);
        
        if (popupIsOpen) {
          // 如果popup已打开，转发消息给popup处理
          console.log('Popup已打开，转发消息让popup处理');
          chrome.runtime.sendMessage(message, response => {
            console.log(`${message.action}消息转发结果:`, response || '无响应');
            sendResponse({success: true, forwarded: true, response: response});
          });
        } else {
          // 如果popup未打开，直接在background中处理
          console.log('Popup未打开，background直接处理上传评论请求');
          
          // 提取和上传评论
          const result = await extractCommentsFromCurrentTab();
          sendResponse({
            success: result.success,
            directlyProcessed: true,
            result: result
          });
        }
      } catch (error) {
        console.error('处理上传评论请求时出错:', error);
        sendResponse({
          success: false,
          error: error.message,
          directlyProcessed: true
        });
      }
    })();
    
    return true; // 异步响应
  }
  
  // 未处理的消息
  console.log('未处理的消息类型:', message.action);
  return false;
}); 