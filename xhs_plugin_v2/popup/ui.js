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
    
    // 检查token是否可能过期（通过最近的错误状态判断）
    const tokenMaybeExpired = appState.lastApiError && appState.lastApiError.includes('401');
    
    if (hasHost && hasToken) {
        if (tokenMaybeExpired) {
            // Token可能已过期
            elements.apiStatusIndicator.classList.remove('connected');
            elements.apiStatusIndicator.style.backgroundColor = '#ff9500'; // 橙色警告
            elements.apiStatusText.textContent = `⚠️ 登录可能已过期，请重新登录`;
            elements.ssoContainer.style.display = 'block';
            elements.logoutContainer.classList.remove('show');
            updateSsoButtons();
        } else {
            // 正常连接状态
            elements.apiStatusIndicator.classList.add('connected');
            elements.apiStatusIndicator.style.backgroundColor = ''; // 重置颜色
            elements.apiStatusText.textContent = `✅ API已连接: ${appState.apiConfig.host.substring(0, 20)}... (已登录)`;
            elements.ssoContainer.style.display = 'none';
            elements.logoutContainer.classList.add('show');
        }
    } else if (hasHost) {
        elements.apiStatusIndicator.classList.remove('connected');
        elements.apiStatusIndicator.style.backgroundColor = ''; // 重置颜色
        elements.apiStatusText.textContent = `⚙️ API已配置: ${appState.apiConfig.host.substring(0, 20)}... (未登录)`;
        elements.ssoContainer.style.display = 'block';
        elements.logoutContainer.classList.remove('show');
        updateSsoButtons();
    } else {
        elements.apiStatusIndicator.classList.remove('connected');
        elements.apiStatusIndicator.style.backgroundColor = ''; // 重置颜色
        elements.apiStatusText.textContent = '❌ 未配置API服务';
        elements.ssoContainer.style.display = 'block'; // 显示SSO容器，让用户看到配置提示
        elements.logoutContainer.classList.remove('show');
        updateSsoButtons();
    }
}

export function updateSsoButtons() {
    const hasHost = !!appState.apiConfig.host;
    
    if (appState.ssoSession.id && appState.ssoSession.status === 'pending') {
        elements.ssoCheckLogin.style.display = 'block';
        elements.ssoCheckLogin.classList.remove('hidden');
        elements.ssoStartLogin.innerHTML = '🔄 重新发起SSO登录';
    } else {
        elements.ssoCheckLogin.style.display = 'none';
        if (hasHost) {
            elements.ssoStartLogin.innerHTML = '🔐 单点登录 (SSO)';
        } else {
            elements.ssoStartLogin.innerHTML = '⚙️ 先配置API地址';
        }
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
    if (!elements.rulesList || !elements.captureRulesInfo) return;
    
    console.log('[Popup] 更新抓取规则显示:', appState.captureRules);
    
    if (appState.captureRules.length > 0) {
        elements.captureRulesInfo.textContent = `已加载 ${appState.captureRules.length} 条抓取规则`;
        elements.rulesList.innerHTML = appState.captureRules
            .map(rule => `
                <div class="rule-item">
                    <div class="rule-content">
                        <div class="rule-name">${escapeHtml(rule.name)}</div>
                        <div class="rule-pattern">${escapeHtml(rule.pattern)}</div>
                        <div class="rule-description">${escapeHtml(rule.description || '')}</div>
                    </div>
                    <div class="rule-priority">P${rule.priority || 0}</div>
                </div>
            `)
            .join('');
        elements.rulesList.style.display = 'block';
    } else {
        elements.captureRulesInfo.textContent = '暂无抓取规则';
        elements.rulesList.innerHTML = '';
        elements.rulesList.style.display = 'none';
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