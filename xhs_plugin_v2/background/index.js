import { globalState } from '../shared/state.js';
import { loadConfig, loadApiConfig, loadRequestStats, logRequest } from './storage.js';
import { loadCaptureRules, refreshApiToken } from './api.js';
import { setupWebRequestListeners } from './webRequest.js';

/**
 * 初始化插件
 */
async function initializePlugin() {
    loadConfig();
    await loadApiConfig();
    loadRequestStats();
    await loadCaptureRules();
    setupWebRequestListeners();
}

/**
 * 处理来自插件其他部分的消息
 * @param {object} request - 请求消息
 * @param {object} sender - 发送者信息
 * @param {function} sendResponse - 回调函数
 * @returns {boolean} - 返回true以支持异步响应
 */
async function handleMessage(request, sender, sendResponse) {
    switch (request.action) {
        case 'getRequests':
            sendResponse({ data: globalState.requestLog });
            break;
        case 'clearRequests':
            globalState.requestLog = [];
            globalState.requestStats.total = 0;
            globalState.requestStats.today = 0;
            sendResponse({ success: true });
            break;
        case 'getConfig':
            sendResponse({ config: globalState.config, apiConfig: globalState.apiConfig });
            break;
        case 'saveConfig':
            globalState.config = request.config;
            chrome.storage.sync.set({ 'xhs_monitor_config': request.config }, () => {
                sendResponse({ success: true });
            });
            return true; // 异步
        case 'saveApiConfig':
            globalState.apiConfig = request.apiConfig;
            chrome.storage.local.set({ 'xhs_api_config': request.apiConfig }, () => {
                sendResponse({ success: true });
            });
            return true; // 异步
        case 'logCustomRequest':
            // 来自content script的请求
            logRequest(request.data, 'custom', { name: 'injected' });
            sendResponse({ success: true });
            break;
        case 'refreshRules':
            try {
                await loadCaptureRules();
                sendResponse({ success: true });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
            return true; // 异步
        case 'refreshApiToken':
            try {
                await refreshApiToken();
                sendResponse({ success: true, token: globalState.apiConfig.token });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
            return true; // 异步
        case 'getRequestStats':
            sendResponse({ stats: globalState.requestStats });
            break;
        default:
            sendResponse({ error: 'Unknown action' });
            break;
    }
    return true;
}


// --- 初始化流程 ---

// 监听插件安装或更新
chrome.runtime.onInstalled.addListener((details) => {
    console.log('[Background] 插件事件:', details.reason);
    initializePlugin();
});

// 监听浏览器启动
chrome.runtime.onStartup.addListener(() => {
    console.log('[Background] 浏览器启动');
    initializePlugin();
});

// 监听消息
chrome.runtime.onMessage.addListener(handleMessage);

// 首次运行时初始化
initializePlugin(); 