export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

export function formatTime(timestamp) {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString('zh-CN');
}

export function escapeHtml(text) {
    if (typeof text !== 'string') {
        text = String(text);
    }
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function getStatusCategory(log) {
    if (log.error) return 'error';
    if (!log.statusCode) return 'error';
    
    const status = log.statusCode;
    if (status >= 200 && status < 300) return '2xx';
    if (status >= 300 && status < 400) return '3xx';
    if (status >= 400 && status < 500) return '4xx';
    if (status >= 500) return '5xx';
    
    return 'error';
}

export function getStatusBadgeClass(log) {
    const category = getStatusCategory(log);
    return category === 'error' ? 'status-error' : `status-${category}`;
}

export function getStatusText(log) {
    if (log.error) return `错误: ${log.error}`;
    if (log.statusCode) return log.statusCode.toString();
    return '未知';
} 