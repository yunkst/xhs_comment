'use strict';

import { interceptFetch } from './fetch.js';
import { interceptXHR } from './xhr.js';
import { observeDOM } from './observer.js';
import { fetchUserHistoricalComments, getApiConfig } from './api-service.js';
import { showNotificationDialog, loadDialogContent, renderHistoricalComments, createCommentElement } from './dialog-manager.js';
import { extractNotificationsFromDOM, addButtonsToNotifications, getActiveTabType, navigateToNotificationPage, initializeNotificationHandler } from './notification-handler.js';

console.log('[XHS Plugin] 小红书网络请求拦截器模块已注入');

// 依次启动各个拦截器
try {
    interceptFetch();
    interceptXHR();
    observeDOM();
    console.log('[XHS Plugin] 所有网络请求拦截器已成功初始化');
} catch (error) {
    console.error('[XHS Plugin] 初始化网络拦截器时发生错误:', error);
}

// 初始化历史评论功能
try {
    // 立即尝试初始化
    initializeNotificationHandler();
    
    // 监听来自content script的初始化请求
    document.addEventListener('XHS_INITIALIZE_HISTORY_COMMENTS', function(event) {
        console.log('[XHS Plugin] 收到外部初始化请求，重新初始化历史评论功能');
        initializeNotificationHandler();
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
            }, 1000);
        }
    }).observe(document, { subtree: true, childList: true });
    
    // 定期检查并重新初始化（用于处理异步加载的内容）
    setInterval(() => {
        if (window.location.href.includes('xiaohongshu.com/notification')) {
            const containers = document.querySelectorAll('.tabs-content-container .container');
            const buttonsCount = document.querySelectorAll('.xhs-plugin-action-btn').length;
            
            if (containers.length > 0 && buttonsCount === 0) {
                console.log('[XHS Plugin] 定期检查：发现通知但无按钮，重新初始化');
                initializeNotificationHandler();
            }
        }
    }, 5000); // 增加检查间隔到5秒
    
    console.log('[XHS Plugin] 历史评论功能已成功初始化');
} catch (error) {
    console.error('[XHS Plugin] 初始化历史评论功能时发生错误:', error);
} 