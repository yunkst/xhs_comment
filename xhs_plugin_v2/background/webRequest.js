import { globalState } from '../shared/state.js';
import { logRequest, updateRequestLog } from './storage.js';
import { uploadNetworkData } from './api.js';

// 不再使用固化规则，完全依赖后端动态规则

/**
 * 检查URL是否匹配抓取规则（包括动态规则和固化规则）
 * @param {string} url - 要检查的URL
 * @returns {object|null} - 匹配的规则对象或null
 */
export function findMatchingRule(url) {
    // 只检查从后端获取的动态规则
    if (globalState.captureRules && globalState.captureRules.length > 0) {
        for (const rule of globalState.captureRules) {
            if (rule.enabled && rule.pattern && url.includes(rule.pattern)) {
                console.log(`[Background] URL匹配到规则: ${rule.name}, pattern: ${rule.pattern}, URL: ${url}`);
                return rule;
            }
        }
    } else {
        console.log(`[Background] 没有可用的抓取规则，当前规则数量: ${globalState.captureRules?.length || 0}`);
    }
    
    return null;
}

/**
 * URL模式匹配函数
 * @param {string} url - URL
 * @param {string} pattern - 模式
 * @returns {boolean} - 是否匹配
 */
function matchUrlPattern(url, pattern) {
    const regexPattern = pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '\\?');
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(url);
}

/**
 * 处理请求开始
 * @param {object} details - 请求详情
 */
function handleBeforeRequest(details) {
    if (!globalState.config?.enableMonitoring) return;

    const matchedRule = findMatchingRule(details.url);
    if (!matchedRule) {
        if (details.url.includes('xiaohongshu.com') || details.url.includes('xhscdn.com') || details.url.includes('fegine.com')) {
            // console.log('[Background] 小红书请求未匹配任何规则:', details.url);
        }
        return;
    }
    logRequest(details, 'webRequest', matchedRule);
}

/**
 * 处理请求完成
 * @param {object} details - 请求详情
 */
function handleRequestCompleted(details) {
    if (!globalState.config?.enableMonitoring) return;

    const matchedRule = findMatchingRule(details.url);
    if (!matchedRule) return;

    updateRequestLog(details.requestId, {
        statusCode: details.statusCode,
        responseHeaders: details.responseHeaders,
        timeStamp: details.timeStamp
    });

    uploadNetworkData(details, matchedRule);
}

/**
 * 处理请求错误
 * @param {object} details - 请求详情
 */
function handleRequestError(details) {
    if (!globalState.config?.enableMonitoring) return;

    const matchedRule = findMatchingRule(details.url);
    if (!matchedRule) return;

    updateRequestLog(details.requestId, {
        error: details.error,
        timeStamp: details.timeStamp
    });
}

/**
 * 设置所有WebRequest监听器
 */
export function setupWebRequestListeners() {
    // 清除之前的监听器以防重复添加
    if (chrome.webRequest.onBeforeRequest.hasListeners()) {
        chrome.webRequest.onBeforeRequest.removeListener(handleBeforeRequest);
    }
    if (chrome.webRequest.onCompleted.hasListeners()) {
        chrome.webRequest.onCompleted.removeListener(handleRequestCompleted);
    }
    if (chrome.webRequest.onErrorOccurred.hasListeners()) {
        chrome.webRequest.onErrorOccurred.removeListener(handleRequestError);
    }

    // 监听请求开始
    chrome.webRequest.onBeforeRequest.addListener(
        handleBeforeRequest,
        { urls: ['<all_urls>'] },
        ['requestBody']
    );

    // 监听请求完成
    chrome.webRequest.onCompleted.addListener(
        handleRequestCompleted,
        { urls: ['<all_urls>'] },
        ['responseHeaders']
    );

    // 监听请求错误
    chrome.webRequest.onErrorOccurred.addListener(
        handleRequestError,
        { urls: ['<all_urls>'] }
    );

    console.log('[Background] WebRequest监听器已设置');
} 