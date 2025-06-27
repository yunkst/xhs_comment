/**
 * API服务模块 - 处理与后端的API交互
 */

// 全局变量，用于存储用户备注数据
let userNotes = {};

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
                        text: async () => JSON.stringify(response.data),
                        retried: response.retried || false
                    });
                } else {
                    // 特殊处理401错误
                    if (response.status === 401) {
                        reject(new Error('登录已过期，请重新登录或刷新token'));
                    } else {
                        reject(new Error(response.error || '代理请求失败'));
                    }
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
            throw new Error('未配置API令牌，请先登录');
        }
        
        const url = `${apiBaseUrl}/api/v1/content/comments/user/${userId}`;
        
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
            if (response.status === 401) {
                throw new Error('登录已过期，请重新登录');
            }
            throw new Error(`API请求失败 (${response.status}): ${errorText}`);
        }
        
        const data = await response.json();
        
        // 如果请求被重试过，显示提示
        if (response.retried) {
            console.log(`[API Service] Token已自动刷新，成功获取用户 ${userId} 的历史评论`);
        }
        
        console.log(`[API Service] 成功获取到用户 ${userId} 的历史评论:`, data);
        
        // 提取实际的评论数据数组
        if (data.success && Array.isArray(data.data)) {
            return data.data;
        } else {
            console.warn(`[API Service] API返回的数据格式不正确:`, data);
            return [];
        }
    } catch (error) {
        console.error(`[API Service] 获取用户 ${userId} 的历史评论时出错:`, error);
        
        // 提供更友好的错误信息
        if (error.message.includes('登录已过期')) {
            throw new Error('登录已过期，请在插件选项中重新登录');
        } else if (error.message.includes('未配置')) {
            throw new Error('请先在插件选项中配置API地址和登录');
        }
        
        throw error;
    }
}

// 从后端API获取用户备注数据
async function fetchUserNotes(userId) {
    try {
        console.log(`[API Service] 开始获取用户 ${userId} 的备注数据`);
        
        // 从storage获取API地址和令牌
        const { apiBaseUrl, apiToken } = await getApiConfig();
        
        if (!apiBaseUrl) {
            throw new Error('未配置API地址，请在插件选项中设置');
        }
        
        if (!apiToken) {
            throw new Error('未配置API令牌，请先登录');
        }
        
        const url = `${apiBaseUrl}/api/user-notes?user_id=${userId}`;
        
        console.log(`[API Service] 通过代理请求备注URL: ${url}`);
        
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
            if (response.status === 401) {
                console.warn(`[API Service] 获取用户备注时收到401，可能需要重新登录`);
                throw new Error('登录已过期，请重新登录');
            }
            throw new Error(`API请求失败 (${response.status}): ${errorText}`);
        }
        
        const data = await response.json();
        
        // 如果请求被重试过，显示提示
        if (response.retried) {
            console.log(`[API Service] Token已自动刷新，成功获取用户 ${userId} 的备注数据`);
        }
        
        console.log(`[API Service] 成功获取到用户 ${userId} 的备注数据:`, data);
        
        // 将备注数据转换为哈希表格式，方便查找
        const notesMap = {};
        if (data.success && Array.isArray(data.data)) {
            data.data.forEach(note => {
                notesMap[note.notificationHash] = note.noteContent;
                
                // 处理旧格式哈希兼容性
                if (note.notificationHash.split('_').length > 3) {
                    const hashParts = note.notificationHash.split('_');
                    const userId = hashParts[0];
                    const contentPart = hashParts.length > 1 ? hashParts[1] : '';
                    const typePart = hashParts.length > 2 ? hashParts[2] : '';
                    
                    const newFormatHash = `${userId}_${contentPart}_${typePart}`;
                    
                    if (!notesMap[newFormatHash] || !notesMap[newFormatHash].trim()) {
                        notesMap[newFormatHash] = note.noteContent;
                        console.log(`[API Service] 将旧格式哈希 ${note.notificationHash} 迁移到新格式 ${newFormatHash}`);
                    }
                }
            });
        }
        
        // 更新全局备注数据
        Object.assign(userNotes, notesMap);
        
        // 刷新页面上的备注显示
        if (window.xhsUserNotes && window.xhsUserNotes.refreshAllNoteInputs) {
            window.xhsUserNotes.refreshAllNoteInputs();
        }
        
        return notesMap;
    } catch (error) {
        console.error(`[API Service] 获取用户 ${userId} 的备注数据时出错:`, error);
        
        // 401错误不记录为普通错误，静默处理
        if (!error.message.includes('登录已过期')) {
            console.warn(`[API Service] 备注获取失败，将返回空对象: ${error.message}`);
        }
        
        return {};
    }
}

