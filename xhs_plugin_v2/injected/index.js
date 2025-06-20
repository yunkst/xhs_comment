'use strict';

import { interceptFetch } from './fetch.js';
import { interceptXHR } from './xhr.js';
import { observeDOM } from './observer.js';
import { fetchUserHistoricalComments, getApiConfig } from './api-service.js';
import { showNotificationDialog, loadDialogContent, renderHistoricalComments, createCommentElement } from './dialog-manager.js';
import { extractNotificationsFromDOM, addButtonsToNotifications, getActiveTabType, navigateToNotificationPage, initializeNotificationHandler } from './notification-handler.js';

console.log('[XHS Plugin] 小红书网络请求拦截器模块已注入');

// 动态导入用户备注模块
let userNotesModule = null;
let userNotesLoaded = false;
let notificationHandlerInitialized = false;

// 加载用户备注模块
async function loadUserNotesModule() {
    try {
        console.log('[XHS Plugin] 开始加载用户备注模块...');
        
        // 使用动态import加载用户备注模块
        const module = await import('./user-notes.js');
        userNotesModule = module;
        userNotesLoaded = true;
        
        console.log('[XHS Plugin] 用户备注模块加载完成');
        
        // 确保全局对象已设置
        if (!window.xhsUserNotes) {
            // 如果全局对象未设置，手动设置
            window.xhsUserNotes = {
                addNoteInputToContainer: module.addNoteInputToContainer,
                updateExistingNoteInput: module.updateExistingNoteInput,
                refreshAllNoteInputs: module.refreshAllNoteInputs,
                generateNotificationHash: module.generateNotificationHash,
                initializeUserNotes: module.initializeUserNotes
            };
        }
        
        // 用户备注模块加载完成后，尝试初始化通知处理器
        tryInitializeNotificationHandler();
    } catch (error) {
        console.error('[XHS Plugin] 用户备注模块加载失败:', error);
        userNotesLoaded = true; // 即使失败也标记为已尝试加载
        tryInitializeNotificationHandler();
    }
}

// 依次启动各个拦截器
try {
    interceptFetch();
    interceptXHR();
    observeDOM();
    console.log('[XHS Plugin] 所有网络请求拦截器已成功初始化');
} catch (error) {
    console.error('[XHS Plugin] 初始化网络拦截器时发生错误:', error);
}

// 尝试初始化通知处理器的函数
function tryInitializeNotificationHandler() {
    if (!userNotesLoaded || notificationHandlerInitialized) {
        return; // 用户备注模块未加载完成，或已经初始化过
    }
    
    console.log('[XHS Plugin] 开始初始化通知处理器');
    notificationHandlerInitialized = true;
    
    // 等待一小段时间确保用户备注模块完全初始化
    setTimeout(() => {
        initializeNotificationHandler();
    }, 500);
    
    // 监听来自content script的初始化请求
    document.addEventListener('XHS_INITIALIZE_HISTORY_COMMENTS', function(event) {
        console.log('[XHS Plugin] 收到外部初始化请求，重新初始化历史评论功能');
        setTimeout(() => {
            initializeNotificationHandler();
        }, 500);
    });
    
    // 监听URL变化（单页应用路由变化）
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            console.log('[XHS Plugin] URL变化检测到，重新初始化:', url);
            setTimeout(() => {
                initializeNotificationHandler();
            }, 1000); // URL变化后延迟更长时间
        }
    }).observe(document, { subtree: true, childList: true });
    
    // 定期检查并重新初始化（用于处理异步加载的内容）
    setInterval(() => {
        if (window.location.href.includes('xiaohongshu.com/notification')) {
            const containers = document.querySelectorAll('.tabs-content-container .container');
            const buttonsCount = document.querySelectorAll('.xhs-plugin-action-btn').length;
            const noteInputsCount = document.querySelectorAll('.xhs-note-input').length;
            
            if (containers.length > 0 && (buttonsCount === 0 || noteInputsCount === 0)) {
                console.log('[XHS Plugin] 定期检查：发现通知但缺少按钮或备注输入框，重新初始化');
                setTimeout(() => {
                    initializeNotificationHandler();
                }, 500);
            }
        }
    }, 5000); // 增加检查间隔到5秒
    
    console.log('[XHS Plugin] 历史评论功能已成功初始化');
}

// 初始化历史评论功能
try {
    // 加载用户备注模块
    loadUserNotesModule();
} catch (error) {
    console.error('[XHS Plugin] 初始化历史评论功能时发生错误:', error);
} 