// injected/utils.js

// 检查是否为小红书相关的URL
function isXHSUrl(url) {
    return url && (
        url.includes('xiaohongshu.com') ||
        url.includes('xhscdn.com') ||
        url.includes('fegine.com')
    );
}

// 检查URL是否匹配动态抓取规则（从后端获取）
function matchesCaptureRule(url) {
    if (!url || !window.globalState?.captureRules) return null;
    
    for (const rule of window.globalState.captureRules) {
        if (rule.enabled && url.includes(rule.pattern)) {
            return rule;
        }
    }
    return null;
}

// 为了兼容性，保留旧的函数名
const matchesHardcodedRule = matchesCaptureRule;

// 发送拦截事件到内容脚本
function dispatchInterceptEvent(data) {
    console.log('[Injected] 发送拦截事件:', {
        url: data.url,
        method: data.method,
        type: data.type,
        hasResponse: !!data.response
    });
    
    const event = new CustomEvent('XHS_REQUEST_INTERCEPTED', {
        detail: data
    });
    document.dispatchEvent(event);
}

export { isXHSUrl, dispatchInterceptEvent, matchesHardcodedRule, matchesCaptureRule }; 