import { appState, elements } from './state.js';

function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export function updateApiStatus() {
    const hasHost = !!appState.apiConfig.host;
    const hasToken = !!appState.apiConfig.token;
    
    if (hasHost && hasToken) {
        elements.apiStatusIndicator.classList.add('connected');
        elements.apiStatusText.textContent = `API已连接: ${appState.apiConfig.host.substring(0, 20)}... (已登录)`;
        elements.ssoContainer.style.display = 'none';
        elements.logoutContainer.classList.add('show');
    } else if (hasHost) {
        elements.apiStatusIndicator.classList.remove('connected');
        elements.apiStatusText.textContent = `API已配置: ${appState.apiConfig.host.substring(0, 20)}... (未登录)`;
        elements.ssoContainer.style.display = 'block';
        elements.logoutContainer.classList.remove('show');
        updateSsoButtons();
    } else {
        elements.apiStatusIndicator.classList.remove('connected');
        elements.apiStatusText.textContent = '未配置API服务';
        elements.ssoContainer.style.display = 'none';
        elements.logoutContainer.classList.remove('show');
    }
}

export function updateSsoButtons() {
    if (appState.ssoSession.id && appState.ssoSession.status === 'pending') {
        elements.ssoCheckLogin.style.display = 'block';
        elements.ssoCheckLogin.classList.remove('hidden');
        elements.ssoStartLogin.innerHTML = '🔄 重新发起SSO登录';
    } else {
        elements.ssoCheckLogin.style.display = 'none';
        elements.ssoStartLogin.innerHTML = '🔐 单点登录 (SSO)';
    }
}

export function updateConfigWarning() {
    if (!appState.config || !appState.config.enableMonitoring) {
        elements.configWarning.style.display = 'block';
    } else {
        elements.configWarning.style.display = 'none';
    }
}

export function updateRequestStats() {
    elements.totalRequests.textContent = appState.requestStats.total;
    elements.todayRequests.textContent = appState.requestStats.today;
}

export function updateEmptyState() {
    if (appState.filteredLog.length === 0) {
        elements.emptyState.style.display = 'block';
        elements.requestLogContainer.style.display = 'none';
    } else {
        elements.emptyState.style.display = 'none';
        elements.requestLogContainer.style.display = 'block';
    }
}

export function updateCaptureRulesDisplay() {
    if (!elements.rulesList) return;
    if (appState.captureRules.length > 0) {
        elements.captureRulesInfo.style.display = 'block';
        elements.rulesList.innerHTML = appState.captureRules
            .map(rule => `<li><strong>${escapeHtml(rule.name)}:</strong> <code>${escapeHtml(rule.pattern)}</code></li>`)
            .join('');
    } else {
        elements.captureRulesInfo.style.display = 'none';
    }
}

export function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
}

export function renderLog() {
    const logContainer = elements.requestLogContainer;
    logContainer.innerHTML = ''; // Clear previous logs
    
    appState.filteredLog.forEach(log => {
        const logItem = document.createElement('div');
        logItem.className = 'log-item';
        // ... (render log item details)
        logContainer.appendChild(logItem);
    });

    updateEmptyState();
}

export function updateAllUI() {
    updateApiStatus();
    updateConfigWarning();
    updateRequestStats();
    updateEmptyState();
    updateCaptureRulesDisplay();
} 