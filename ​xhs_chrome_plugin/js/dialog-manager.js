// 对话框管理相关模块

// 全局变量，用于跟踪当前弹框状态
let currentDialogElement = null;
let currentDialogContent = null;
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

// 显示通知弹出框
function showNotificationDialog(index) {
  console.log(`开始显示第 ${index+1} 个通知的弹出框`);
  
  // 检查是否已有弹框存在
  if (currentDialogElement && currentDialogContent) {
    console.log('已有弹框存在，更新内容');
    
    // 清空内容区域
    currentDialogContent.innerHTML = '';
    
    // 创建新的加载提示
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'xhs-plugin-loading';
    loadingIndicator.textContent = '正在加载历史评论...';
    loadingIndicator.style.textAlign = 'center';
    loadingIndicator.style.padding = '20px';
    loadingIndicator.style.color = 'white';
    currentDialogContent.appendChild(loadingIndicator);
    
    // 直接加载新内容
    loadDialogContent(index, currentDialogContent);
    return;
  }
  
  // 创建新弹框
  // 创建弹出框
  const dialog = document.createElement('div');
  dialog.className = 'xhs-plugin-dialog';
  // 设置弹框的样式，使其悬浮在页面侧边
  dialog.style.cssText = `
    position: fixed;
    top: 50%;
    right: 5%;
    transform: translateY(-50%);
    width: 400px;
    max-width: 90vw;
    height: 80vh;
    max-height: 90vh;
    background-color: #222;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
    z-index: 999999;
    display: flex;
    flex-direction: column;
    color: white;
    overflow: hidden;
    transition: box-shadow 0.3s;
  `;
  
  // 创建弹出框头部
  const header = document.createElement('div');
  header.className = 'xhs-plugin-dialog-header';
  header.style.cssText = `
    padding: 12px 16px;
    border-bottom: 1px solid #333;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: #333;
    cursor: move;
    user-select: none;
  `;
  
  // 添加拖拽功能
  header.addEventListener('mousedown', (e) => {
    // 只在鼠标左键点击时启用拖拽
    if (e.button !== 0) return;
    
    // 开始拖拽
    isDragging = true;
    
    // 计算鼠标点击位置与弹窗左上角的偏移
    const rect = dialog.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    
    // 给弹框添加正在拖拽的样式
    dialog.style.boxShadow = '0 6px 30px rgba(0, 0, 0, 0.7)';
    dialog.style.transition = 'none';
    
    // 阻止默认行为和冒泡
    e.preventDefault();
    e.stopPropagation();
  });
  
  // 添加全局鼠标移动事件处理
  const mouseMoveHandler = (e) => {
    if (!isDragging) return;
    
    // 计算新位置
    const newX = e.clientX - dragOffsetX;
    const newY = e.clientY - dragOffsetY;
    
    // 应用新位置
    dialog.style.left = `${newX}px`;
    dialog.style.top = `${newY}px`;
    dialog.style.right = 'auto';
    dialog.style.transform = 'none';
    
    // 阻止默认行为和冒泡
    e.preventDefault();
    e.stopPropagation();
  };
  
  // 添加全局鼠标松开事件处理
  const mouseUpHandler = () => {
    if (!isDragging) return;
    
    // 结束拖拽
    isDragging = false;
    
    // 恢复弹框样式
    dialog.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.5)';
    dialog.style.transition = 'box-shadow 0.3s';
  };
  
  // 注册事件
  document.addEventListener('mousemove', mouseMoveHandler);
  document.addEventListener('mouseup', mouseUpHandler);
  
  // 在弹框关闭时移除事件监听器
  dialog.addEventListener('remove', () => {
    document.removeEventListener('mousemove', mouseMoveHandler);
    document.removeEventListener('mouseup', mouseUpHandler);
  });
  
  // 创建标题
  const title = document.createElement('div');
  title.className = 'xhs-plugin-dialog-title';
  title.textContent = '历史评论';
  title.style.cssText = `
    font-weight: bold;
    color: white;
    font-size: 16px;
  `;
  
  // 创建关闭按钮
  const closeBtn = document.createElement('div');
  closeBtn.className = 'xhs-plugin-dialog-close';
  closeBtn.textContent = '×';
  closeBtn.style.cssText = `
    cursor: pointer;
    font-size: 24px;
    color: #ccc;
    line-height: 1;
    padding: 0 5px;
    transition: color 0.2s;
  `;
  closeBtn.addEventListener('mouseenter', () => {
    closeBtn.style.color = 'white';
  });
  closeBtn.addEventListener('mouseleave', () => {
    closeBtn.style.color = '#ccc';
  });
  closeBtn.addEventListener('click', () => {
    console.log('点击关闭按钮');
    document.body.removeChild(dialog);
    
    // 移除事件监听器
    document.removeEventListener('mousemove', mouseMoveHandler);
    document.removeEventListener('mouseup', mouseUpHandler);
    
    // 清空全局变量
    currentDialogElement = null;
    currentDialogContent = null;
  });
  
  // 创建内容区域
  const content = document.createElement('div');
  content.className = 'xhs-plugin-dialog-content';
  content.style.cssText = `
    flex: 1;
    padding: 16px;
    overflow-y: auto;
    background-color: #222;
    color: white;
  `;
  
  // 创建加载提示
  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'xhs-plugin-loading';
  loadingIndicator.textContent = '正在加载历史评论...';
  loadingIndicator.style.textAlign = 'center';
  loadingIndicator.style.padding = '20px';
  loadingIndicator.style.color = 'white';
  content.appendChild(loadingIndicator);
  
  // 组装弹出框
  header.appendChild(title);
  header.appendChild(closeBtn);
  dialog.appendChild(header);
  dialog.appendChild(content);
  
  // 添加到页面
  document.body.appendChild(dialog);
  console.log('弹框已添加到页面');
  
  // 设置全局变量
  currentDialogElement = dialog;
  currentDialogContent = content;
  
  // 加载弹框内容
  loadDialogContent(index, content);
}

