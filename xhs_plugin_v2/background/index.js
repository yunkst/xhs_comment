import { globalState } from '../shared/state.js';
import { loadConfig, loadApiConfig, loadRequestStats, logRequest, updateRequestLog } from './storage.js';
import { loadCaptureRules, refreshApiToken, uploadNetworkData } from './api.js';
import { setupWebRequestListeners, findMatchingRule } from './webRequest.js';

/**
 * 初始化插件
 */
async function initializePlugin() {
    console.log('[Background] 开始初始化插件...');
    loadConfig();
    await loadApiConfig();
    loadRequestStats();
    await loadCaptureRules();
    setupWebRequestListeners();
    console.log('[Background] 插件初始化完成');
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
        case 'getRequestLog':
            sendResponse({ success: true, data: globalState.requestLog });
            break;
        case 'clearRequests':
            globalState.requestLog = [];
            globalState.requestStats.total = 0;
            globalState.requestStats.today = 0;
            sendResponse({ success: true });
            break;
        case 'clearRequestLog':
            globalState.requestLog = [];
            globalState.requestStats.total = 0;
            globalState.requestStats.today = 0;
            sendResponse({ success: true });
            break;
        case 'exportLog':
            try {
                const jsonStr = JSON.stringify(globalState.requestLog, null, 2);
                const blob = new Blob([jsonStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const filename = `xhs-network-log-${new Date().toISOString().slice(0, 10)}.json`;
                
                chrome.downloads.download({
                    url: url,
                    filename: filename
                }, (downloadId) => {
                    if (chrome.runtime.lastError) {
                        sendResponse({ success: false, error: chrome.runtime.lastError.message });
                    } else {
                        sendResponse({ success: true, downloadId });
                    }
                });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
            return true; // 异步响应
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
            // 来自content script的请求，检查URL是否匹配抓取规则
            const matchedRule = findMatchingRule(request.data.url);
            if (matchedRule) {
                console.log(`[Background] URL匹配到规则 '${matchedRule.name}':`, request.data.url);
                
                // 检查是否是包含响应的事件
                if (request.data.type.includes('_response') && request.data.response) {
                    
                    // 构建一个干净的数据对象，用于日志记录和上传
                    const dataForUpload = {
                        requestId: request.data.requestId,
                        url: request.data.url,
                        method: request.data.method,
                        statusCode: request.data.response.status,
                        responseHeaders: request.data.response.headers,
                        responseBody: request.data.response.body, // 关键字段
                        timeStamp: request.data.timeStamp || Date.now()
                    };

                    // 更新UI日志
                    updateRequestLog(dataForUpload.requestId, {
                        response: request.data.response,
                        statusCode: dataForUpload.statusCode,
                        responseHeaders: dataForUpload.responseHeaders,
                        responseBody: dataForUpload.responseBody,
                        contentType: request.data.response.contentType,
                        responseTime: request.data.response.responseTime
                    });
                    console.log(`[Background] 已更新请求日志: ${dataForUpload.requestId}`);

                    // 上传到后端
                    console.log(`[Background] 发现响应数据，准备上传到后端...`);
                    uploadNetworkData(dataForUpload, matchedRule);

                } else {
                    // 这是请求事件或无响应体的事件，只记录日志
                    logRequest(request.data, 'custom', matchedRule);
                    console.log(`[Background] 已记录新请求（无响应体）: ${request.data.requestId}`);
                }
                
                sendResponse({ success: true, matched: true });
            } else {
                // console.log('[Background] URL未匹配任何抓取规则:', request.data.url);
                sendResponse({ success: false, matched: false, reason: 'URL not matched' });
            }
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
        case 'getCaptureRules':
            console.log('[Background] 收到getCaptureRules请求，当前规则:', globalState.captureRules);
            sendResponse({ data: globalState.captureRules });
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