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
function handleMessage(request, sender, sendResponse) {
    switch (request.action) {
        case 'getRequests':
            sendResponse({ data: globalState.requestLog });
            return false;
        case 'getRequestLog':
            sendResponse({ success: true, data: globalState.requestLog });
            return false;
        case 'clearRequests':
            globalState.requestLog = [];
            globalState.requestStats.total = 0;
            globalState.requestStats.today = 0;
            sendResponse({ success: true });
            return false;
        case 'clearRequestLog':
            globalState.requestLog = [];
            globalState.requestStats.total = 0;
            globalState.requestStats.today = 0;
            sendResponse({ success: true });
            return false;
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
            return false;
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
            console.log(`[Background] 检查URL是否匹配抓取规则:`, request.data.url);
            console.log(`[Background] 当前抓取规则数量:`, globalState.captureRules ? globalState.captureRules.length : 0);
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
                console.log('[Background] URL未匹配任何抓取规则:', request.data.url);
                console.log('[Background] 可用的抓取规则:', globalState.captureRules);
                sendResponse({ success: false, matched: false, reason: 'URL not matched' });
            }
            return false;
        case 'refreshRules':
            loadCaptureRules()
                .then(() => {
                    sendResponse({ success: true });
                })
                .catch(error => {
                    sendResponse({ success: false, error: error.message });
                });
            return true; // 异步
        case 'refreshApiToken':
            refreshApiToken()
                .then(() => {
                    sendResponse({ success: true, token: globalState.apiConfig.token });
                })
                .catch(error => {
                    sendResponse({ success: false, error: error.message });
                });
            return true; // 异步
        case 'getRequestStats':
            sendResponse({ stats: globalState.requestStats });
            return false;
        case 'getCaptureRules':
            console.log('[Background] 收到getCaptureRules请求，当前规则:', globalState.captureRules);
            sendResponse({ data: globalState.captureRules });
            return false;
        case 'getApiConfig':
            // 为历史评论功能提供API配置
            console.log('[Background] 收到getApiConfig请求，当前API配置:', globalState.apiConfig);
            const apiConfigResponse = { 
                success: true,
                config: {
                    apiBaseUrl: globalState.apiConfig?.host || 'http://localhost:8000',
                    apiToken: globalState.apiConfig?.token || ''
                }
            };
            console.log('[Background] 发送API配置响应:', apiConfigResponse);
            sendResponse(apiConfigResponse);
            return false; // 同步响应，不需要保持消息通道开放
        case 'getGlobalState':
            // 为注入脚本提供全局状态（包括抓取规则）
            console.log('[Background] 收到getGlobalState请求');
            const globalStateResponse = {
                success: true,
                globalState: {
                    captureRules: globalState.captureRules || [],
                    apiConfig: globalState.apiConfig,
                    config: globalState.config
                }
            };
            console.log('[Background] 发送全局状态响应，抓取规则数量:', globalStateResponse.globalState.captureRules.length);
            sendResponse(globalStateResponse);
            return false;
        case 'proxyRequest':
            // 处理代理请求
            console.log('[Background] 开始处理代理请求，requestId:', request.data.requestId);
            handleProxyRequest(request.data)
                .then(response => {
                    console.log('[Background] 代理请求处理完成，发送响应:', response);
                    sendResponse(response);
                })
                .catch(error => {
                    console.error('[Background] 代理请求失败:', error);
                    const errorResponse = {
                        success: false,
                        status: 500,
                        error: error.message
                    };
                    console.log('[Background] 发送错误响应:', errorResponse);
                    sendResponse(errorResponse);
                });
            return true; // 保持消息通道开放以便异步响应
        case 'checkWebRequestStatus':
            // 检查webRequest监听器状态
            const webRequestStatus = {
                success: true,
                webRequestAvailable: typeof chrome.webRequest !== 'undefined',
                captureRulesCount: globalState.captureRules ? globalState.captureRules.length : 0,
                captureRules: globalState.captureRules || [],
                requestLogCount: globalState.requestLog ? globalState.requestLog.length : 0
            };
            console.log('[Background] webRequest状态检查:', webRequestStatus);
            sendResponse(webRequestStatus);
            return false;
        default:
            sendResponse({ error: 'Unknown action' });
            return false;
    }
}

/**
 * 处理代理请求
 * @param {object} requestData - 请求数据
 * @returns {Promise<object>} - 响应数据
 */
