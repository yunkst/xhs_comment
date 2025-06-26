import { appState, elements } from './state.js';
import * as sso from './sso.js';
import { clearLogs, refreshCaptureRules, filterAndDisplayLog } from './actions.js';
import { updateAllUI, showToast } from './ui.js';

let ssoPollingInterval = null;

function openPage(url) {
    chrome.tabs.create({ url });
}

function openOptionsPage(e) {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
}

function handleMessage(request, sender, sendResponse) {
    if (request.action === 'updateLog') {
        appState.currentRequestLog = request.data;
        filterAndDisplayLog();
    }
}

// 触发历史评论功能初始化
function triggerHistoryCommentsInit() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0] && tabs[0].url && tabs[0].url.includes('xiaohongshu.com/notification')) {
            console.log('[Popup] 检测到当前在通知页面，触发历史评论功能初始化');
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'initializeHistoryComments'
            }, function(response) {
                if (chrome.runtime.lastError) {
                    console.log('[Popup] 发送初始化消息失败:', chrome.runtime.lastError.message);
                } else {
                    console.log('[Popup] 历史评论功能初始化触发成功');
                }
            });
        }
    });
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
    // 在popup打开时触发历史评论功能初始化
    triggerHistoryCommentsInit();
    
    // 检查是否有正在进行的SSO会话，如果有则开始轮询
    chrome.storage.local.get(['ssoSession'], (result) => {
        if (result.ssoSession && result.ssoSession.status === 'pending') {
            console.log('[Events] 发现正在进行的SSO会话，开始轮询');
            startSsoPolling();
        }
    });
    
    elements.ssoStartLogin.addEventListener('click', handleSsoLogin);
    elements.ssoCheckLogin.addEventListener('click', handleSsoCheck);
    elements.logoutBtn.addEventListener('click', handleLogout);

    elements.viewLogsBtn.addEventListener('click', () => openPage(chrome.runtime.getURL('logs.html')));
    elements.clearLogsBtn.addEventListener('click', clearLogs);

    elements.configPageLink.addEventListener('click', openOptionsPage);
    elements.configLink.addEventListener('click', openOptionsPage);
    elements.helpLink.addEventListener('click', () => openPage('https://github.com/your-repo/issues')); // Replace with actual help link
    elements.aboutLink.addEventListener('click', () => openPage('https://github.com/your-repo')); // Replace with actual about link
    
    if (elements.refreshRulesBtn) {
        elements.refreshRulesBtn.addEventListener('click', refreshCaptureRules);
    }

    if (elements.filterSelect) {
        elements.filterSelect.addEventListener('change', function() {
            appState.currentFilter = this.value;
            filterAndDisplayLog();
        });
    }

    if (elements.optionsLink) {
        elements.optionsLink.addEventListener('click', openOptionsPage);
    }
    
    if (elements.logsLink) {
        elements.logsLink.addEventListener('click', (e) => {
            e.preventDefault();
            openPage(chrome.runtime.getURL('logs.html'));
        });
    }

    chrome.runtime.onMessage.addListener(handleMessage);

    window.addEventListener('beforeunload', () => {
        stopSsoPolling();
    });
} 

// 导出轮询控制函数供其他模块使用
export { startSsoPolling, stopSsoPolling }; 