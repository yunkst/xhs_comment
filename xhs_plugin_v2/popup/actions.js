import { appState } from './state.js';
import { updateAllUI, updateRequestStats, updateCaptureRulesDisplay, showToast, renderLog } from './ui.js';
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

export function loadRequestStats() {
    chrome.runtime.sendMessage({ action: 'getRequestStats' }, function(response) {
        if (response && response.stats) {
            appState.requestStats = response.stats;
            updateRequestStats();
        }
    });
}

export function loadCaptureRules() {
    chrome.runtime.sendMessage({ action: 'getCaptureRules' }, function(response) {
        appState.captureRules = response?.data || [];
        updateCaptureRulesDisplay();
    });
}

export function clearLogs() {
    chrome.runtime.sendMessage({ action: 'clearRequests' }, function(response) {
        if (response.success) {
            appState.currentRequestLog = [];
            filterAndDisplayLog();
            loadRequestStats();
            showToast('日志已清空', 'success');
        }
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

export function filterAndDisplayLog() {
    if (appState.currentFilter === 'all') {
        appState.filteredLog = appState.currentRequestLog;
    } else {
        appState.filteredLog = appState.currentRequestLog.filter(
            log => log.rule === appState.currentFilter
        );
    }
    renderLog();
} 