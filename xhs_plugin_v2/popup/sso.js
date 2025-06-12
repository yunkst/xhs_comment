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
        showToast('请先配置API地址', 'error');
        return;
    }
    // ... (rest of startSsoLogin logic)
}

export async function checkSsoLoginStatus(isAutoCheck = false) {
    if (!appState.ssoSession.id) {
        if (!isAutoCheck) showToast('没有正在进行的SSO会话', 'warn');
        return;
    }
    // ... (rest of checkSsoLoginStatus logic)
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