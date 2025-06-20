/**
 * 通知处理模块 - 在小红书通知页面添加历史评论按钮
 */

// 存储通知数据的全局变量
let notificationsData = [];

// 从DOM中提取通知数据
function extractNotificationsFromDOM() {
    console.log('[Notification Handler] 开始从DOM中提取通知数据');
    
    const notifications = [];
    // 扩展选择器以兼容不同的页面结构
    let containers = document.querySelectorAll('.tabs-content-container .container');
    
    // 如果找不到，尝试其他可能的选择器
    if (containers.length === 0) {
        containers = document.querySelectorAll('[class*="notification"] [class*="item"]') ||
                    document.querySelectorAll('[class*="notification"] [class*="container"]') ||
                    document.querySelectorAll('[class*="message"] [class*="item"]') ||
                    document.querySelectorAll('[class*="tabs"] [class*="container"]') ||
                    document.querySelectorAll('.container');
    }
    
    console.log(`[Notification Handler] 找到 ${containers.length} 个通知容器`);
    
    containers.forEach((container, index) => {
        try {
            // 提取用户信息
            const userInfo = extractUserInfo(container);
            
            // 提取通知内容
            const content = extractNotificationContent(container);
            
            // 提取时间信息
            const timeInfo = extractTimeInfo(container);
            
            // 构建通知对象
            const notification = {
                index: index,
                userInfo: userInfo,
                content: content,
                time: timeInfo,
                element: container
            };
            
            notifications.push(notification);
            console.log(`[Notification Handler] 通知 ${index}:`, notification);
        } catch (error) {
            console.error(`[Notification Handler] 提取通知 ${index} 数据时出错:`, error);
        }
    });
    
    // 更新全局通知数据
    notificationsData = notifications;
    
    console.log(`[Notification Handler] 成功提取 ${notifications.length} 条通知数据`);
    return notifications;
}

// 提取用户信息
function extractUserInfo(container) {
    const userInfo = {};
    
    // 查找用户链接（扩展选择器范围）
    const userLink = container.querySelector('a[href*="/user/profile/"]') || 
                    container.querySelector('a[href*="/u/"]') ||
                    container.querySelector('.user-info a') ||
                    container.querySelector('[class*="user"] a') ||
                    container.querySelector('[class*="author"] a');
    
    if (userLink) {
        userInfo.url = userLink.href;
        userInfo.id = extractUserIdFromUrl(userLink.href);
    }
    
    // 查找用户名（扩展选择器范围）
    const userNameElement = container.querySelector('.user-info .name') || 
                           container.querySelector('.username') ||
                           container.querySelector('[class*="name"]') ||
                           container.querySelector('[class*="user"] [class*="name"]') ||
                           container.querySelector('[class*="author"] [class*="name"]') ||
                           userLink; // 如果其他都找不到，尝试用链接的文本
    
    if (userNameElement) {
        userInfo.name = userNameElement.textContent.trim();
    }
    
    // 查找用户头像（扩展选择器范围）
    const avatarElement = container.querySelector('.user-info img') || 
                         container.querySelector('img[src*="avatar"]') ||
                         container.querySelector('img[alt*="头像"]') ||
                         container.querySelector('[class*="user"] img') ||
                         container.querySelector('[class*="author"] img') ||
                         container.querySelector('img[src*="profile"]');
    
    if (avatarElement) {
        userInfo.avatar = avatarElement.src;
    }
    
    return userInfo;
}

// 提取通知内容
function extractNotificationContent(container) {
    const contentElements = container.querySelectorAll('.content, .message, [class*="content"]');
    const content = [];
    
    contentElements.forEach(element => {
        const text = element.textContent.trim();
        if (text) {
            content.push(text);
        }
    });
    
    return content.join(' ');
}

// 提取时间信息
function extractTimeInfo(container) {
    const timeElement = container.querySelector('.time') || 
                       container.querySelector('[class*="time"]') ||
                       container.querySelector('[title*="时间"]');
    
    if (timeElement) {
        return timeElement.textContent.trim();
    }
    
    return null;
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
        console.error('[Notification Handler] 解析用户ID时出错:', error);
        return null;
    }
}

