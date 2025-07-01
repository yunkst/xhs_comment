/**
 * 用户备注模块 - 为通知列表添加备注功能
 */

/**
 * 检测当前页面类型
 * @returns {string} 页面类型: 'notification', 'note', 'home', 'other'
 */
function detectPageType() {
    const url = window.location.href;
    const pathname = window.location.pathname;
    
    // 检测通知页面
    if (url.includes('/notification') || pathname.includes('/notification')) {
        return 'notification';
    }
    
    // 检测笔记详情页面
    if (url.includes('/explore/') || url.includes('/discovery/item/') || pathname.includes('/explore/')) {
        return 'note';
    }
    
    // 检测首页
    if (pathname === '/' || url.includes('/home') || url.includes('/recommend')) {
        return 'home';
    }
    
    return 'other';
}

// 添加备注输入框到通知容器
function addNoteInputToContainer(container, userId, notification) {
    if (!container || !userId) {
        console.warn('[User Notes] 缺少容器或用户ID，无法添加备注输入框');
        return;
    }
    
    // 检查是否已添加备注输入框
    if (container.querySelector('.xhs-note-input')) {
        console.log('[User Notes] 容器已有备注输入框，更新内容');
        updateExistingNoteInput(container, userId, notification);
        return;
    }
    
    // 生成通知哈希
    const notificationHash = generateNotificationHash(notification);
    console.log(`[User Notes] 为用户 ${userId} 添加备注输入框，哈希: ${notificationHash}`);
    
    // 检测当前页面类型，动态设置合适的z-index
    const currentPageType = detectPageType();
    let zIndex = 100; // 默认较低的z-index
    
    if (currentPageType === 'notification') {
        zIndex = 100; // 通知页面使用低层级，避免遮挡其他元素
    } else {
        zIndex = 10; // 其他页面使用更低层级或隐藏
    }
    
    // 创建备注输入框容器
    const noteInputContainer = document.createElement('div');
    noteInputContainer.className = 'xhs-note-container';
    noteInputContainer.style.cssText = `
        position: absolute;
        right: -15px;
        top: 20px;
        transform: translateY(-50%);
        display: ${currentPageType === 'notification' ? 'flex' : 'none'};
        align-items: center;
        z-index: ${zIndex};
        opacity: ${currentPageType === 'notification' ? '1' : '0'};
        transition: all 0.3s ease;
    `;
    
    // 创建备注输入框
    const noteInput = document.createElement('textarea');
    noteInput.className = 'xhs-note-input';
    noteInput.placeholder = '添加备注...';
    noteInput.value = (window.xhsApiService && window.xhsApiService.userNotes && window.xhsApiService.userNotes[notificationHash]) || '';
    noteInput.dataset.notificationHash = notificationHash;
    noteInput.dataset.userId = userId;
    noteInput.style.cssText = `
        width: 200px;
        min-height: 60px;
        padding: 5px 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 12px;
        outline: none;
        transition: all 0.3s ease;
        resize: none;
        overflow: auto;
        color: #333;
        line-height: 1.4;
        font-family: Arial, sans-serif;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        background-color: white;
    `;
    
    // 自动调整高度函数
    const adjustHeight = () => {
        noteInput.style.height = 'auto';
        const newHeight = Math.max(60, noteInput.scrollHeight);
        noteInput.style.height = `${newHeight}px`;
    };
    
    // 首次加载时调整高度
    setTimeout(adjustHeight, 0);
    
    // 当输入内容变化时调整高度
    noteInput.addEventListener('input', adjustHeight);
    
    // 创建状态指示器
    const statusIndicator = document.createElement('div');
    statusIndicator.className = 'xhs-note-status';
    statusIndicator.style.cssText = `
        position: absolute;
        top: -8px;
        right: -8px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background-color: transparent;
        display: none;
        transition: all 0.3s ease;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        z-index: 1001;
    `;
    noteInputContainer.appendChild(statusIndicator);
    
    // 添加输入框样式事件
    noteInput.addEventListener('focus', () => {
        noteInput.style.borderColor = '#ff2442';
        noteInput.style.boxShadow = '0 0 5px rgba(255,36,66,0.3)';
    });
    
    noteInput.addEventListener('blur', () => {
        noteInput.style.borderColor = '#ddd';
        noteInput.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
    });
    
    // 创建防抖保存函数
    let saveTimeout;
    
    // 添加输入事件，实时保存备注
    noteInput.addEventListener('input', () => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
            const newNoteContent = noteInput.value.trim();
            const currentContent = (window.xhsApiService && window.xhsApiService.userNotes && window.xhsApiService.userNotes[notificationHash]) || '';
            
            // 如果备注内容有变化，则保存
            if (newNoteContent !== currentContent) {
                console.log(`[User Notes] 保存备注: ${newNoteContent}`);
                
                // 显示保存中状态
                statusIndicator.style.display = 'block';
                statusIndicator.style.backgroundColor = '#ffaa00';
                noteInput.style.borderColor = '#ffaa00';
                noteInput.style.boxShadow = '0 0 8px rgba(255,170,0,0.5)';
                
                // 添加保存中动画
                statusIndicator.style.animation = 'xhs-note-saving-pulse 1s infinite';
                
                // 保存备注
                // 构建清晰的内容结构，避免重复
                let mainContent = '';
                let interactionType = '';
                
                // 提取主要评论内容
                if (typeof notification.content === 'object') {
                    // 新格式：直接使用main字段
                    mainContent = notification.content.main || '';
                } else {
                    // 旧格式：尝试处理字符串
                    mainContent = notification.content || '';
                }
                
                // 提取交互类型
                const hintElement = notification.element?.querySelector('.interaction-hint');
                if (hintElement) {
                    const hintClone = hintElement.cloneNode(true);
                    const timeElement = hintClone.querySelector('.interaction-time');
                    if (timeElement) {
                        timeElement.remove();
                    }
                    interactionType = hintClone.textContent.trim();
                    
                    // 如果旧格式内容中已包含交互类型，则从主内容中移除
                    if (typeof notification.content !== 'object' && mainContent.includes(interactionType)) {
                        mainContent = mainContent.replace(interactionType, '').trim();
                    }
                }
                
                // 只使用主要评论内容，不包含交互提示信息
                const content = mainContent;
                
                let saveSuccess = false;
                
                if (window.xhsApiService && window.xhsApiService.saveUserNote) {
                    saveSuccess = await window.xhsApiService.saveUserNote(userId, notificationHash, newNoteContent, content);
                } else {
                    console.warn('[User Notes] API服务未初始化，无法保存备注');
                }
                
                // 停止保存中动画
                statusIndicator.style.animation = '';
                
                if (saveSuccess) {
                    // 保存成功动画
                    statusIndicator.style.backgroundColor = '#4caf50';
                    noteInput.style.borderColor = '#4caf50';
                    noteInput.style.boxShadow = '0 0 8px rgba(76,175,80,0.5)';
                    
                    // 创建成功提示元素
                    const successIcon = document.createElement('div');
                    successIcon.className = 'xhs-save-success-icon';
                    successIcon.innerHTML = '✓';
                    successIcon.style.cssText = `
                        position: absolute;
                        color: white;
                        font-size: 10px;
                        font-weight: bold;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                    `;
                    statusIndicator.innerHTML = '';
                    statusIndicator.appendChild(successIcon);
                    
                    // 2秒后隐藏状态
                    setTimeout(() => {
                        statusIndicator.style.display = 'none';
                        noteInput.style.borderColor = '#ddd';
                        noteInput.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                    }, 2000);
                } else {
                    // 保存失败动画
                    statusIndicator.style.backgroundColor = '#f44336';
                    noteInput.style.borderColor = '#f44336';
                    noteInput.style.boxShadow = '0 0 8px rgba(244,67,54,0.5)';
                    
                    // 创建失败提示元素
                    const failIcon = document.createElement('div');
                    failIcon.className = 'xhs-save-fail-icon';
                    failIcon.innerHTML = '!';
                    failIcon.style.cssText = `
                        position: absolute;
                        color: white;
                        font-size: 10px;
                        font-weight: bold;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                    `;
                    statusIndicator.innerHTML = '';
                    statusIndicator.appendChild(failIcon);
                    
                    // 3秒后隐藏状态
                    setTimeout(() => {
                        statusIndicator.style.display = 'none';
                        noteInput.style.borderColor = '#ddd';
                        noteInput.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                    }, 3000);
                }
            }
        }, 500); // 延迟500ms保存，防止频繁请求
    });
    
    // 将输入框添加到容器
    noteInputContainer.appendChild(noteInput);
    container.appendChild(noteInputContainer);
    
    console.log(`[User Notes] 成功添加备注输入框到容器`);
}