async function handleProxyRequest(requestData) {
    try {
        console.log('[Background] 处理代理请求:', requestData);

        // 从全局状态获取API主机地址
        const apiHost = globalState.apiConfig?.host;
        if (!apiHost) {
            const errorMsg = 'API host not configured. Please set it in the plugin options.';
            console.error(`[Background] ${errorMsg}`);
            return { success: false, status: 500, error: errorMsg };
        }

        // 构建完整的请求URL
        const fullUrl = `${apiHost}${requestData.url}`;
        
        // 构建fetch选项
        const fetchOptions = {
            method: requestData.options.method || 'GET',
            headers: requestData.options.headers || {}
        };
        
        // 如果有请求体，添加到选项中
        if (requestData.options.body) {
            fetchOptions.body = requestData.options.body;
        }
        
        console.log('[Background] 发送fetch请求:', fullUrl, fetchOptions);
        
        // 发送请求
        const response = await fetch(fullUrl, fetchOptions);
        
        console.log('[Background] 收到响应:', response.status, response.statusText);
        
        // 检查401错误并尝试刷新token
        if (response.status === 401) {
            console.log('[Background] 代理请求收到401，尝试刷新token...');
            
            try {
                // 尝试刷新token
                await refreshApiToken();
                
                // 检查token是否刷新成功
                if (!globalState.apiConfig?.token) {
                    console.log('[Background] 代理请求token刷新失败，返回401响应');
                    // token刷新失败，返回原始的401响应
                    let responseData;
                    const contentType = response.headers.get('content-type');
                    
                    if (contentType && contentType.includes('application/json')) {
                        responseData = await response.json();
                    } else {
                        responseData = await response.text();
                    }
                    
                    return {
                        success: false,
                        status: 401,
                        data: responseData,
                        error: 'Token已过期且刷新失败'
                    };
                }
                
                // 更新请求头中的Authorization
                if (fetchOptions.headers) {
                    fetchOptions.headers['Authorization'] = `Bearer ${globalState.apiConfig.token}`;
                    console.log('[Background] 已更新Authorization头，重试请求');
                    
                    // 重新发送请求
                    const retryResponse = await fetch(fullUrl, fetchOptions);
                    console.log('[Background] 重试请求响应:', retryResponse.status, retryResponse.statusText);
                    
                    // 如果重试后还是401，说明token彻底失效
                    if (retryResponse.status === 401) {
                        console.log('[Background] 重试后仍收到401，token彻底失效');
                        // 清除失效的凭据
                        globalState.apiConfig.token = '';
                        globalState.apiConfig.refreshToken = '';
                        chrome.storage.local.set({ 'xhs_api_config': globalState.apiConfig });
                        
                        // 通知popup需要重新登录
                        try {
                            chrome.runtime.sendMessage({
                                action: 'tokenExpired',
                                reason: '代理请求重试后仍收到401',
                                timestamp: Date.now()
                            });
                        } catch (error) {
                            console.log('[Background] 无法通知popup token过期:', error);
                        }
                    }
                    
                    // 处理重试响应
                    let retryData;
                    const retryContentType = retryResponse.headers.get('content-type');
                    
                    if (retryContentType && retryContentType.includes('application/json')) {
                        retryData = await retryResponse.json();
                    } else {
                        retryData = await retryResponse.text();
                    }
                    
                    console.log('[Background] 重试请求结果:', retryResponse.status, '数据:', retryData);
                    
                    return {
                        success: retryResponse.ok,
                        status: retryResponse.status,
                        data: retryData,
                        retried: true
                    };
                }
            } catch (refreshError) {
                console.error('[Background] 代理请求token刷新失败:', refreshError);
                // Token刷新失败，清除过期凭据
                globalState.apiConfig.token = '';
                globalState.apiConfig.refreshToken = '';
                chrome.storage.local.set({ 'xhs_api_config': globalState.apiConfig });
                
                // 通知popup需要重新登录
                try {
                    chrome.runtime.sendMessage({
                        action: 'tokenExpired',
                        reason: `代理请求token刷新失败: ${refreshError.message}`,
                        timestamp: Date.now()
                    });
                } catch (error) {
                    console.log('[Background] 无法通知popup token过期:', error);
                }
                
                // 继续处理原始401响应
            }
        }
        
        // 根据响应内容类型处理数据
        let responseData;
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            responseData = await response.json();
        } else {
            responseData = await response.text();
        }
        
        console.log('[Background] 代理请求完成:', response.status, '数据:', responseData);
        
        return {
            success: response.ok,
            status: response.status,
            data: responseData
        };
    } catch (error) {
        console.error('[Background] 代理请求出错:', error);
        return {
            success: false,
            status: 500,
            error: error.message
        };
    }
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