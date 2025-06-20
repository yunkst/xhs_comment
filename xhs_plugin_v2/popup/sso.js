import { appState } from './state.js';
import { updateApiStatus, showToast, updateSsoButtons } from './ui.js';

function saveSsoSession() {
    chrome.storage.local.set({ 'xhs_sso_session': appState.ssoSession });
}

function clearSsoSession() {
    appState.ssoSession = { id: null, status: 'idle', pollInterval: null, pollCount: 0 };
    chrome.storage.local.remove('xhs_sso_session');
}

export function stopSsoPolling() {
    if (appState.ssoSession.pollInterval) {
        clearInterval(appState.ssoSession.pollInterval);
        appState.ssoSession.pollInterval = null;
    }
}

export async function startSsoLogin() {
    if (!appState.apiConfig.host) {
        showToast('请先在配置页面设置API地址', 'error');
        // 打开配置页面
        chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
        return;
    }
    
    try {
        showToast('正在发起SSO登录...', 'info');
        
        const ssoUrl = `${appState.apiConfig.host}/api/auth/sso/initiate`;
        const response = await fetch(ssoUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                returnUrl: chrome.runtime.getURL('popup.html')
            })
        });
        
        if (!response.ok) {
            throw new Error(`SSO初始化失败: ${response.status} ${response.statusText}`);
        }
        
        const ssoData = await response.json();
        
        if (!ssoData.ssoUrl || !ssoData.sessionId) {
            throw new Error('SSO响应数据不完整');
        }
        
        // 保存SSO会话信息
        appState.ssoSession.id = ssoData.sessionId;
        appState.ssoSession.status = 'pending';
        appState.ssoSession.pollCount = 0;
        saveSsoSession();
        
        // 打开SSO登录页面
        chrome.tabs.create({ url: ssoData.ssoUrl });
        
        // 开始轮询检查登录状态
        startSsoPolling();
        
        // 更新UI
        updateSsoButtons();
        showToast('请在新打开的页面中完成登录', 'success');
        
    } catch (error) {
        console.error('[SSO] 启动SSO登录失败:', error);
        showToast(`SSO登录失败: ${error.message}`, 'error');
        
        // 清理SSO会话状态
        clearSsoSession();
        updateSsoButtons();
    }
}

export async function checkSsoLoginStatus(isAutoCheck = false) {
    if (!appState.ssoSession.id) {
        if (!isAutoCheck) showToast('没有正在进行的SSO会话', 'warn');
        return;
    }
    
    if (!appState.apiConfig.host) {
        if (!isAutoCheck) showToast('API地址未配置', 'error');
        return;
    }
    
    try {
        const checkUrl = `${appState.apiConfig.host}/api/auth/sso/status/${appState.ssoSession.id}`;
        const response = await fetch(checkUrl);
        
        if (!response.ok) {
            throw new Error(`检查SSO状态失败: ${response.status} ${response.statusText}`);
        }
        
        const statusData = await response.json();
        
        if (statusData.status === 'completed' && statusData.token) {
            // 登录成功
            appState.apiConfig.token = statusData.token;
            appState.apiConfig.refreshToken = statusData.refreshToken || '';
            
            // 保存配置
            chrome.storage.local.set({ 'xhs_api_config': appState.apiConfig });
            
            // 清理SSO会话
            clearSsoSession();
            stopSsoPolling();
            
            // 更新UI
            updateApiStatus();
            updateSsoButtons();
            
            if (!isAutoCheck) {
                showToast('SSO登录成功！', 'success');
            }
        } else if (statusData.status === 'failed') {
            // 登录失败
            clearSsoSession();
            stopSsoPolling();
            updateSsoButtons();
            
            if (!isAutoCheck) {
                showToast('SSO登录失败', 'error');
            }
        } else if (statusData.status === 'pending') {
            // 仍在等待中
            if (!isAutoCheck) {
                showToast('登录仍在进行中，请稍候...', 'info');
            }
        }
        
    } catch (error) {
        console.error('[SSO] 检查SSO状态失败:', error);
        if (!isAutoCheck) {
            showToast(`检查登录状态失败: ${error.message}`, 'error');
        }
    }
}

export function startSsoPolling() {
    stopSsoPolling();
    appState.ssoSession.pollCount = 0;
    appState.ssoSession.pollInterval = setInterval(() => {
        appState.ssoSession.pollCount++;
        if (appState.ssoSession.pollCount > appState.ssoSession.maxPollCount) {
            stopSsoPolling();
            appState.ssoSession.status = 'failed';
            showToast('SSO登录超时', 'error');
            updateSsoButtons();
            saveSsoSession();
            return;
        }
        checkSsoLoginStatus(true);
    }, 3000);
}

export function logout() {
    appState.apiConfig.token = '';
    appState.apiConfig.refreshToken = '';
    chrome.storage.local.set({ 'xhs_api_config': appState.apiConfig }, () => {
        showToast('已退出登录', 'success');
        updateApiStatus();
    });
} 