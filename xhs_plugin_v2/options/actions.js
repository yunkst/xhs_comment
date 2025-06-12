import { appState, elements } from './state.js';
import { updateApiUI, updateMonitoringUI, showStatus, setButtonLoading, updateCaptureRulesDisplay } from './ui.js';

/**
 * 从 chrome.storage 加载监控配置
 */
export function loadConfig() {
    chrome.storage.sync.get(['xhs_monitor_config'], (result) => {
        if (result.xhs_monitor_config) {
            appState.config = { ...appState.config, ...result.xhs_monitor_config };
        }
        updateMonitoringUI();
    });
}

/**
 * 从 chrome.storage 加载API配置
 */
export function loadApiConfig() {
    chrome.storage.local.get(['xhs_api_config'], (result) => {
        if (result.xhs_api_config) {
            appState.apiConfig = { ...appState.apiConfig, ...result.xhs_api_config };
        }
        updateApiUI();
        loadCaptureRules();
    });
}

/**
 * 保存监控配置
 */
export function saveConfig() {
    const newConfig = {
        enableMonitoring: elements.enableMonitoring.checked,
        enableEnhanced: elements.enableEnhanced.checked,
        maxLogSize: parseInt(elements.maxLogSize.value, 10),
        logRequestBody: elements.logRequestBody.checked,
        logResponseBody: elements.logResponseBody.checked,
    };
    chrome.storage.sync.set({ 'xhs_monitor_config': newConfig }, () => {
        appState.config = newConfig;
        showStatus('监控配置已保存', 'success');
    });
}

/**
 * 保存API配置（仅主机）
 */
export function saveApiConfig() {
    const apiHost = elements.apiHostInput.value.trim();
    if (!apiHost.startsWith('http')) {
        showStatus('API地址必须以http://或https://开头', 'error');
        return;
    }
    appState.apiConfig.host = apiHost;
    chrome.storage.local.set({ 'xhs_api_config': appState.apiConfig }, () => {
        updateApiUI();
        showStatus('API配置已保存', 'success');
    });
}

/**
 * 测试API连接
 */
export async function testApiConnection() {
    const apiHost = elements.apiHostInput.value.trim();
    
    if (!apiHost.startsWith('http')) {
        showStatus('API地址必须以http://或https://开头', 'error');
        return;
    }
    
    setButtonLoading(elements.testApiConnectionBtn, true, '测试中...');
    try {
        const response = await fetch(`${apiHost}/api/v1/system/health`);
        if (response.ok) {
            // 先保存配置（不显示消息）
            appState.apiConfig.host = apiHost;
            chrome.storage.local.set({ 'xhs_api_config': appState.apiConfig }, () => {
                updateApiUI();
            });
            // 然后显示成功消息
            showStatus('🎉 API连接成功！配置已自动保存', 'success');
        } else {
            showStatus(`❌ 连接失败: HTTP ${response.status}`, 'error');
        }
    } catch (error) {
        showStatus(`❌ 连接失败: ${error.message}`, 'error');
    } finally {
        setButtonLoading(elements.testApiConnectionBtn, false);
    }
}

/**
 * 执行登录
 */
export async function login() {
    console.log('开始执行登录函数');
    const { host } = appState.apiConfig;
    const username = elements.usernameInput.value.trim();
    const password = elements.passwordInput.value;
    const useOtp = elements.useOtpCheckbox.checked;
    const otpCode = elements.otpInput.value.trim();
    console.log('登录参数:', { host, username, password: '***', useOtp, otpCode });

    if (!host || !username || !password) {
        showStatus('请填写API地址、用户名和密码', 'error');
        return;
    }
    if (useOtp && !otpCode) {
        showStatus('请填写动态验证码', 'error');
        return;
    }

    setButtonLoading(elements.loginBtn, true, '登录中...');
    try {
        const loginUrl = `${host}/api/v1/user/auth/login`;
        const requestBody = {
            username,
            password,
            otp_code: useOtp ? otpCode : ''
        };
        console.log('发送登录请求到:', loginUrl);
        console.log('请求体:', { ...requestBody, password: '***' });
        
        const response = await fetch(loginUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        if (response.ok) {
            appState.apiConfig.token = data.access_token;
            // Assuming the backend might send a refresh token
            appState.apiConfig.refreshToken = data.refresh_token || appState.apiConfig.refreshToken;
            chrome.storage.local.set({ 'xhs_api_config': appState.apiConfig }, () => {
                showStatus('登录成功！', 'success');
                updateApiUI();
            });
        } else {
            showStatus(`登录失败: ${data.detail || '未知错误'}`, 'error');
        }
    } catch (error) {
        showStatus(`登录请求失败: ${error.message}`, 'error');
    } finally {
        setButtonLoading(elements.loginBtn, false);
    }
}

/**
 * 执行登出
 */
export function logout() {
    if (!confirm('确定要退出登录吗？')) return;
    appState.apiConfig.token = '';
    appState.apiConfig.refreshToken = '';
    chrome.storage.local.set({ 'xhs_api_config': appState.apiConfig }, () => {
        showStatus('已退出登录', 'success');
        updateApiUI();
    });
}

/**
 * 从后台加载抓取规则
 */
export function loadCaptureRules() {
    chrome.runtime.sendMessage({ action: 'getCaptureRules' }, (response) => {
        appState.captureRules = response?.data || [];
        updateCaptureRulesDisplay();
    });
} 