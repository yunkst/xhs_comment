import { appState } from './state.js';
import { updateAllUI, updateCaptureRulesDisplay, showToast } from './ui.js';
import * as sso from './sso.js';

export function loadApiConfig() {
    chrome.storage.local.get(['xhs_api_config'], function(result) {
        if (result.xhs_api_config) {
            appState.apiConfig = { ...appState.apiConfig, ...result.xhs_api_config };
        }
        updateAllUI();
    });
}

export function loadSsoSession() {
    chrome.storage.local.get(['xhs_sso_session'], function(result) {
        if (result.xhs_sso_session) {
            appState.ssoSession = { ...appState.ssoSession, ...result.xhs_sso_session };
            if (appState.ssoSession.status === 'pending' && appState.ssoSession.id) {
                sso.startSsoPolling();
            }
        }
    });
}

export function loadMonitorConfig() {
    chrome.storage.sync.get(['xhs_monitor_config'], function(result) {
        if (result.xhs_monitor_config) {
            appState.config = result.xhs_monitor_config;
        }
        updateAllUI();
    });
}

export function loadCaptureRules() {
    console.log('[Popup] 请求获取抓取规则...');
    chrome.runtime.sendMessage({ action: 'getCaptureRules' }, function(response) {
        console.log('[Popup] 收到抓取规则响应:', response);
        appState.captureRules = response?.data || [];
        console.log('[Popup] 设置抓取规则到状态:', appState.captureRules);
        updateCaptureRulesDisplay();
    });
}

export async function refreshCaptureRules() {
    showToast('正在刷新抓取规则...', 'info');
    chrome.runtime.sendMessage({ action: 'refreshRules' }, function(response) {
        if (response.success) {
            showToast('抓取规则已刷新', 'success');
            loadCaptureRules();
        } else {
            showToast(`刷新失败: ${response.error}`, 'error');
        }
    });
} 