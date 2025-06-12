import { appState, elements } from './state.js';

function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

export function updateApiUI() {
    elements.apiHostInput.value = appState.apiConfig.host || '';
    
    if (appState.apiConfig.host) {
        elements.apiConnectionStatus.textContent = '已配置';
        elements.apiConnectionStatus.className = 'status-value connected';
    } else {
        elements.apiConnectionStatus.textContent = '未配置';
        elements.apiConnectionStatus.className = 'status-value disconnected';
    }
    
    if (appState.apiConfig.token) {
        elements.apiLoginStatus.textContent = '已登录';
        elements.apiLoginStatus.className = 'status-value logged-in';
        elements.logoutBtn.style.display = 'inline-flex';
        elements.loginForm.style.display = 'none';
    } else {
        elements.apiLoginStatus.textContent = '未登录';
        elements.apiLoginStatus.className = 'status-value logged-out';
        elements.logoutBtn.style.display = 'none';
        elements.loginForm.style.display = 'block';
    }
}

export function updateMonitoringUI() {
    elements.enableMonitoring.checked = appState.config.enableMonitoring;
    elements.enableEnhanced.checked = appState.config.enableEnhanced;
    elements.maxLogSize.value = appState.config.maxLogSize;
    elements.logRequestBody.checked = appState.config.logRequestBody;
    elements.logResponseBody.checked = appState.config.logResponseBody;
}

export function updateCaptureRulesDisplay() {
    if (appState.captureRules.length > 0) {
        elements.rulesContainer.style.display = 'block';
        elements.rulesInfo.textContent = `已加载 ${appState.captureRules.length} 条抓取规则`;
        elements.rulesList.innerHTML = appState.captureRules
            .map(rule => `<li><strong>${escapeHtml(rule.name)}:</strong> <code>${escapeHtml(rule.pattern)}</code></li>`)
            .join('');
    } else {
        elements.rulesContainer.style.display = 'none';
    }
}

export function showStatus(message, type = 'info') {
    // 更新底部状态消息
    elements.statusMessage.textContent = message;
    elements.statusMessage.className = `status-message status-${type} show`;
    
    // 移除已存在的toast通知，防止重复
    const existingToasts = document.querySelectorAll('.toast-notification');
    existingToasts.forEach(toast => {
        toast.remove();
    });
    
    // 创建一个更明显的临时通知
    const notification = document.createElement('div');
    notification.className = `toast-notification toast-${type}`;
    notification.textContent = message;
    
    // 添加到页面顶部
    document.body.appendChild(notification);
    
    // 触发显示动画
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // 自动消失
    const hideTimeout = setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 4000);
    
    // 点击关闭
    notification.addEventListener('click', () => {
        clearTimeout(hideTimeout);
        notification.classList.remove('show');
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    });
    
    // 清除底部状态消息
    setTimeout(() => {
        elements.statusMessage.textContent = '';
        elements.statusMessage.className = 'status-message';
    }, 4000);
}

export function updateConfigStatus(saved = true, message = '') {
    const indicator = elements.configStatus.querySelector('.status-indicator');
    const text = elements.configStatus.querySelector('.status-text');
    if (saved) {
        indicator.classList.remove('unsaved');
        text.textContent = message || '配置已同步';
    } else {
        indicator.classList.add('unsaved');
        text.textContent = message || '配置未保存';
    }
}

export function toggleOtpInput(visible) {
    elements.otpGroup.style.display = visible ? 'block' : 'none';
}

export function setButtonLoading(button, isLoading, text = '处理中...') {
    if (isLoading) {
        button.disabled = true;
        button.innerHTML = `<div class="spinner"></div>${text}`;
    } else {
        button.disabled = false;
        button.innerHTML = button.dataset.originalText;
    }
} 