// 更新已存在的备注输入框内容
function updateExistingNoteInput(container, userId, notification) {
    const noteInput = container.querySelector('.xhs-note-input');
    if (!noteInput) return;
    
    // 生成通知哈希
    const notificationHash = generateNotificationHash(notification);
    
    // 如果备注内容有变化，则更新输入框
    const currentValue = noteInput.value;
    const newValue = (window.xhsApiService && window.xhsApiService.userNotes && window.xhsApiService.userNotes[notificationHash]) || '';
    
    if (currentValue !== newValue) {
        console.log(`[User Notes] 更新备注输入框内容: ${currentValue} -> ${newValue}`);
        noteInput.value = newValue;
        
        // 更新数据属性
        noteInput.dataset.notificationHash = notificationHash;
        noteInput.dataset.userId = userId;
        
        // 自动调整高度
        setTimeout(() => {
            noteInput.style.height = 'auto';
            const newHeight = Math.max(60, noteInput.scrollHeight);
            noteInput.style.height = `${newHeight}px`;
        }, 0);
    }
}

// 刷新页面上所有备注输入框
function refreshAllNoteInputs() {
    console.log('[User Notes] 刷新页面上所有备注输入框');
    const noteInputs = document.querySelectorAll('.xhs-note-input');
    
    noteInputs.forEach(input => {
        const notificationHash = input.dataset.notificationHash;
        if (notificationHash && window.xhsApiService && window.xhsApiService.userNotes) {
            const newValue = window.xhsApiService.userNotes[notificationHash] || '';
            const currentValue = input.value;
            
            if (currentValue !== newValue) {
                console.log(`[User Notes] 刷新备注输入框内容: ${currentValue} -> ${newValue}`);
                input.value = newValue;
                
                // 自动调整高度
                setTimeout(() => {
                    input.style.height = 'auto';
                    const newHeight = Math.max(60, input.scrollHeight);
                    input.style.height = `${newHeight}px`;
                }, 0);
            }
        }
    });
}

