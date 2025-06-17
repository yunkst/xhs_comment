import { globalState } from '../shared/state.js';
import { DEFAULT_CONFIG } from '../shared/constants.js';

/**
 * 从 chrome.storage.sync 加载插件配置
 */
export function loadConfig() {
    chrome.storage.sync.get(['xhs_monitor_config'], function(result) {
        if (result.xhs_monitor_config) {
            globalState.config = { ...DEFAULT_CONFIG, ...result.xhs_monitor_config };
        } else {
            globalState.config = { ...DEFAULT_CONFIG };
        }
        console.log('[Background] 配置已加载:', globalState.config);
    });
}

/**
 * 从 chrome.storage.local 加载API配置
 * @returns {Promise<void>}
 */
export function loadApiConfig() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['xhs_api_config'], function(result) {
            if (result.xhs_api_config) {
                globalState.apiConfig = result.xhs_api_config;
            } else {
                globalState.apiConfig = { host: '', token: '', refreshToken: '' };
            }
            console.log('[Background] API配置已加载:', {
                hasHost: !!globalState.apiConfig.host,
                hasToken: !!globalState.apiConfig.token
            });
            resolve();
        });
    });
}

/**
 * 从 chrome.storage.local 加载请求统计信息
 */
export function loadRequestStats() {
    chrome.storage.local.get(['xhs_request_stats'], function(result) {
        if (result.xhs_request_stats) {
            globalState.requestStats = result.xhs_request_stats;

            // 检查是否需要重置今日统计
            const today = new Date().toDateString();
            if (globalState.requestStats.lastResetDate !== today) {
                globalState.requestStats.today = 0;
                globalState.requestStats.lastResetDate = today;
                saveRequestStats();
            }
        }
        console.log('[Background] 请求统计已加载:', globalState.requestStats);
    });
}

/**
 * 保存请求统计信息到 chrome.storage.local
 */
export function saveRequestStats() {
    chrome.storage.local.set({
        'xhs_request_stats': globalState.requestStats
    });
}

/**
 * 更新请求统计信息
 */
export function updateRequestStats() {
    if (!globalState.requestStats) {
        globalState.requestStats = {
            total: 0,
            today: 0,
            lastResetDate: new Date().toDateString()
        };
    }
    
    globalState.requestStats.total++;
    globalState.requestStats.today++;
    
    // 异步保存到存储
    saveRequestStats();
}

/**
 * 更新请求日志，并根据需要进行裁剪
 * @param {string} requestId - 请求ID
 * @param {object} updateData - 要更新的数据
 */
export function updateRequestLog(requestId, updateData) {
    const requestIndex = globalState.requestLog.findIndex(r => r.requestId === requestId);
    if (requestIndex > -1) {
        Object.assign(globalState.requestLog[requestIndex], updateData);
    }
}

/**
 * 记录一个新请求到日志中
 * @param {object} details - 请求详情
 * @param {string} source - 请求来源 ('webRequest' 或 'custom')
 * @param {object} matchedRule - 匹配到的抓取规则
 */
export function logRequest(details, source, matchedRule) {
    const logEntry = {
        requestId: details.requestId,
        url: details.url,
        method: details.method,
        type: details.type,
        timeStamp: details.timeStamp || details.timestamp || Date.now(),
        source: source,
        rule: matchedRule.name,
        requestBody: details.requestBody || details.body,
        initiator: details.initiator,
        tabId: details.tabId,
        headers: details.headers,
        // 添加响应数据字段
        response: details.response,
        statusCode: details.statusCode || details.response?.status,
        responseHeaders: details.responseHeaders || details.response?.headers,
        responseBody: details.responseBody || details.response?.body,
        contentType: details.response?.contentType,
        responseTime: details.response?.responseTime,
        timeString: details.timeString || new Date().toLocaleString('zh-CN')
    };

    globalState.requestLog.unshift(logEntry);

    // 限制日志大小
    if (globalState.config && globalState.requestLog.length > globalState.config.maxLogSize) {
        globalState.requestLog.pop();
    }
    updateRequestStats();
} 