// 添加历史评论按钮到通知列表
function addButtonsToNotifications() {
    console.log('[Notification Handler] 开始添加历史评论按钮到通知列表');
    
    // 首先提取通知数据
    extractNotificationsFromDOM();
    
    // 内部函数：为容器添加按钮和备注输入框
    function addButtonsToContainers(containers) {
        if (!containers || containers.length === 0) {
            console.log('[Notification Handler] 没有找到容器');
            return;
        }
        
        console.log(`[Notification Handler] 为 ${containers.length} 个容器添加按钮和备注输入框`);
        
        // 收集新的用户ID，以便批量获取他们的备注
        const newUserIds = new Set();
        notificationsData.forEach(notification => {
            const userId = notification.userInfo?.id;
            if (userId && window.xhsApiService && window.xhsApiService.userNotes && 
                !window.xhsApiService.userNotes.hasOwnProperty('_loaded_user_' + userId)) {
                newUserIds.add(userId);
                // 标记这个用户ID已经被处理，避免重复请求
                window.xhsApiService.userNotes['_loaded_user_' + userId] = true;
            }
        });
        
        // 如果有新用户，批量获取他们的备注
        if (newUserIds.size > 0) {
            console.log(`[Notification Handler] 发现 ${newUserIds.size} 个新用户，批量获取他们的备注`);
            // 异步获取所有用户的备注，不阻塞UI
            (async function() {
                try {
                    if (window.xhsApiService && window.xhsApiService.fetchUserNotesInBatch) {
                        const userIdsArray = Array.from(newUserIds);
                        await window.xhsApiService.fetchUserNotesInBatch(userIdsArray);
                    }
                } catch(error) {
                    console.error(`[Notification Handler] 批量获取用户备注失败:`, error);
                }
            })();
        }
        
        containers.forEach((container, index) => {
            // 检查容器是否已经有按钮
            if (container.querySelector('.xhs-plugin-action-btn')) {
                console.log(`[Notification Handler] 容器 ${index} 已有按钮，跳过按钮添加`);
            } else {
                console.log(`[Notification Handler] 为通知 ${index} 添加按钮`);
                // 创建按钮元素
                const button = document.createElement('div');
                button.className = 'xhs-plugin-action-btn';
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
                    transition: all 0.3s ease;
                `;
                button.innerHTML = '历史评论';
                
                // 添加悬停效果
                button.addEventListener('mouseenter', () => {
                    button.style.backgroundColor = '#e6213d';
                    button.style.transform = 'translateY(-50%) scale(1.05)';
                });
                
                button.addEventListener('mouseleave', () => {
                    button.style.backgroundColor = '#ff2442';
                    button.style.transform = 'translateY(-50%) scale(1)';
                });
                
                // 添加点击事件，显示弹出框
                button.addEventListener('click', (event) => {
                    console.log(`[Notification Handler] 点击了通知按钮 ${index}`);
                    event.stopPropagation();
                    // 从DOM层次结构找到这个容器的索引
                    const allContainers = Array.from(document.querySelectorAll('.tabs-content-container .container'));
                    const containerIndex = allContainers.indexOf(container);
                    console.log(`[Notification Handler] 容器索引: ${containerIndex}`);
                    
                    // 调用对话框管理器显示弹窗
                    if (window.xhsDialogManager) {
                        window.xhsDialogManager.showNotificationDialog(containerIndex);
                    } else {
                        console.error('[Notification Handler] 对话框管理器未初始化');
                    }
                });
                
                // 确保容器是相对定位，这样按钮的绝对定位才能正确显示
                if (window.getComputedStyle(container).position === 'static') {
                    console.log(`[Notification Handler] 设置容器 ${index} 为相对定位`);
                    container.style.position = 'relative';
                }
                
                // 为容器添加额外的右侧内边距，避免内容被按钮和备注输入框遮挡
                container.style.paddingRight = '300px'; // 增加右侧内边距以容纳备注输入框
                
                // 将按钮添加到容器中
                container.appendChild(button);
                console.log(`[Notification Handler] 按钮 ${index} 添加成功`);
            }
            
            // 添加备注输入框
            if (notificationsData[index]) {
                const notification = notificationsData[index];
                const userId = notification.userInfo?.id;
                
                if (userId) {
                    // 检查容器是否已经有备注输入框
                    if (!container.querySelector('.xhs-note-input')) {
                        console.log(`[Notification Handler] 为通知 ${index} 添加备注输入框`);
                        if (window.xhsUserNotes && window.xhsUserNotes.addNoteInputToContainer) {
                            window.xhsUserNotes.addNoteInputToContainer(container, userId, notification);
                        } else {
                            console.warn('[Notification Handler] 用户备注模块未初始化');
                        }
                    } else {
                        // 更新已存在的备注输入框
                        if (window.xhsUserNotes && window.xhsUserNotes.updateExistingNoteInput) {
                            window.xhsUserNotes.updateExistingNoteInput(container, userId, notification);
                        }
                    }
                } else {
                    console.warn(`[Notification Handler] 通知 ${index} 缺少用户ID，无法添加备注输入框`);
                }
            }
        });
        
        console.log(`[Notification Handler] 完成按钮和备注输入框添加，共处理 ${containers.length} 个容器`);
    }
    
    // 初始添加按钮
    const initialContainers = document.querySelectorAll('.tabs-content-container .container');
    console.log(`[Notification Handler] 初始化时发现 ${initialContainers.length} 个容器`);
    addButtonsToContainers(initialContainers);
    
    // 设置DOM变化监听器
    const observer = new MutationObserver((mutations) => {
        // 检查是否有新的通知容器被添加
        const newContainers = document.querySelectorAll('.tabs-content-container .container');
        console.log(`[Notification Handler] Observer检测到变化, 当前有 ${newContainers.length} 个容器`);
        
        // 添加检查以确定是否有无按钮的容器
        const containersWithoutButtons = Array.from(newContainers).filter(container => 
            !container.querySelector('.xhs-plugin-action-btn')
        );
        
        if (containersWithoutButtons.length > 0) {
            console.log(`[Notification Handler] 发现 ${containersWithoutButtons.length} 个无按钮的容器，添加按钮`);
            addButtonsToContainers(newContainers);
        }
    });
    
    // 开始监听DOM变化
    const tabsContentContainer = document.querySelector('.tabs-content-container');
    if (tabsContentContainer) {
        observer.observe(tabsContentContainer, { 
            childList: true, // 监听子节点变化
            subtree: true,   // 监听所有后代节点变化
            attributes: false
        });
        console.log('[Notification Handler] 已设置DOM监听器，将自动为新通知添加按钮');
        
        // 每秒检查一次是否有新的通知容器
        const intervalId = setInterval(() => {
            const allContainers = document.querySelectorAll('.tabs-content-container .container');
            const containersWithoutButtons = Array.from(allContainers).filter(container => 
                !container.querySelector('.xhs-plugin-action-btn')
            );
            
            if (containersWithoutButtons.length > 0) {
                console.log(`[Notification Handler] 定时检查: 发现 ${containersWithoutButtons.length} 个无按钮的容器，添加按钮`);
                addButtonsToContainers(allContainers);
            }
        }, 1000);
        
        // 监听滚动事件，滚动后检查是否需要添加按钮
        window.addEventListener('scroll', () => {
            console.log('[Notification Handler] 页面滚动，检查是否有新容器');
            // 防抖，滚动结束后再检查
            clearTimeout(window.scrollTimer);
            window.scrollTimer = setTimeout(() => {
                const allContainers = document.querySelectorAll('.tabs-content-container .container');
                console.log(`[Notification Handler] 滚动后检查: 当前有 ${allContainers.length} 个容器`);
                addButtonsToContainers(allContainers);
            }, 300);
        });
        
        // 添加样式
        addNotificationStyles();
    } else {
        console.warn('[Notification Handler] 未找到通知容器，可能页面结构已变化');
    }
    
    console.log('[Notification Handler] 成功添加历史评论按钮到通知列表');
}

// 添加通知相关样式
function addNotificationStyles() {
    // 如果样式已存在，则不重复添加
    if (document.getElementById('xhs-plugin-notification-styles')) return;
    
    // 创建样式元素
    const styleElement = document.createElement('style');
    styleElement.id = 'xhs-plugin-notification-styles';
    
    // 定义CSS样式
    styleElement.textContent = `
        /* 历史评论按钮样式 */
        .xhs-plugin-action-btn {
            transition: all 0.3s ease !important;
        }
        
        .xhs-plugin-action-btn:hover {
            transform: translateY(-50%) scale(1.05) !important;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3) !important;
        }
        
        .xhs-plugin-action-btn:active {
            transform: translateY(-50%) scale(0.95) !important;
        }
        
        /* 对话框样式 */
        .xhs-plugin-dialog {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .xhs-plugin-dialog-header {
            backdrop-filter: blur(10px);
        }
        
        .xhs-plugin-dialog-content::-webkit-scrollbar {
            width: 8px;
        }
        
        .xhs-plugin-dialog-content::-webkit-scrollbar-track {
            background: #333;
            border-radius: 4px;
        }
        
        .xhs-plugin-dialog-content::-webkit-scrollbar-thumb {
            background: #666;
            border-radius: 4px;
        }
        
        .xhs-plugin-dialog-content::-webkit-scrollbar-thumb:hover {
            background: #888;
        }
        
        /* 评论样式 */
        .xhs-plugin-comment-item {
            transition: all 0.2s ease;
        }
        
        .xhs-plugin-comment-item:hover {
            background-color: rgba(255, 255, 255, 0.05) !important;
            border-radius: 4px;
        }
        
        /* 加载动画 */
        .xhs-plugin-loading {
            position: relative;
        }
        
        .xhs-plugin-loading::after {
            content: '';
            position: absolute;
            width: 20px;
            height: 20px;
            margin: auto;
            border: 2px solid transparent;
            border-top-color: #ff2442;
            border-radius: 50%;
            animation: xhs-loading-spin 1s linear infinite;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
        }
        
        @keyframes xhs-loading-spin {
            0% { transform: translate(-50%, -50%) rotate(0deg); }
            100% { transform: translate(-50%, -50%) rotate(360deg); }
        }
    `;
    
    // 添加到文档头部
    document.head.appendChild(styleElement);
    console.log('[Notification Handler] 已添加通知样式');
}

// 获取当前激活的标签类型
function getActiveTabType() {
    const activeTab = document.querySelector('.reds-tabs-list .reds-tab-item.active');
    return activeTab ? activeTab.textContent.trim() : '未知';
}

// 跳转到通知页面
function navigateToNotificationPage() {
    if (!window.location.href.includes('xiaohongshu.com/notification')) {
        console.log('[Notification Handler] 跳转到小红书通知页面');
        window.location.href = 'https://www.xiaohongshu.com/notification';
        return true;
    }
    return false;
}

// 初始化通知处理器
function initializeNotificationHandler() {
    console.log('[Notification Handler] 初始化通知处理器');
    
    // 检查是否在通知页面
    if (window.location.href.includes('xiaohongshu.com/notification')) {
        console.log('[Notification Handler] 当前在通知页面，开始添加按钮');
        
        // 尝试多次初始化，处理异步加载
        const tryInitialize = (attempt = 1, maxAttempts = 10) => {
            console.log(`[Notification Handler] 尝试初始化 (${attempt}/${maxAttempts})`);
            
            // 使用和extractNotificationsFromDOM相同的选择器逻辑
            let containers = document.querySelectorAll('.tabs-content-container .container');
            
            if (containers.length === 0) {
                containers = document.querySelectorAll('[class*="notification"] [class*="item"]') ||
                            document.querySelectorAll('[class*="notification"] [class*="container"]') ||
                            document.querySelectorAll('[class*="message"] [class*="item"]') ||
                            document.querySelectorAll('[class*="tabs"] [class*="container"]') ||
                            document.querySelectorAll('.container');
            }
            
            if (containers.length > 0) {
                console.log(`[Notification Handler] 找到 ${containers.length} 个通知容器，开始添加按钮`);
                addButtonsToNotifications();
            } else if (attempt < maxAttempts) {
                // 如果还没有找到容器，继续等待和重试
                console.log(`[Notification Handler] 未找到通知容器，${1000 * attempt}ms后重试`);
                setTimeout(() => tryInitialize(attempt + 1, maxAttempts), 1000 * attempt);
            } else {
                console.log('[Notification Handler] 达到最大重试次数，停止尝试');
            }
        };
        
        // 立即尝试一次
        tryInitialize();
        
        // 监听页面内容变化
        const observer = new MutationObserver((mutations) => {
            // 检查是否有新的通知容器被添加
            const hasNewContainers = mutations.some(mutation => 
                Array.from(mutation.addedNodes).some(node => 
                    node.nodeType === Node.ELEMENT_NODE && 
                    (node.matches && node.matches('.container') || 
                     node.querySelector && node.querySelector('.container'))
                )
            );
            
            if (hasNewContainers) {
                console.log('[Notification Handler] 检测到新的通知容器，延迟添加按钮');
                setTimeout(() => {
                    const containers = document.querySelectorAll('.tabs-content-container .container');
                    const buttonsCount = document.querySelectorAll('.xhs-plugin-action-btn').length;
                    
                    if (containers.length > buttonsCount) {
                        console.log(`[Notification Handler] 发现 ${containers.length} 个容器但只有 ${buttonsCount} 个按钮，补充添加`);
                        addButtonsToNotifications();
                    }
                }, 500);
            }
        });
        
        // 开始观察整个文档的变化
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
    } else {
        console.log('[Notification Handler] 当前不在通知页面，不添加按钮');
    }
}

// 导出通知处理器
window.xhsNotificationHandler = {
    extractNotificationsFromDOM,
    addButtonsToNotifications,
    getActiveTabType,
    navigateToNotificationPage,
    initializeNotificationHandler
};

export { 
    extractNotificationsFromDOM, 
    addButtonsToNotifications, 
    getActiveTabType, 
    navigateToNotificationPage,
    initializeNotificationHandler
}; 