import { appState, elements } from './state.js';
import * as sso from './sso.js';
import { refreshCaptureRules } from './actions.js';
import { updateAllUI, showToast } from './ui.js';

let ssoPollingInterval = null;

function openOptionsPage(e) {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
}

/**
 * 处理SSO登录启动
 */
async function handleSsoLogin() {
    try {
        showToast('正在发起SSO登录...', 'info');
        
        const result = await sso.startSsoLogin();
        
        if (result.success) {
            showToast('请在新打开的页面中完成登录', 'success');
            startSsoPolling();
            updateAllUI();
        } else {
            showToast(`SSO登录失败: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('[Events] SSO登录失败:', error);
        showToast(`SSO登录失败: ${error.message}`, 'error');
    }
}

/**
 * 处理SSO状态检查
 */
async function handleSsoCheck() {
    try {
        showToast('正在检查登录状态...', 'info');
        
        const result = await sso.checkSsoLoginStatus();
        
        if (result.success) {
            if (result.status === 'completed') {
                showToast('SSO登录成功！', 'success');
                stopSsoPolling();
                updateAllUI();
            } else if (result.status === 'pending') {
                showToast('登录仍在进行中，请稍候...', 'info');
            }
        } else {
            showToast(`检查登录状态失败: ${result.error}`, 'error');
            if (result.error.includes('过期')) {
                stopSsoPolling();
                updateAllUI();
            }
        }
    } catch (error) {
        console.error('[Events] SSO状态检查失败:', error);
        showToast(`检查登录状态失败: ${error.message}`, 'error');
    }
}

/**
 * 处理登出
 */
async function handleLogout() {
    try {
        // 清理本地存储的认证信息
        appState.apiConfig.token = '';
        appState.apiConfig.refreshToken = '';
        appState.lastApiError = null;
        
        // 清理SSO会话
        await sso.clearSsoSession();
        stopSsoPolling();
        
        // 更新存储
        await chrome.storage.local.set({ 'xhs_api_config': appState.apiConfig });
        await chrome.storage.local.remove(['ssoSession']);
        
        // 更新UI
        updateAllUI();
        showToast('已成功登出', 'success');
        
    } catch (error) {
        console.error('[Events] 登出失败:', error);
        showToast(`登出失败: ${error.message}`, 'error');
    }
}

/**
 * 开始SSO状态轮询
 */
function startSsoPolling() {
    console.log('[Events] 开始SSO状态轮询');
    
    // 清除现有的轮询
    stopSsoPolling();
    
    // 每3秒检查一次SSO状态
    ssoPollingInterval = setInterval(async () => {
        try {
            const result = await sso.checkSsoLoginStatus();
            
            if (result.success) {
                if (result.status === 'completed') {
                    console.log('[Events] SSO登录完成，停止轮询');
                    showToast('SSO登录成功！', 'success');
                    stopSsoPolling();
                    updateAllUI();
                }
            } else {
                // 如果检查失败，停止轮询
                console.log('[Events] SSO状态检查失败，停止轮询:', result.error);
                stopSsoPolling();
            }
        } catch (error) {
            console.error('[Events] SSO轮询检查失败:', error);
            stopSsoPolling();
        }
    }, 3000);
}

/**
 * 停止SSO状态轮询
 */
function stopSsoPolling() {
    if (ssoPollingInterval) {
        console.log('[Events] 停止SSO状态轮询');
        clearInterval(ssoPollingInterval);
        ssoPollingInterval = null;
    }
}

export function setupEventListeners() {
    // 检查是否有正在进行的SSO会话，如果有则开始轮询
    chrome.storage.local.get(['ssoSession'], (result) => {
        if (result.ssoSession && result.ssoSession.status === 'pending') {
            console.log('[Events] 发现正在进行的SSO会话，开始轮询');
            startSsoPolling();
        }
    });
    
    // SSO登录相关事件
    elements.ssoStartLogin.addEventListener('click', handleSsoLogin);
    elements.ssoCheckLogin.addEventListener('click', handleSsoCheck);
    elements.logoutBtn.addEventListener('click', handleLogout);

    // 抓取规则刷新
    if (elements.refreshRulesBtn) {
        elements.refreshRulesBtn.addEventListener('click', refreshCaptureRules);
    }

    // 配置页面按钮
    if (elements.configPageBtn) {
        elements.configPageBtn.addEventListener('click', openOptionsPage);
    }

    // 当popup关闭时清理轮询
    window.addEventListener('beforeunload', () => {
        stopSsoPolling();
    });
} 