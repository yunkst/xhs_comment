// 小红书网络监控插件 - 后台脚本
(function() {
    'use strict';

    // 全局状态
    let globalState = {
        requestLog: [],
        config: null,
        apiConfig: null,
        captureRules: [], // 从后端获取的抓取规则
        requestStats: {
            total: 0,
            today: 0,
            lastResetDate: new Date().toDateString()
        }
    };

    // 默认配置（保留作为后备）
    const DEFAULT_CONFIG = {
        enableMonitoring: true,
        enableEnhanced: true,
        maxLogSize: 1000,
        logRequestBody: true,
        logResponseBody: true
    };

    // 初始化
    chrome.runtime.onInstalled.addListener(function(details) {
        console.log('[XHS Monitor Background] 插件已安装/更新:', details.reason);
        initializePlugin();
    });

    chrome.runtime.onStartup.addListener(function() {
        console.log('[XHS Monitor Background] 浏览器启动，初始化插件');
        initializePlugin();
    });

    // 初始化插件
    async function initializePlugin() {
        loadConfig();
        await loadApiConfig(); // 等待API配置加载完成
        loadRequestStats();
        await loadCaptureRules(); // 等待抓取规则加载完成
        setupWebRequestListeners();
    }

    // 加载配置
    function loadConfig() {
        chrome.storage.sync.get(['xhs_monitor_config'], function(result) {
            if (result.xhs_monitor_config) {
                globalState.config = { ...DEFAULT_CONFIG, ...result.xhs_monitor_config };
            } else {
                globalState.config = { ...DEFAULT_CONFIG };
            }
            console.log('[Background] 配置已加载:', globalState.config);
        });
    }

    // 加载API配置
    function loadApiConfig() {
        return new Promise((resolve) => {
        chrome.storage.local.get(['xhs_api_config'], function(result) {
            if (result.xhs_api_config) {
                globalState.apiConfig = result.xhs_api_config;
            } else {
                globalState.apiConfig = { host: '', token: '', refreshToken: '' };
            }
            console.log('[Background] API配置已加载:', {
                hasHost: !!globalState.apiConfig.host,
                hasToken: !!globalState.apiConfig.token
                });
                resolve();
            });
        });
    }

    // 从后端加载抓取规则
    async function loadCaptureRules() {
        try {
            // 如果没有配置API地址，抛出错误
            if (!globalState.apiConfig?.host) {
                throw new Error('未配置API地址');
            }

            console.log('[Background] 开始从后端加载抓取规则...');
            
            const response = await fetch(`${globalState.apiConfig.host}/api/v1/system/capture-rules`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
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
            // 对于初始化过程中的调用，使用默认规则作为后备
            // 对于手动刷新，重新抛出错误以便上层处理
            if (error.message === '未配置API地址') {
                // 对于未配置API地址的情况，使用空规则
            globalState.captureRules = [];
                console.log('[Background] 未配置API地址，使用空抓取规则');
                return;
            }
            // 重新抛出其他错误，让调用者处理
            throw error;
        }
    }

    // 加载请求统计
    function loadRequestStats() {
        chrome.storage.local.get(['xhs_request_stats'], function(result) {
            if (result.xhs_request_stats) {
                globalState.requestStats = result.xhs_request_stats;
                
                // 检查是否需要重置今日统计
                const today = new Date().toDateString();
                if (globalState.requestStats.lastResetDate !== today) {
                    globalState.requestStats.today = 0;
                    globalState.requestStats.lastResetDate = today;
                    saveRequestStats();
                }
            }
            console.log('[Background] 请求统计已加载:', globalState.requestStats);
        });
    }

    // 保存请求统计
    function saveRequestStats() {
        chrome.storage.local.set({
            'xhs_request_stats': globalState.requestStats
        });
    }

    // 设置WebRequest监听器
    function setupWebRequestListeners() {
        // 清除之前的监听器
        if (chrome.webRequest.onBeforeRequest.hasListeners()) {
            chrome.webRequest.onBeforeRequest.removeListener(handleBeforeRequest);
        }
        if (chrome.webRequest.onCompleted.hasListeners()) {
            chrome.webRequest.onCompleted.removeListener(handleRequestCompleted);
        }
        if (chrome.webRequest.onErrorOccurred.hasListeners()) {
            chrome.webRequest.onErrorOccurred.removeListener(handleRequestError);
        }

        // 监听请求开始
        chrome.webRequest.onBeforeRequest.addListener(
            handleBeforeRequest,
            { urls: ['<all_urls>'] },
            ['requestBody']
        );

        // 监听请求完成
        chrome.webRequest.onCompleted.addListener(
            handleRequestCompleted,
            { urls: ['<all_urls>'] },
            ['responseHeaders']
        );

        // 监听请求错误
        chrome.webRequest.onErrorOccurred.addListener(
            handleRequestError,
            { urls: ['<all_urls>'] }
        );

        console.log('[Background] WebRequest监听器已设置');
    }

    // 处理请求开始
    function handleBeforeRequest(details) {
        // 添加调试日志 - 显示所有请求
        if (details.url.includes('xiaohongshu.com') || details.url.includes('xhscdn.com') || details.url.includes('fegine.com')) {
            console.log('[Background] 检测到小红书相关请求:', details.url);
        }

        if (!globalState.config || !globalState.config.enableMonitoring) {
            console.log('[Background] 监控未启用，跳过请求:', details.url);
            return;
        }

        // 检查URL是否匹配抓取规则
        const matchedRule = findMatchingRule(details.url);
        if (!matchedRule) {
            // 添加调试日志 - 显示未匹配的小红书请求
            if (details.url.includes('xiaohongshu.com') || details.url.includes('xhscdn.com') || details.url.includes('fegine.com')) {
                console.log('[Background] 小红书请求未匹配任何规则:', details.url);
                console.log('[Background] 当前抓取规则数量:', globalState.captureRules.length);
                console.log('[Background] 当前抓取规则:', globalState.captureRules.map(r => `${r.name}: ${r.pattern}`));
            }
            return;
        }

        // 记录请求
        logRequest(details, 'webRequest', matchedRule);
    }

    // 处理请求完成
    function handleRequestCompleted(details) {
        if (!globalState.config || !globalState.config.enableMonitoring) {
            return;
        }

        const matchedRule = findMatchingRule(details.url);
        if (!matchedRule) {
            return;
        }

        // 更新请求记录
        updateRequestLog(details.requestId, {
            statusCode: details.statusCode,
            responseHeaders: details.responseHeaders,
            timeStamp: details.timeStamp
        });

        // 上传网络数据到后端
        uploadNetworkData(details, matchedRule);
    }

    // 处理请求错误
    function handleRequestError(details) {
        if (!globalState.config || !globalState.config.enableMonitoring) {
            return;
        }

        const matchedRule = findMatchingRule(details.url);
        if (!matchedRule) {
            return;
        }

        // 更新请求记录
        updateRequestLog(details.requestId, {
            error: details.error,
            timeStamp: details.timeStamp
        });
    }

    // 查找匹配的抓取规则
    function findMatchingRule(url) {
        if (!globalState.captureRules || globalState.captureRules.length === 0) {
            console.log('[Background] 没有抓取规则');
            return null;
        }

        // 按优先级排序，找到第一个匹配的规则
        const sortedRules = globalState.captureRules
            .filter(rule => rule.enabled)
            .sort((a, b) => b.priority - a.priority);

        console.log(`[Background] 尝试匹配URL: ${url}`);
        console.log(`[Background] 启用的规则数量: ${sortedRules.length}`);

        for (const rule of sortedRules) {
            console.log(`[Background] 测试规则: ${rule.name} (${rule.pattern})`);
            if (matchUrlPattern(url, rule.pattern)) {
                console.log(`[Background] ✅ 匹配成功: ${rule.name}`);
                return rule;
            } else {
                console.log(`[Background] ❌ 匹配失败: ${rule.name}`);
            }
        }

        console.log('[Background] 没有规则匹配此URL');
        return null;
    }

    // URL模式匹配函数
    function matchUrlPattern(url, pattern) {
        try {
            const regexPattern = pattern
                .replace(/\./g, '\\.')
                .replace(/\*/g, '.*')
                .replace(/\?/g, '\\?');
            
            const regex = new RegExp('^' + regexPattern + '$', 'i');
            return regex.test(url);
        } catch (error) {
            console.error('[Background] URL模式匹配错误:', error, pattern);
            return false;
        }
    }

    // 记录请求
    function logRequest(details, source, matchedRule) {
        const requestData = {
            requestId: details.requestId,
            url: details.url,
            method: details.method,
            type: details.type,
            timestamp: details.timeStamp,
            timeString: new Date(details.timeStamp).toLocaleString('zh-CN'),
            source: source,
            tabId: details.tabId,
            frameId: details.frameId,
            requestHeaders: details.requestHeaders || [],
            requestBody: details.requestBody || null,
            matchedRule: matchedRule ? {
                name: matchedRule.name,
                pattern: matchedRule.pattern,
                data_type: matchedRule.data_type
            } : null
        };

        // 添加到日志
        globalState.requestLog.unshift(requestData);

        // 限制日志大小
        const maxSize = globalState.config?.maxLogSize || 1000;
        if (globalState.requestLog.length > maxSize) {
            globalState.requestLog = globalState.requestLog.slice(0, maxSize);
        }

        // 更新统计
        updateRequestStats();

        console.log('[Background] 记录请求:', details.url, '规则:', matchedRule?.name);
    }

    // 上传网络数据到后端
    async function uploadNetworkData(details, matchedRule) {
        try {
            // 检查是否有API配置
            if (!globalState.apiConfig?.host) {
                return;
            }

            // 准备网络数据
            const networkData = {
                rule_name: matchedRule.name,
                url: details.url,
                method: details.method,
                request_headers: details.requestHeaders ? 
                    Object.fromEntries(details.requestHeaders.map(h => [h.name, h.value])) : {},
                response_headers: details.responseHeaders ? 
                    Object.fromEntries(details.responseHeaders.map(h => [h.name, h.value])) : {},
                status_code: details.statusCode,
                timestamp: new Date().toISOString(),
                tab_id: details.tabId,
                request_id: details.requestId
            };

            // 发送到后端
            const response = await fetch(`${globalState.apiConfig.host}/api/v1/system/network-data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(networkData)
            });

            if (response.ok) {
                console.log('[Background] 成功上传网络数据:', matchedRule.name);
            } else {
                console.error('[Background] 上传网络数据失败:', response.status);
            }

        } catch (error) {
            console.error('[Background] 上传网络数据时出错:', error);
        }
    }

    // 更新请求记录
    function updateRequestLog(requestId, updateData) {
        const index = globalState.requestLog.findIndex(
            request => request.requestId === requestId
        );
        
        if (index !== -1) {
            globalState.requestLog[index] = {
                ...globalState.requestLog[index],
                ...updateData
            };
        }
    }

    // 更新请求统计
    function updateRequestStats() {
        globalState.requestStats.total++;
        globalState.requestStats.today++;
        saveRequestStats();
    }

    // 刷新API Token
    async function refreshApiToken() {
        if (!globalState.apiConfig?.refreshToken) {
            return false;
        }

        try {
            const response = await fetch(`${globalState.apiConfig.host}/api/v1/user/auth/sso-refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    refresh_token: globalState.apiConfig.refreshToken
                })
            });

            if (response.ok) {
                const data = await response.json();
                
                // 更新token
                globalState.apiConfig.token = data.access_token;
                if (data.refresh_token) {
                    globalState.apiConfig.refreshToken = data.refresh_token;
                }

                // 保存到存储
                chrome.storage.local.set({
                    'xhs_api_config': globalState.apiConfig
                });

                console.log('[Background] API Token已刷新');
                return true;
            }
        } catch (error) {
            console.error('[Background] 刷新Token失败:', error);
        }

        return false;
    }

    // 消息处理
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        handleMessage(request, sender, sendResponse);
        return true; // 保持消息通道开放以进行异步响应
    });

    async function handleMessage(request, sender, sendResponse) {
        try {
            switch (request.action) {
                case 'getRequestLog':
                    sendResponse({
                        success: true,
                        data: globalState.requestLog
                    });
                    break;

                case 'getConfig':
                    sendResponse({
                        success: true,
                        data: globalState.config
                    });
                    break;

                case 'setConfig':
                    globalState.config = { ...globalState.config, ...request.config };
                    chrome.storage.sync.set({
                        'xhs_monitor_config': globalState.config
                    }, function() {
                        console.log('[Background] 配置已保存:', globalState.config);
                        sendResponse({ success: true });
                    });
                    break;

                case 'getApiConfig':
                    sendResponse({
                        success: true,
                        data: globalState.apiConfig
                    });
                    break;

                case 'setApiConfig':
                    globalState.apiConfig = request.config;
                    chrome.storage.local.set({
                        'xhs_api_config': globalState.apiConfig
                    }, async function() {
                        console.log('[Background] API配置已保存');
                        
                        // API配置更新后，重新加载抓取规则
                        if (globalState.apiConfig.host) {
                            try {
                            await loadCaptureRules();
                                console.log('[Background] 抓取规则已自动刷新');
                            } catch (error) {
                                console.error('[Background] 自动刷新抓取规则失败:', error);
                            }
                        }
                        
                        sendResponse({ success: true });
                    });
                    break;

                case 'getCaptureRules':
                    sendResponse({
                        success: true,
                        data: globalState.captureRules
                    });
                    break;

                case 'refreshCaptureRules':
                    (async () => {
                    try {
                            // 检查是否有API配置
                            if (!globalState.apiConfig?.host) {
                                sendResponse({
                                    success: false,
                                    error: '请先配置API服务器地址'
                                });
                                return;
                            }

                        await loadCaptureRules();
                        sendResponse({
                            success: true,
                            message: '抓取规则已刷新',
                            data: globalState.captureRules
                        });
                    } catch (error) {
                        sendResponse({
                            success: false,
                            error: error.message
                        });
                    }
                    })();
                    break;

                case 'getRequestStats':
                    sendResponse({
                        success: true,
                        data: globalState.requestStats
                    });
                    break;

                case 'clearRequestLog':
                    globalState.requestLog = [];
                    sendResponse({ success: true });
                    break;

                case 'logCustomRequest':
                    // 处理来自注入脚本的请求记录
                    const requestData = request.data;
                    
                    // 检查是否是响应数据
                    if (requestData.type === 'xhr_response' || requestData.type === 'fetch_response') {
                        // 这是响应数据，更新现有请求记录
                        const existingLogIndex = globalState.requestLog.findIndex(
                            log => log.requestId === requestData.requestId
                        );
                        
                        if (existingLogIndex !== -1) {
                            // 更新现有记录的响应信息
                            globalState.requestLog[existingLogIndex] = {
                                ...globalState.requestLog[existingLogIndex],
                                statusCode: requestData.response?.status,
                                responseHeaders: requestData.response?.headers?.map(([name, value]) => ({name, value})) || [],
                                response: {
                                    body: requestData.response?.body,
                                    contentType: requestData.response?.contentType,
                                    status: requestData.response?.status,
                                    statusText: requestData.response?.statusText,
                                    responseTime: requestData.response?.responseTime
                                },
                                timeStamp: requestData.timestamp || Date.now()
                            };
                            
                            console.log('[Background] 更新响应数据:', requestData.url, requestData.response?.status);
                        } else {
                            console.warn('[Background] 未找到对应的请求记录:', requestData.requestId);
                        }
                        
                        sendResponse({ success: true });
                        return;
                    }
                    
                    // 检查URL是否匹配抓取规则
                    const matchedRule = findMatchingRule(requestData.url);
                    if (!matchedRule) {
                        sendResponse({
                            success: false,
                            reason: 'URL not matched'
                        });
                        return;
                    }

                    // 构造请求详情对象
                    const details = {
                        requestId: requestData.requestId,
                        url: requestData.url,
                        method: requestData.method,
                        type: requestData.type,
                        timeStamp: requestData.timestamp,
                        requestHeaders: Object.entries(requestData.headers || {}).map(([name, value]) => ({name, value})),
                        requestBody: requestData.body
                    };

                    // 记录请求
                    logRequest(details, requestData.source, matchedRule);
                    
                    sendResponse({ success: true });
                    break;

                case 'userLoggedOut':
                    // 用户退出登录时清除相关配置
                    globalState.apiConfig = { host: globalState.apiConfig.host || '', token: '', refreshToken: '' };
                    chrome.storage.local.set({
                        'xhs_api_config': globalState.apiConfig
                    });
                    sendResponse({ success: true });
                    break;

                default:
                    sendResponse({
                        success: false,
                        error: 'Unknown action: ' + request.action
                    });
            }
        } catch (error) {
            console.error('[Background] 处理消息时出错:', error);
            sendResponse({
                success: false,
                error: error.message
            });
        }
    }

    // 标签页更新监听
    chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
        if (changeInfo.status === 'complete' && tab.url) {
            // 检查是否是小红书页面
            if (tab.url.includes('xiaohongshu.com')) {
                console.log('[Background] 小红书页面已加载:', tab.url);
                
                // 可以在这里执行一些页面加载后的操作
                // 比如刷新抓取规则等
            }
        }
    });

    console.log('[XHS Monitor Background] 后台脚本已加载，版本: 2.3.0');

})(); 