// 保存用户备注到后端
async function saveUserNote(userId, notificationHash, noteContent, content) {
    try {
        console.log(`[API Service] 开始保存用户 ${userId} 的备注数据`, { notificationHash, noteContent, content });
        
        // 检查是否是旧格式哈希，如果是则转换为新格式
        let finalHash = notificationHash;
        if (notificationHash.split('_').length > 3) {
            const hashParts = notificationHash.split('_');
            const userIdFromHash = hashParts[0];
            const contentPart = hashParts.length > 1 ? hashParts[1] : '';
            const typePart = hashParts.length > 2 ? hashParts[2] : '';

            finalHash = `${userIdFromHash}_${contentPart}_${typePart}`;
            console.log(`[API Service] 保存备注时将旧格式哈希 ${notificationHash} 转换为新格式 ${finalHash}`);
        }

        // 从storage获取API地址和令牌
        const { apiBaseUrl, apiToken } = await getApiConfig();

        if (!apiBaseUrl) {
            throw new Error('未配置API地址，请在插件选项中设置');
        }

        if (!apiToken) {
            throw new Error('未配置API令牌，请先登录');
        }

        const url = `${apiBaseUrl}/api/user-notes`;

        // 使用代理请求替代直接fetch
        const response = await proxyFetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json'
            },
            body: {
                userId: userId,
                notificationHash: finalHash,
                noteContent: noteContent,
                content: content
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            if (response.status === 401) {
                throw new Error('登录已过期，请重新登录');
            }
            throw new Error(`API请求失败 (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        
        // 如果请求被重试过，显示提示
        if (response.retried) {
            console.log(`[API Service] Token已自动刷新，成功保存用户 ${userId} 的备注数据`);
        }
        
        console.log(`[API Service] 成功保存用户 ${userId} 的备注数据:`, data);

        // 更新全局备注数据
        userNotes[finalHash] = noteContent;

        // 如果使用的是转换后的哈希值，也更新原始哈希对应的备注（向后兼容）
        if (finalHash !== notificationHash) {
            userNotes[notificationHash] = noteContent;
        }

        return true;
    } catch (error) {
        console.error(`[API Service] 保存用户 ${userId} 的备注数据时出错:`, error);
        
        // 提供更友好的错误信息
        if (error.message.includes('登录已过期')) {
            console.warn(`[API Service] 备注保存失败：登录已过期`);
        }
        
        return false;
    }
}

// 批量获取多个用户的备注数据
async function fetchUserNotesInBatch(userIds) {
    if (!userIds || userIds.length === 0) {
        console.log('[API Service] 没有提供用户ID，无法获取备注');
        return {};
    }
    
    try {
        console.log(`[API Service] 开始批量获取 ${userIds.length} 个用户的备注数据`);
        
        // 从storage获取API地址和令牌
        const { apiBaseUrl, apiToken } = await getApiConfig();
        
        if (!apiBaseUrl) {
            throw new Error('未配置API地址，请在插件选项中设置');
        }
        
        if (!apiToken) {
            throw new Error('未配置API令牌，请先登录');
        }
        
        // 构建批量请求URL (使用新的v1 API)
        const userIdsParam = userIds.join(',');
        const url = `${apiBaseUrl}/api/v1/user/notes/batch?user_ids=${userIdsParam}`;
        
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
            if (response.status === 401) {
                console.warn(`[API Service] 批量获取用户备注时收到401，可能需要重新登录`);
                throw new Error('登录已过期，请重新登录');
            }
            throw new Error(`API请求失败 (${response.status}): ${errorText}`);
        }
        
        const data = await response.json();
        
        // 如果请求被重试过，显示提示
        if (response.retried) {
            console.log(`[API Service] Token已自动刷新，成功批量获取 ${userIds.length} 个用户的备注数据`);
        }
        
        console.log(`[API Service] 成功批量获取到 ${userIds.length} 个用户的备注数据:`, data);
        
        // 处理兼容性：将旧格式哈希转换为新格式
        const processedData = {};
        if (data.success && data.data) {
            Object.keys(data.data).forEach(hashKey => {
                const noteContent = data.data[hashKey];
                processedData[hashKey] = noteContent;
                
                // 检查是否是旧格式的哈希值（包含时间）
                if (hashKey.split('_').length > 3) {
                    const hashParts = hashKey.split('_');
                    const userId = hashParts[0];
                    const contentPart = hashParts.length > 1 ? hashParts[1] : '';
                    const typePart = hashParts.length > 2 ? hashParts[2] : '';
                    
                    const newFormatHash = `${userId}_${contentPart}_${typePart}`;
                    
                    if (!processedData[newFormatHash] || !processedData[newFormatHash].trim()) {
                        processedData[newFormatHash] = noteContent;
                        console.log(`[API Service] 批量获取：将旧格式哈希 ${hashKey} 迁移到新格式 ${newFormatHash}`);
                    }
                }
            });
            
            // 合并所有用户的备注
            Object.assign(userNotes, processedData);
            
            // 刷新页面上的备注显示
            if (window.xhsUserNotes && window.xhsUserNotes.refreshAllNoteInputs) {
                window.xhsUserNotes.refreshAllNoteInputs();
            }
            
            console.log(`[API Service] 成功更新 ${Object.keys(processedData).length} 条备注数据`);
        }
        
        return processedData || {};
    } catch (error) {
        console.error(`[API Service] 批量获取用户备注数据时出错:`, error);
        
        // 401错误不记录为普通错误，静默处理
        if (!error.message.includes('登录已过期')) {
            console.warn(`[API Service] 批量备注获取失败，将返回空对象: ${error.message}`);
        }
        
        return {};
    }
}

// 在页面加载时初始化用户备注
async function initializeUserNotes() {
    try {
        console.log('[API Service] 开始初始化用户备注');
        
        // 等待页面加载完成
        await new Promise(resolve => {
            if (document.readyState === 'complete') {
                resolve();
            } else {
                window.addEventListener('load', resolve);
            }
        });
        
        // 获取所有显示的用户ID
        const userIds = getVisibleUserIds();
        
        if (!userIds.length) {
            console.log('[API Service] 未找到页面上的用户ID，暂不获取备注');
            return;
        }
        
        // 从storage获取API令牌
        const { apiToken } = await getApiConfig();
        
        if (!apiToken) {
            console.warn('[API Service] 未登录或未配置API令牌，无法获取备注');
            return;
        }
        
        // 批量获取所有用户备注
        console.log(`[API Service] 开始批量获取 ${userIds.length} 个用户的备注数据`);
        await fetchUserNotesInBatch(userIds);
        
    } catch (error) {
        console.error('[API Service] 初始化用户备注时出错:', error);
    }
}

// 获取页面上可见的用户ID
function getVisibleUserIds() {
    const userIds = new Set();
    
    // 查找用户链接
    const userLinks = document.querySelectorAll('a[href*="/user/profile/"]');
    userLinks.forEach(link => {
        const match = link.href.match(/\/user\/profile\/([a-zA-Z0-9]+)/);
        if (match && match[1]) {
            userIds.add(match[1]);
        }
    });
    
    return Array.from(userIds);
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
                    // 从globalState获取API配置信息
                    const globalState = response.globalState || {};
                    const apiConfig = globalState.apiConfig || {};
                    
                    // 使用host作为apiBaseUrl，token作为apiToken
                    const apiBaseUrl = apiConfig.host || 'http://localhost:8000';
                    const apiToken = apiConfig.token || '';
                    
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
    fetchUserNotes,
    saveUserNote,
    fetchUserNotesInBatch,
    initializeUserNotes,
    getApiConfig,
    testGetApiConfig,
    testProxyRequest,
    userNotes // 导出用户备注数据
};

export { 
    fetchUserHistoricalComments, 
    fetchUserNotes,
    saveUserNote,
    fetchUserNotesInBatch,
    initializeUserNotes,
    getApiConfig, 
    testGetApiConfig, 
    testProxyRequest 
}; 