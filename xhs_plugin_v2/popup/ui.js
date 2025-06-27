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
    
    // 重置所有状态类
    elements.apiStatusIndicator.classList.remove('connected', 'token-expired');
    elements.apiStatusIndicator.style.backgroundColor = '';
    
    if (hasHost && hasToken) {
        if (tokenMaybeExpired) {
            // Token可能已过期 - 显示警告状态
            console.log('[Popup UI] Token可能已过期，显示重新登录界面');
            elements.apiStatusIndicator.classList.add('token-expired');
            elements.apiStatusText.textContent = `登录已过期，请重新登录`;
            elements.ssoContainer.style.display = 'block';
            elements.logoutContainer.classList.remove('show');
            updateSsoButtons();
        } else {
            // 正常连接状态
            elements.apiStatusIndicator.classList.add('connected');
            elements.apiStatusText.textContent = `API已连接: ${appState.apiConfig.host.substring(0, 20)}... (已登录)`;
            elements.ssoContainer.style.display = 'none';
            elements.logoutContainer.classList.add('show');
        }
    } else if (hasHost) {
        // 有API地址但无token
        elements.apiStatusText.textContent = `API已配置: ${appState.apiConfig.host.substring(0, 20)}... (未登录)`;
        elements.ssoContainer.style.display = 'block';
        elements.logoutContainer.classList.remove('show');
        updateSsoButtons();
    } else {
        // 没有API地址
        elements.apiStatusText.textContent = '未配置API服务';
        elements.ssoContainer.style.display = 'block';
        elements.logoutContainer.classList.remove('show');
        updateSsoButtons();
    }
}

export function updateSsoButtons() {
    const hasHost = !!appState.apiConfig.host;
    
    // 检查是否有正在进行的SSO会话
    chrome.storage.local.get(['ssoSession'], (result) => {
        const ssoSession = result.ssoSession;
        
        if (ssoSession && ssoSession.status === 'pending') {
            // 有正在进行的SSO会话
            elements.ssoCheckLogin.style.display = 'block';
            elements.ssoCheckLogin.classList.remove('hidden');
            elements.ssoStartLogin.innerHTML = '重新发起SSO登录';
            elements.ssoStartLogin.disabled = false;
            elements.ssoCheckLogin.disabled = false;
        } else {
            // 没有正在进行的SSO会话
            elements.ssoCheckLogin.style.display = 'none';
            
            if (hasHost) {
                elements.ssoStartLogin.innerHTML = '单点登录';
                elements.ssoStartLogin.disabled = false;
            } else {
                elements.ssoStartLogin.innerHTML = '先配置API地址';
                elements.ssoStartLogin.disabled = true;
            }
        }
    });
}

export function updateConfigWarning() {
    // 简化警告逻辑：只在没有API配置且没有抓取规则时显示
    const hasApiConfig = !!appState.apiConfig.host;
    const hasRules = appState.captureRules && appState.captureRules.length > 0;
    
    if (!hasApiConfig && !hasRules) {
        elements.configWarning.style.display = 'block';
        elements.configWarning.textContent = '请先配置API服务地址';
    } else {
        elements.configWarning.style.display = 'none';
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

export function updateAllUI() {
    updateApiStatus();
    updateConfigWarning();
    updateCaptureRulesDisplay();
} 