import { globalState } from '../shared/state.js';
import { setupWebRequestListeners } from './webRequest.js';

/**
 * 从后端加载抓取规则
 * @returns {Promise<void>}
 */
export async function loadCaptureRules() {
    try {
        if (!globalState.apiConfig?.host) {
            throw new Error('未配置API地址');
        }

        console.log('[Background] 开始从后端加载抓取规则...');
        
        const response = await fetch(`${globalState.apiConfig.host}/api/v1/system/capture-rules`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`获取抓取规则失败: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success && data.rules) {
            globalState.captureRules = data.rules;
            console.log(`[Background] 成功加载 ${data.rules.length} 条抓取规则:`, 
                data.rules.map(r => `${r.name}: ${r.pattern}`));
            
            // 重新设置WebRequest监听器
            setupWebRequestListeners();
        } else {
            throw new Error(`获取抓取规则失败: ${data.error || '未知错误'}`);
        }

    } catch (error) {
        console.error('[Background] 加载抓取规则时出错:', error);
        if (error.message === '未配置API地址') {
            globalState.captureRules = [];
            console.log('[Background] 未配置API地址，使用空抓取规则');
            return;
        }
        throw error;
    }
}

/**
 * 上传网络数据到后端
 * @param {object} details - 请求详情
 * @param {object} matchedRule - 匹配到的抓取规则
 */
export async function uploadNetworkData(details, matchedRule) {
    if (!globalState.apiConfig?.host) {
        return;
    }

    try {
        const payload = {
            rule_name: matchedRule.name,
            url: details.url,
            method: details.method,
            status_code: details.statusCode,
            request_headers: details.requestHeaders || [],
            response_headers: details.responseHeaders || [],
            request_body: details.requestBody ? new TextDecoder().decode(details.requestBody.raw[0].bytes) : null,
            // 响应体需要在其他地方获取并更新
            timestamp: new Date(details.timeStamp).toISOString()
        };

        const response = await fetch(`${globalState.apiConfig.host}/api/v1/system/network-data`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${globalState.apiConfig.token}`
            },
            body: JSON.stringify(payload)
        });

        if (response.status === 401) {
            await refreshApiToken();
            // 重试
            await uploadNetworkData(details, matchedRule);
        }

    } catch (error) {
        console.error('[Background] 上传网络数据失败:', error);
    }
}

/**
 * 刷新API令牌
 * @returns {Promise<void>}
 */
export async function refreshApiToken() {
    if (!globalState.apiConfig?.host || !globalState.apiConfig.refreshToken) {
        console.log('[Background] 无法刷新令牌：缺少API主机或刷新令牌');
        return;
    }
    
    try {
        console.log('[Background] 尝试刷新API令牌...');
        const response = await fetch(`${globalState.apiConfig.host}/api/v1/user/auth/sso-refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ refresh_token: globalState.apiConfig.refreshToken })
        });

        if (!response.ok) {
            throw new Error(`刷新令牌失败: ${response.status}`);
        }

        const data = await response.json();

        if (data.access_token && data.refresh_token) {
            globalState.apiConfig.token = data.access_token;
            globalState.apiConfig.refreshToken = data.refresh_token;

            // 保存新的凭据
            chrome.storage.local.set({ 'xhs_api_config': globalState.apiConfig });
            console.log('[Background] API令牌刷新成功');
        } else {
            console.error('[Background] 刷新令牌响应格式不正确');
        }

    } catch (error) {
        console.error('[Background] 刷新API令牌时出错:', error);
    }
} 