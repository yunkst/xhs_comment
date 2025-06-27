import { elements, appState } from './state.js';
import { setupEventListeners } from './events.js';
import * as actions from './actions.js';
import { updateAllUI, showToast } from './ui.js';

/**
 * 初始化Popup页面
 */
function initialize() {
    console.log('[XHS Monitor Popup] 初始化...');
    
    // 加载必要的数据
    actions.loadApiConfig();
    actions.loadSsoSession();
    actions.loadMonitorConfig();
    actions.loadCaptureRules();
    
    // 设置事件监听器
    setupEventListeners();
    
    // 初始UI更新
    updateAllUI();
    
    // 监听来自background的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log('[Popup] 收到消息:', request);
        
        if (request.action === 'tokenExpired') {
            console.log('[Popup] 收到token过期通知:', request.reason);
            // 设置API错误状态
            appState.lastApiError = `401 - ${request.reason}`;
            
            // 清除本地token缓存
            appState.apiConfig.token = '';
            appState.apiConfig.refreshToken = '';
            
            // 更新UI显示需要重新登录
            updateAllUI();
            
            // 显示提示消息
            showToast(`登录已过期：${request.reason}`, 'warning');
            
            sendResponse({ success: true });
        } else if (request.action === 'tokenRefreshed') {
            console.log('[Popup] 收到token刷新成功通知');
            // 清除错误状态
            appState.lastApiError = null;
            
            // 重新加载API配置
            actions.loadApiConfig();
            
            // 显示成功消息
            showToast('登录已自动刷新', 'success');
            
            sendResponse({ success: true });
        }
        
        return false; // 同步响应
    });
    
    console.log('[Popup] 初始化完成');
}

// 当DOM加载完成后开始初始化
document.addEventListener('DOMContentLoaded', initialize); 