import { appState } from './state.js';
import { updateApiStatus, showToast, updateSsoButtons } from './ui.js';
import { getApiConfig } from './state.js';

function saveSsoSession() {
    chrome.storage.local.set({ 'xhs_sso_session': appState.ssoSession });
}

function clearSsoSession() {
    appState.ssoSession = { 
        id: null, 
        status: 'idle', 
        pollInterval: null, 
        pollCount: 0,
        maxPollCount: 60,
        apiVersion: 'v1'
    };
    chrome.storage.local.remove('xhs_sso_session');
}

export function stopSsoPolling() {
    if (appState.ssoSession.pollInterval) {
        clearInterval(appState.ssoSession.pollInterval);
        appState.ssoSession.pollInterval = null;
    }
}

/**
 * 启动SSO登录流程
 */
export async function startSsoLogin() {
    try {
        const apiConfig = getApiConfig();
        if (!apiConfig.baseUrl) {
            throw new Error('API配置未设置');
        }

        console.log('[SSO] 开始SSO登录流程...');
        
        // 优先使用新版API，失败时降级到旧版
        let response;
        let apiVersion = 'v1';
        
        try {
            // 尝试新版API
            response = await fetch(`${apiConfig.baseUrl}/api/v1/user/auth/sso-session`, {
            method: 'POST',
            headers: {
                    'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                    client_type: 'plugin'
            })
        });
            
            if (!response.ok) {
                throw new Error(`新版API失败: ${response.status}`);
            }
        } catch (error) {
            console.log('[SSO] 新版API失败，尝试旧版API:', error.message);
            apiVersion = 'legacy';
            
            // 降级到旧版API
            response = await fetch(`${apiConfig.baseUrl}/api/auth/sso-session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    client_type: 'plugin'
                })
            });
        }
        
        if (!response.ok) {
            throw new Error(`SSO会话创建失败: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('[SSO] SSO会话创建成功:', data);

        // 适配不同API版本的响应字段
        const sessionId = data.session_id;
        const loginUrl = data.initiate_url || data.login_url; // 新版用initiate_url，旧版用login_url

        if (!sessionId || !loginUrl) {
            throw new Error('服务器响应缺少必要字段');
        }
        
        // 更新状态
        chrome.storage.local.set({
            ssoSession: {
                sessionId: sessionId,
                status: 'pending',
                loginUrl: loginUrl,
                createdAt: Date.now(),
                apiVersion: apiVersion
            }
        });
        
        // 打开登录页面
        chrome.tabs.create({ url: loginUrl });

        return {
            success: true,
            sessionId: sessionId,
            loginUrl: loginUrl
        };
        
    } catch (error) {
        console.error('[SSO] SSO登录启动失败:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 检查SSO登录状态
 */
export async function checkSsoLoginStatus() {
    try {
        const result = await chrome.storage.local.get(['ssoSession']);
        const ssoSession = result.ssoSession;

        if (!ssoSession || !ssoSession.sessionId) {
            return { success: false, error: 'No active SSO session' };
    }
    
        const apiConfig = getApiConfig();
        if (!apiConfig.baseUrl) {
            throw new Error('API配置未设置');
        }

        console.log('[SSO] 检查SSO登录状态，会话ID:', ssoSession.sessionId);

        // 根据记录的API版本选择端点
        const endpoint = ssoSession.apiVersion === 'v1' 
            ? `/api/v1/user/auth/sso-session/${ssoSession.sessionId}`
            : `/api/auth/sso-session/${ssoSession.sessionId}`;

        const response = await fetch(`${apiConfig.baseUrl}${endpoint}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (!response.ok) {
            throw new Error(`状态检查失败: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('[SSO] SSO状态检查响应:', data);
        
        if (data.status === 'completed' && data.tokens) {
            // 登录成功，保存令牌
            const tokens = data.tokens;
            const newApiConfig = {
                ...apiConfig,
                token: tokens.access_token,
                refreshToken: tokens.refresh_token || null,
                tokenType: tokens.token_type || 'bearer'
            };

            await chrome.storage.local.set({ 
                'xhs_api_config': newApiConfig,
                ssoSession: {
                    ...ssoSession,
                    status: 'completed',
                    completedAt: Date.now()
                }
            });

            console.log('[SSO] SSO登录完成，令牌已保存');
            return {
                success: true,
                status: 'completed',
                tokens: tokens
            };
        } else if (data.status === 'pending') {
            return {
                success: true,
                status: 'pending'
            };
        } else if (data.status === 'expired') {
            // 会话过期，清理状态
            await chrome.storage.local.remove(['ssoSession']);
            return {
                success: false,
                error: 'SSO会话已过期'
            };
        } else {
            return {
                success: false,
                error: `未知状态: ${data.status}`
            };
        }
        
    } catch (error) {
        console.error('[SSO] SSO状态检查失败:', error);
        return {
            success: false,
            error: error.message
        };
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