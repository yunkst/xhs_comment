/**
 * API服务模块 - 处理与后端的API交互
 */

// 代理fetch请求，避免CORS问题
async function proxyFetch(url, options = {}) {
    const requestId = Math.random().toString(36).substr(2, 9);
    const requestData = {
        url: url,
        options: {
            method: options.method || 'GET',
            headers: options.headers || {},
            body: options.body ? JSON.stringify(options.body) : undefined
        },
        requestId: requestId
    };
    
    console.log(`[API Service] 发送代理请求:`, requestData);
    
    return new Promise((resolve, reject) => {
        // 设置超时
        const timeout = setTimeout(() => {
            document.removeEventListener('XHS_PROXY_RESPONSE', responseHandler);
            reject(new Error('代理请求超时'));
        }, 30000); // 30秒超时
        
        // 监听响应
        const responseHandler = (event) => {
            const response = event.detail;
            console.log(`[API Service] 收到代理响应:`, response);
            
            if (response.requestId === requestId) {
                clearTimeout(timeout);
                document.removeEventListener('XHS_PROXY_RESPONSE', responseHandler);
                
                if (response.success) {
                    resolve({
                        ok: response.status < 400,
                        status: response.status,
                        json: async () => response.data,
                        text: async () => JSON.stringify(response.data)
                    });
                } else {
                    reject(new Error(response.error || '代理请求失败'));
                }
            }
        };
        
        document.addEventListener('XHS_PROXY_RESPONSE', responseHandler);
        
        // 发送给content script
        const event = new CustomEvent('XHS_PROXY_REQUEST', {
            detail: requestData
        });
        document.dispatchEvent(event);
    });
}

// 从后端API获取用户历史评论
async function fetchUserHistoricalComments(userId) {
    try {
        console.log(`[API Service] 开始获取用户 ${userId} 的历史评论`);
        
        // 从storage获取API地址和令牌
        const { apiBaseUrl, apiToken } = await getApiConfig();
        
        if (!apiBaseUrl) {
            throw new Error('未配置API地址，请在插件选项中设置');
        }
        
        if (!apiToken) {
            throw new Error('未配置API令牌，请在插件选项中设置');
        }
        
        const url = `${apiBaseUrl}/api/comments/user/${userId}`;
        
        console.log(`[API Service] 通过代理请求URL: ${url}`);
        
        // 使用代理请求替代直接fetch
        const response = await proxyFetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API请求失败 (${response.status}): ${errorText}`);
        }
        
        const data = await response.json();
        console.log(`[API Service] 成功获取到用户 ${userId} 的历史评论:`, data);
        return data;
    } catch (error) {
        console.error(`[API Service] 获取用户 ${userId} 的历史评论时出错:`, error);
        throw error;
    }
}

// 从storage获取API配置
function getApiConfig() {
    return new Promise((resolve, reject) => {
        const requestId = Math.random().toString(36).substr(2, 9);
        
        console.log(`[API Service] 请求获取API配置, requestId: ${requestId}`);
        
        // 设置超时
        const timeout = setTimeout(() => {
            document.removeEventListener('XHS_CONFIG_RESPONSE', configHandler);
            reject(new Error('获取API配置超时'));
        }, 10000); // 10秒超时
        
        const configHandler = (event) => {
            const response = event.detail;
            console.log(`[API Service] 收到配置响应:`, response);
            
            if (response.requestId === requestId) {
                clearTimeout(timeout);
                document.removeEventListener('XHS_CONFIG_RESPONSE', configHandler);
                
                if (response.success) {
                    // 默认API地址，如果未配置则使用默认值
                    const apiBaseUrl = response.config.apiBaseUrl || 'http://localhost:8000';
                    const apiToken = response.config.apiToken || '';
                    
                    console.log(`[API Service] API配置获取成功: ${apiBaseUrl}, token: ${apiToken ? '已设置' : '未设置'}`);
                    resolve({ apiBaseUrl, apiToken });
                } else {
                    reject(new Error(response.error || '获取配置失败'));
                }
            }
        };
        
        document.addEventListener('XHS_CONFIG_RESPONSE', configHandler);
        
        // 通过事件与content script通信获取配置
        const event = new CustomEvent('XHS_GET_CONFIG', {
            detail: { requestId: requestId }
        });
        document.dispatchEvent(event);
    });
}

// 测试API配置获取功能
async function testGetApiConfig() {
    try {
        console.log('[API Service] 开始测试API配置获取...');
        const config = await getApiConfig();
        console.log('[API Service] 测试 - API配置获取成功:', config);
        return config;
    } catch (error) {
        console.error('[API Service] 测试 - API配置获取失败:', error);
        throw error;
    }
}

// 测试代理请求功能
async function testProxyRequest() {
    try {
        console.log('[API Service] 开始测试代理请求功能...');
        
        // 获取配置
        const config = await getApiConfig();
        console.log('[API Service] 测试 - 获取到配置:', config);
        
        // 测试一个简单的GET请求
        const testUrl = `${config.apiBaseUrl}/api/v1/system/capture-rules`;
        console.log('[API Service] 测试 - 发送测试请求到:', testUrl);
        
        const response = await proxyFetch(testUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${config.apiToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        console.log('[API Service] 测试 - 代理请求成功:', data);
        return data;
    } catch (error) {
        console.error('[API Service] 测试 - 代理请求失败:', error);
        throw error;
    }
}

// 导出API服务
window.xhsApiService = {
    fetchUserHistoricalComments,
    getApiConfig,
    testGetApiConfig,
    testProxyRequest
};

export { fetchUserHistoricalComments, getApiConfig, testGetApiConfig, testProxyRequest }; 