// 生成通知哈希值作为唯一标识
function generateNotificationHash(notification) {
    if (!notification || !notification.userInfo) {
        console.warn('[User Notes] 无效的通知对象，无法生成哈希');
        return '';
    }
    
    // 使用用户ID、内容摘要、交互类型作为哈希基础
    const userId = notification.userInfo.id || '';
    
    // 获取交互提示信息（如"回复了你的评论"）
    let interactionType = '';
    const hintElement = notification.element?.querySelector('.interaction-hint');
    if (hintElement) {
        const hintClone = hintElement.cloneNode(true);
        const timeElement = hintClone.querySelector('.interaction-time');
        if (timeElement) {
            timeElement.remove();
        }
        interactionType = hintClone.textContent.trim();
    }
    
    // 仅提取主要评论内容，不包含交互提示信息
    let mainContent = '';
    if (typeof notification.content === 'object') {
        // 新格式：仅使用main字段（评论内容）
        mainContent = notification.content.main || '';
    } else {
        // 旧格式：尝试从字符串中提取主要内容
        const contentStr = notification.content || '';
        // 如果内容中包含交互类型，则尝试分离
        if (interactionType && contentStr.includes(interactionType)) {
            mainContent = contentStr.replace(interactionType, '').trim();
        } else {
            mainContent = contentStr;
        }
    }
    
    // 使用主要评论内容生成预览
    const contentPreview = mainContent.substring(0, 20).replace(/\s+/g, '');
    // 使用交互类型作为通知类型
    const notificationType = interactionType || notification.type || '';
    
    // 组合成哈希字符串，格式: userId_contentPreview_notificationType
    const hash = `${userId}_${contentPreview}_${notificationType}`;
    console.log(`[User Notes] 生成通知哈希: ${hash}`);
    return hash;
}

// 添加备注相关的CSS样式
function addNoteStyles() {
    if (document.querySelector('#xhs-note-styles')) {
        return; // 样式已添加
    }
    
    const styles = document.createElement('style');
    styles.id = 'xhs-note-styles';
    styles.textContent = `
        /* 备注保存中动画 */
        @keyframes xhs-note-saving-pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.2); opacity: 0.7; }
            100% { transform: scale(1); opacity: 1; }
        }
        
        /* 备注容器悬停效果 */
        .xhs-note-container:hover .xhs-note-input {
            border-color: #ff2442 !important;
            box-shadow: 0 0 5px rgba(255,36,66,0.3) !important;
        }
        
        /* 备注输入框滚动条样式 */
        .xhs-note-input::-webkit-scrollbar {
            width: 4px;
        }
        
        .xhs-note-input::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 2px;
        }
        
        .xhs-note-input::-webkit-scrollbar-thumb {
            background: #ccc;
            border-radius: 2px;
        }
        
        .xhs-note-input::-webkit-scrollbar-thumb:hover {
            background: #999;
        }
    `;
    
    document.head.appendChild(styles);
    console.log('[User Notes] 添加备注样式');
}

// 初始化用户备注模块
function initializeUserNotes() {
    console.log('[User Notes] 初始化用户备注模块');
    
    // 添加样式
    addNoteStyles();
    
    // 等待API服务初始化
    const waitForApiService = () => {
        if (window.xhsApiService) {
            console.log('[User Notes] API服务已初始化');
            // 如果有初始化用户备注的方法，调用它
            if (window.xhsApiService.initializeUserNotes) {
                window.xhsApiService.initializeUserNotes();
            }
        } else {
            console.log('[User Notes] 等待API服务初始化...');
            setTimeout(waitForApiService, 1000);
        }
    };
    
    waitForApiService();
}

// 导出函数到全局（保持向后兼容）
window.xhsUserNotes = {
    addNoteInputToContainer,
    updateExistingNoteInput,
    refreshAllNoteInputs,
    generateNotificationHash,
    initializeUserNotes
};

// ES6模块导出
export {
    addNoteInputToContainer,
    updateExistingNoteInput,
    refreshAllNoteInputs,
    generateNotificationHash,
    initializeUserNotes,
    addNoteStyles
};

// 自动初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeUserNotes);
} else {
    initializeUserNotes();
}

console.log('[User Notes] 用户备注模块已加载'); 