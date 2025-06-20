/**
 * 对话框管理模块 - 处理历史评论弹窗的显示和管理
 */

// 全局变量，用于跟踪当前弹框状态
let currentDialogElement = null;
let currentDialogContent = null;
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

// 显示通知弹出框
function showNotificationDialog(index) {
    console.log(`[Dialog Manager] 开始显示第 ${index+1} 个通知的弹出框`);
    
    // 检查是否已有弹框存在
    if (currentDialogElement && currentDialogContent) {
        console.log('[Dialog Manager] 已有弹框存在，更新内容');
        
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
        background-color: #333;
        padding: 12px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #444;
        cursor: move;
        user-select: none;
    `;
    
    // 拖拽功能
    const mouseMoveHandler = (e) => {
        if (isDragging) {
            dialog.style.left = (e.clientX - dragOffsetX) + 'px';
            dialog.style.top = (e.clientY - dragOffsetY) + 'px';
            dialog.style.right = 'auto';
            dialog.style.transform = 'none';
        }
    };
    
    const mouseUpHandler = () => {
        if (isDragging) {
            isDragging = false;
            dialog.style.cursor = 'default';
            dialog.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.5)';
        }
    };
    
    header.addEventListener('mousedown', (e) => {
        isDragging = true;
        dragOffsetX = e.clientX - dialog.getBoundingClientRect().left;
        dragOffsetY = e.clientY - dialog.getBoundingClientRect().top;
        dialog.style.cursor = 'grabbing';
        dialog.style.boxShadow = '0 8px 30px rgba(0, 0, 0, 0.7)';
    });
    
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
        console.log('[Dialog Manager] 点击关闭按钮');
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
    
    // 显示弹出框
    document.body.appendChild(dialog);
    
    // 保存引用
    currentDialogElement = dialog;
    currentDialogContent = content;
    
    // 加载内容
    loadDialogContent(index, content);
}

// 加载弹框内容
function loadDialogContent(index, content) {
    // 获取当前通知的用户ID
    try {
        // 使用和其他函数相同的选择器逻辑
        let containers = document.querySelectorAll('.tabs-content-container .container');
        
        if (containers.length === 0) {
            containers = document.querySelectorAll('[class*="notification"] [class*="item"]') ||
                        document.querySelectorAll('[class*="notification"] [class*="container"]') ||
                        document.querySelectorAll('[class*="message"] [class*="item"]') ||
                        document.querySelectorAll('[class*="tabs"] [class*="container"]') ||
                        document.querySelectorAll('.container');
        }
        
        const container = containers[index];
        if (!container) {
            content.innerHTML = '<p style="color: white;">无法获取用户信息</p>';
            return;
        }
        
        // 尝试获取用户链接中的用户ID（使用扩展的选择器）
        const userLink = container.querySelector('a[href*="/user/profile/"]') || 
                         container.querySelector('a[href*="/u/"]') ||
                         container.querySelector('.user-info a') ||
                         container.querySelector('[class*="user"] a') ||
                         container.querySelector('[class*="author"] a');
        
        if (!userLink) {
            content.innerHTML = '<p style="color: white;">无法获取用户链接</p>';
            return;
        }
        
        const userUrl = userLink.href;
        const userId = extractUserIdFromUrl(userUrl);
        
        if (!userId) {
            content.innerHTML = '<p style="color: white;">无法从链接中提取用户ID</p>';
            return;
        }
        
        console.log(`[Dialog Manager] 获取到用户ID: ${userId}`);
        
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
                console.error('[Dialog Manager] 获取历史评论时出错:', error);
                
                // 根据错误类型显示不同的错误信息
                let errorHtml;
                if (error.message.includes('登录已过期')) {
                    errorHtml = `
                        <div style="color: white; padding: 20px; text-align: center;">
                            <h4 style="color: #ff2442; margin-bottom: 15px;">🔒 登录已过期</h4>
                            <p style="margin-bottom: 15px; font-size: 16px;">您的登录令牌已过期，请重新登录</p>
                            <div style="background-color: #2a2a2a; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                                <p style="margin-bottom: 10px;"><strong>解决方案：</strong></p>
                                <ol style="margin-left: 20px; line-height: 1.8; text-align: left;">
                                    <li>点击插件图标</li>
                                    <li>点击"🔐 单点登录 (SSO)"按钮</li>
                                    <li>在新打开的页面中完成登录</li>
                                    <li>刷新此页面重试</li>
                                </ol>
                            </div>
                            <p style="color: #aaa; font-size: 12px;">
                                如果问题持续存在，请联系管理员
                            </p>
                        </div>
                    `;
                } else if (error.message.includes('未配置')) {
                    errorHtml = `
                        <div style="color: white; padding: 20px; text-align: center;">
                            <h4 style="color: #ff9500; margin-bottom: 15px;">⚙️ 配置未完成</h4>
                            <p style="margin-bottom: 15px; font-size: 16px;">插件尚未配置完成</p>
                            <div style="background-color: #2a2a2a; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                                <p style="margin-bottom: 10px;"><strong>请完成以下配置：</strong></p>
                                <ol style="margin-left: 20px; line-height: 1.8; text-align: left;">
                                    <li>右键点击插件图标，选择"选项"</li>
                                    <li>输入正确的API服务器地址</li>
                                    <li>点击"单点登录 (SSO)"完成登录</li>
                                    <li>刷新此页面重试</li>
                                </ol>
                            </div>
                        </div>
                    `;
                } else {
                    // 其他错误的通用处理
                    errorHtml = `
                        <div style="color: white; padding: 20px;">
                            <h4 style="color: #ff2442; margin-bottom: 10px;">❌ 获取历史评论失败</h4>
                            <p style="margin-bottom: 10px;"><strong>用户ID:</strong> ${userId}</p>
                            <p style="margin-bottom: 10px;"><strong>错误信息:</strong> ${error.message}</p>
                            <p style="margin-bottom: 10px;"><strong>可能原因:</strong></p>
                            <ul style="margin-left: 20px; line-height: 1.6;">
                                <li>网络连接问题</li>
                                <li>后端服务暂时不可用</li>
                                <li>用户数据不存在</li>
                                <li>服务器内部错误</li>
                            </ul>
                            <p style="margin-top: 15px;">
                                <small>请稍后重试，或查看浏览器控制台获取更多调试信息</small>
                            </p>
                        </div>
                    `;
                }
                content.innerHTML = errorHtml;
            });
    } catch (error) {
        console.error('[Dialog Manager] 处理历史评论时出错:', error);
        content.innerHTML = `<p style="color: white;">处理历史评论时出错: ${error.message}</p>`;
    }
    
    console.log(`[Dialog Manager] 显示第 ${index+1} 个通知的弹出框内容完成`);
}

// 从URL中提取用户ID
function extractUserIdFromUrl(url) {
    try {
        // 小红书用户页面URL格式：https://www.xiaohongshu.com/user/profile/xxxx
        const match = url.match(/\/user\/profile\/([a-zA-Z0-9]+)/);
        if (match && match[1]) {
            return match[1];
        }
        
        // 其他可能的URL格式
        const match2 = url.match(/\/u\/([a-zA-Z0-9]+)/);
        if (match2 && match2[1]) {
            return match2[1];
        }
        
        return null;
    } catch (error) {
        console.error('[Dialog Manager] 解析用户ID时出错:', error);
        return null;
    }
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
    console.log('[Dialog Manager] 历史评论数据:', historicalComments);
    
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
        
        console.log(`[Dialog Manager] 笔记${noteIndex+1}的评论数量:`, noteData.comments.length);
        
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
    commentElem.className = 'xhs-plugin-comment-item';
    commentElem.style.cssText = `
        margin-bottom: 8px;
        border-left: 3px solid #444;
        padding-left: 10px;
        font-size: 13px;
    `;
    
    // 格式化评论时间
    let timeDisplay = '未知时间';
    if (comment.time) {
        try {
            const commentDate = new Date(comment.time);
            timeDisplay = commentDate.toLocaleString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            timeDisplay = comment.time;
        }
    }
    
    // 用户名显示
    const userNameDisplay = comment.userName || comment.userId || '匿名用户';
    
    commentElem.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: #ff2442; font-weight: bold;">${userNameDisplay}</span>
            <span style="color: #888; font-size: 11px;">${timeDisplay}</span>
        </div>
        <div style="color: #ccc; line-height: 1.4;">${comment.content || '无内容'}</div>
    `;
    
    return commentElem;
}

// 导出对话框管理器
window.xhsDialogManager = {
    showNotificationDialog,
    loadDialogContent,
    renderHistoricalComments,
    createCommentElement
};

export { showNotificationDialog, loadDialogContent, renderHistoricalComments, createCommentElement }; 