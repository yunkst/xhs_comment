// injected/utils.js

// 检查是否为小红书相关的URL
function isXHSUrl(url) {
    return url && (
        url.includes('xiaohongshu.com') ||
        url.includes('xhscdn.com') ||
        url.includes('fegine.com')
    );
}

// 固化的抓取规则 - 通知列表
const HARDCODED_CAPTURE_RULES = [
    {
        name: '通知列表',
        pattern: '/api/sns/web/v1/you/mentions',
        enabled: true,
        description: '抓取用户通知列表数据'
    }
];

// 检查URL是否匹配固化的抓取规则
function matchesHardcodedRule(url) {
    if (!url) return null;
    
    for (const rule of HARDCODED_CAPTURE_RULES) {
        if (rule.enabled && url.includes(rule.pattern)) {
            return rule;
        }
    }
    return null;
}

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

export { isXHSUrl, dispatchInterceptEvent, matchesHardcodedRule, HARDCODED_CAPTURE_RULES }; 