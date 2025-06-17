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
        
        const headers = { 'Content-Type': 'application/json' };
        
        // 如果有认证令牌，添加到请求头
        if (globalState.apiConfig.token) {
            headers['Authorization'] = `Bearer ${globalState.apiConfig.token}`;
        }
        
        const response = await fetch(`${globalState.apiConfig.host}/api/v1/system/capture-rules`, {
            method: 'GET',
            headers: headers
        });

        if (response.status === 401) {
            console.log('[Background] 获取抓取规则时收到401，尝试刷新令牌...');
            await refreshApiToken();
            
            // 重新构建请求头
            const retryHeaders = { 'Content-Type': 'application/json' };
            if (globalState.apiConfig.token) {
                retryHeaders['Authorization'] = `Bearer ${globalState.apiConfig.token}`;
            }
            
            // 重试请求
            const retryResponse = await fetch(`${globalState.apiConfig.host}/api/v1/system/capture-rules`, {
                method: 'GET',
                headers: retryHeaders
            });
            
            if (!retryResponse.ok) {
                throw new Error(`重试获取抓取规则失败: ${retryResponse.status}`);
            }
            
            // 使用重试的响应
            const retryData = await retryResponse.json();
            if (retryData.success && retryData.rules) {
                globalState.captureRules = retryData.rules;
                console.log(`[Background] 重试成功，加载 ${retryData.rules.length} 条抓取规则:`, 
                    retryData.rules.map(r => `${r.name}: ${r.pattern}`));
                
                // 重新设置WebRequest监听器
                setupWebRequestListeners();
            } else {
                throw new Error(`重试获取抓取规则失败: ${retryData.error || '未知错误'}`);
            }
            return;
        }
        
        if (!response.ok) {
            throw new Error(`获取抓取规则失败: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success && data.rules) {
            globalState.captureRules = data.rules;
            console.log(`[Background] 成功加载 ${data.rules.length} 条抓取规则:`, 
                data.rules.map(r => `${r.name}: ${r.pattern}`));
            console.log(`[Background] 全局状态中的抓取规则:`, globalState.captureRules);
            
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
 * 解码 ArrayBuffer 为字符串
 * @param {ArrayBuffer} buffer - ArrayBuffer.
 * @returns {string} - Decoded string.
 */
function decodeArrayBuffer(buffer) {
    if (!buffer) return null;
    try {
        const decoder = new TextDecoder('utf-8');
        return decoder.decode(buffer);
    } catch (e) {
        console.error('Failed to decode ArrayBuffer:', e);
        return null;
    }
}

/**
 * 上传网络数据到后端
 * @param {object} details - 请求详情，应包含响应数据
 * @param {object} matchedRule - 匹配到的抓取规则
 */
export async function uploadNetworkData(details, matchedRule) {
    if (!globalState.apiConfig?.host || !globalState.apiConfig.token) {
        console.warn('[Background] 无法上传网络数据：缺少API主机或认证令牌');
        return;
    }

    // 确保有响应体
    if (!details.responseBody) {
        console.warn('[Background] 无法上传网络数据：缺少响应体。URL:', details.url);
        return;
    }

    try {
        console.log('[Background] 准备上传网络数据，URL:', details.url);
        
        // Helper to safely convert headers array to object
        const headersToObject = (headers) => {
            if (!Array.isArray(headers)) return {};
            try {
                return Object.fromEntries(headers.map(h => [h.name, h.value]));
            } catch (e) {
                console.error('Failed to convert headers to object:', e, headers);
                return {};
            }
        };

        const decodedRequestBody = details.requestBody ? decodeArrayBuffer(details.requestBody.raw?.[0]?.bytes) : null;
        
        // 构建符合后端 RawNetworkData 模型的 payload
        const payload = {
            rule_name: matchedRule.name,
            url: details.url,
            method: details.method,
            status_code: details.statusCode,
            request_headers: headersToObject(details.requestHeaders),
            response_headers: headersToObject(details.responseHeaders),
            request_body: decodedRequestBody,
            response_body: details.responseBody,
            timestamp: new Date(details.timeStamp || Date.now()).toISOString(),
            request_id: details.requestId
        };
        
        console.log('[Background] 上传 Payload:', payload);

        const response = await fetch(`${globalState.apiConfig.host}/api/v1/system/network-data/upload`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${globalState.apiConfig.token}`
            },
            body: JSON.stringify(payload)
        });

        if (response.status === 401) {
            console.warn('[Background] 上传数据时收到401，尝试刷新令牌并重试...');
            await refreshApiToken();
            // 重试时需要重新获取 token，因此直接再次调用即可
            await uploadNetworkData(details, matchedRule);
            return; // 避免执行下面的逻辑
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: response.statusText }));
            throw new Error(`上传失败: ${response.status} - ${errorData.detail || '未知错误'}`);
        }

        const result = await response.json();
        if (result.success) {
            console.log(`[Background] 网络数据上传成功，URL: ${details.url}, 保存条目: ${result.items_saved}`);
        } else {
            console.error(`[Background] 网络数据上传后，后端处理失败: ${result.error_message}`);
        }

    } catch (error) {
        console.error('[Background] 上传网络数据时发生严重错误:', error);
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