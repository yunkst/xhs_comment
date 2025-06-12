// injected/utils.js

// 检查是否为小红书相关的URL
function isXHSUrl(url) {
    return url && (
        url.includes('xiaohongshu.com') ||
        url.includes('xhscdn.com') ||
        url.includes('fegine.com')
    );
}

// 发送拦截事件到内容脚本
function dispatchInterceptEvent(data) {
    const event = new CustomEvent('XHS_REQUEST_INTERCEPTED', {
        detail: data
    });
    window.dispatchEvent(event);
}

export { isXHSUrl, dispatchInterceptEvent }; 