// 加载弹框内容
function loadDialogContent(index, content) {
  // 获取当前通知的用户ID
  try {
    const container = document.querySelectorAll('.tabs-content-container .container')[index];
    if (!container) {
      content.innerHTML = '<p style="color: white;">无法获取用户信息</p>';
      return;
    }
    
    // 尝试获取用户链接中的用户ID
    const userLink = container.querySelector('.user-info a');
    if (!userLink) {
      content.innerHTML = '<p style="color: white;">无法获取用户链接</p>';
      return;
    }
    
    const userUrl = userLink.href;
    const userId = window.xhsUtils.extractUserIdFromUrl(userUrl);
    
    if (!userId) {
      content.innerHTML = '<p style="color: white;">无法从链接中提取用户ID</p>';
      return;
    }
    
    console.log(`获取到用户ID: ${userId}`);
    
    // 从后端API获取历史评论数据
    window.xhsApiService.fetchUserHistoricalComments(userId)
      .then(historicalComments => {
        if (!historicalComments || historicalComments.length === 0) {
          content.innerHTML = '<p style="color: white;">该用户没有历史评论</p>';
          return;
        }
        
        // 清除加载提示
        content.innerHTML = '';
        
        // 渲染历史评论树状图
        renderHistoricalComments(content, historicalComments);
      })
      .catch(error => {
        console.error('获取历史评论时出错:', error);
        content.innerHTML = `<p style="color: white;">获取历史评论失败: ${error.message}</p>`;
      });
  } catch (error) {
    console.error('处理历史评论时出错:', error);
    content.innerHTML = `<p style="color: white;">处理历史评论时出错: ${error.message}</p>`;
  }
  
  console.log(`显示第 ${index+1} 个通知的弹出框内容完成`);
}

// 渲染历史评论树状图
function renderHistoricalComments(container, historicalComments) {
  // 创建总容器
  const commentsContainer = document.createElement('div');
  commentsContainer.className = 'xhs-plugin-comments-container';
  commentsContainer.style.cssText = `
    color: white;
    width: 100%;
    font-size: 14px;
  `;
  
  if (historicalComments.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.textContent = '没有历史评论';
    emptyMessage.style.cssText = `
      color: #ccc;
      text-align: center;
      padding: 20px 0;
      font-size: 15px;
    `;
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
    noteContainer.style.cssText = `
      margin-bottom: 15px;
      padding: 10px;
      border: 1px solid #333;
      border-radius: 8px;
      background-color: #2a2a2a;
    `;
    
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
    noteHeader.style.cssText = `
      font-weight: bold;
      padding: 5px 0;
      border-bottom: 1px solid #444;
      margin-bottom: 10px;
      color: white;
    `;
    noteHeader.innerHTML = `
      <div style="display: flex; justify-content: space-between;">
        <div>${noteIndex + 1}. ${noteData.title || '无标题笔记'}</div>
        <div style="font-size: 0.85em; font-weight: normal; color: #aaa;">${publishTimeDisplay}</div>
      </div>
    `;
    noteContainer.appendChild(noteHeader);
    
    // 检查是否有comments数组
    if (!noteData.comments || !Array.isArray(noteData.comments) || noteData.comments.length === 0) {
      const noCommentsMsg = document.createElement('div');
      noCommentsMsg.textContent = '该笔记下没有评论';
      noCommentsMsg.style.cssText = `
        color: #aaa;
        text-align: center;
        padding: 10px;
        font-style: italic;
      `;
      noteContainer.appendChild(noCommentsMsg);
      commentsContainer.appendChild(noteContainer);
      return;
    }
    
    console.log(`笔记${noteIndex+1}的评论数量:`, noteData.comments.length);
    
    // 创建评论列表
    const commentsList = document.createElement('div');
    commentsList.className = 'xhs-plugin-comments-list';
    commentsList.style.cssText = `
      margin-top: 5px;
    `;
    
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
        commentElem.style.backgroundColor = 'rgba(255, 36, 66, 0.2)';
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
          commentElem.style.backgroundColor = 'rgba(255, 36, 66, 0.2)';
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
  commentElem.style.cssText = `
    padding: 8px 0;
    margin-bottom: 8px;
    color: white;
    border-bottom: 1px dashed #3a3a3a;
  `;
  
  // 格式化评论时间
  let commentTimeDisplay = '';
  if (comment.time) {
    commentTimeDisplay = comment.time;
  }
  
  // 评论元数据行
  const metaRow = document.createElement('div');
  metaRow.style.cssText = `
    display: flex;
    justify-content: space-between;
    font-size: 0.9em;
    color: #aaa;
    margin-bottom: 4px;
  `;
  metaRow.innerHTML = `
    <div style="font-weight: bold; color: #ddd;">${comment.userName || '未知用户'}</div>
    <div style="color: #888; font-size: 0.9em;">${commentTimeDisplay}</div>
  `;
  
  // 评论内容
  const contentRow = document.createElement('div');
  contentRow.style.cssText = `
    margin: 4px 0;
    word-break: break-word;
    color: #eee;
    line-height: 1.4;
  `;
  contentRow.textContent = comment.content || '无内容';
  
  commentElem.appendChild(metaRow);
  commentElem.appendChild(contentRow);
  
  return commentElem;
}

// 导出函数
window.xhsDialogManager = {
  showNotificationDialog,
  loadDialogContent,
  renderHistoricalComments,
  createCommentElement
}; 