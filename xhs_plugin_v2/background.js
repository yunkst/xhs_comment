// 小红书网络监控插件 - 后台脚本
(function() {
    'use strict';

    // 全局状态
    let globalState = {
        requestLog: [],
        config: null,
        apiConfig: null,
        requestStats: {
            total: 0,
            today: 0,
            lastResetDate: new Date().toDateString()
        }
    };

    // 默认配置
    const DEFAULT_CONFIG = {
        enableMonitoring: true,
        enableEnhanced: true,
        urlPatterns: [
            { pattern: '*.xiaohongshu.com/*', enabled: true },
            { pattern: '*.xhscdn.com/*', enabled: true },
            { pattern: '*.fegine.com/*', enabled: true }
        ],
        monitorTypes: {
            xhr: true,
            fetch: true,
            images: true,
            scripts: true,
            styles: true,
            documents: true
        },
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
    function initializePlugin() {
        loadConfig();
        loadApiConfig();
        loadRequestStats();
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
        });
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
        // 监听请求开始
        chrome.webRequest.onBeforeRequest.addListener(
            function(details) {
                if (!globalState.config || !globalState.config.enableMonitoring) {
                    return;
                }

                // 检查URL是否匹配配置
                if (!isUrlMatched(details.url)) {
                    return;
                }

                // 记录请求
                logRequest(details, 'webRequest');
            },
            { urls: ['<all_urls>'] },
            ['requestBody']
        );

        // 监听请求完成
        chrome.webRequest.onCompleted.addListener(
            function(details) {
                if (!globalState.config || !globalState.config.enableMonitoring) {
                    return;
                }

                if (!isUrlMatched(details.url)) {
                    return;
                }

                // 更新请求记录
                updateRequestLog(details.requestId, {
                    statusCode: details.statusCode,
                    responseHeaders: details.responseHeaders,
                    timeStamp: details.timeStamp
                });
            },
            { urls: ['<all_urls>'] },
            ['responseHeaders']
        );

        // 监听请求错误
        chrome.webRequest.onErrorOccurred.addListener(
            function(details) {
                if (!globalState.config || !globalState.config.enableMonitoring) {
                    return;
                }

                if (!isUrlMatched(details.url)) {
                    return;
                }

                // 更新请求记录
                updateRequestLog(details.requestId, {
                    error: details.error,
                    timeStamp: details.timeStamp
                });
            },
            { urls: ['<all_urls>'] }
        );
    }

    // 检查URL是否匹配配置
    function isUrlMatched(url) {
        if (!globalState.config || !globalState.config.urlPatterns) {
            return false;
        }

        return globalState.config.urlPatterns.some(pattern => {
            if (!pattern.enabled) return false;
            return matchUrlPattern(url, pattern.pattern);
        });
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
    function logRequest(details, source) {
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
            requestBody: details.requestBody || null
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

        console.log('[Background] 记录请求:', details.url, source);
    }

    // 更新请求日志
    function updateRequestLog(requestId, updateData) {
        const index = globalState.requestLog.findIndex(req => req.requestId === requestId);
        if (index !== -1) {
            Object.assign(globalState.requestLog[index], updateData);
        }
    }

    // 更新请求统计
    function updateRequestStats() {
        globalState.requestStats.total++;
        globalState.requestStats.today++;
        
        // 检查是否需要重置今日统计
        const today = new Date().toDateString();
        if (globalState.requestStats.lastResetDate !== today) {
            globalState.requestStats.today = 1; // 重置为1（当前请求）
            globalState.requestStats.lastResetDate = today;
        }
        
        // 保存统计数据
        saveRequestStats();
    }

    // 刷新API Token
    async function refreshApiToken() {
        if (!globalState.apiConfig?.refreshToken) {
            return false;
        }

        try {
            const response = await fetch(`${globalState.apiConfig.host}/api/auth/sso-refresh`, {
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

    // 监听消息
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        console.log('[Background] 收到消息:', request.action);

        switch (request.action) {
            case 'getRequestLog':
                sendResponse({
                    success: true,
                    log: globalState.requestLog,
                    totalCount: globalState.requestLog.length,
                    config: globalState.config
                });
                break;

            case 'getRequestStats':
                sendResponse({
                    success: true,
                    stats: globalState.requestStats
                });
                break;

            case 'clearLogs':
                globalState.requestLog = [];
                globalState.requestStats.total = 0;
                globalState.requestStats.today = 0;
                saveRequestStats();
                sendResponse({ success: true });
                break;

            case 'logCustomRequest':
                // 来自content script的自定义请求记录
                if (request.data) {
                    // 检查URL是否匹配配置
                    if (isUrlMatched(request.data.url)) {
                        logCustomRequest(request.data);
                        sendResponse({ success: true });
                    } else {
                        sendResponse({ success: false, reason: 'URL not matched' });
                    }
                } else {
                    sendResponse({ success: false, reason: 'No data provided' });
                }
                break;

            case 'getConfig':
                sendResponse({ config: globalState.config });
                break;

            case 'configUpdated':
                if (request.config) {
                    globalState.config = request.config;
                    console.log('[Background] 配置已更新');
                }
                sendResponse({ success: true });
                break;

            case 'apiConfigUpdated':
                if (request.config) {
                    globalState.apiConfig = request.config;
                    console.log('[Background] API配置已更新');
                }
                sendResponse({ success: true });
                break;

            case 'exportLog':
                exportRequestLog(sendResponse);
                return true; // 保持连接开启

            default:
                sendResponse({ success: false, error: 'Unknown action' });
        }

        return true;
    });

    // 记录自定义请求
    function logCustomRequest(data) {
        const requestData = {
            ...data,
            requestId: data.requestId || generateRequestId(),
            timestamp: data.timestamp || Date.now(),
            timeString: data.timeString || new Date().toLocaleString('zh-CN')
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
    }

    // 生成请求ID
    function generateRequestId() {
        return 'custom_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // 导出请求日志
    function exportRequestLog(sendResponse) {
        if (globalState.requestLog.length === 0) {
            sendResponse({ success: false, error: '没有请求记录可以导出' });
            return;
        }

        try {
            const exportData = {
                exportTime: new Date().toISOString(),
                totalRequests: globalState.requestLog.length,
                config: globalState.config,
                requests: globalState.requestLog
            };

            const dataStr = JSON.stringify(exportData, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
            
            const fileName = `xhs_monitor_log_${new Date().toISOString().slice(0, 10)}.json`;
            
            chrome.downloads.download({
                url: dataUri,
                filename: fileName,
                saveAs: true
            }, function(downloadId) {
                if (chrome.runtime.lastError) {
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    sendResponse({ success: true, downloadId: downloadId });
                }
            });

        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
    }

    // 监听存储变化
    chrome.storage.onChanged.addListener(function(changes, namespace) {
        if (namespace === 'sync' && changes.xhs_monitor_config) {
            globalState.config = changes.xhs_monitor_config.newValue;
            console.log('[Background] 检测到配置变化，已更新');
            
            // 通知所有标签页配置已更新
            chrome.tabs.query({}, function(tabs) {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'configUpdated'
                    }).catch(() => {
                        // 忽略无法发送消息的标签页
                    });
                });
            });
        }

        if (namespace === 'local' && changes.xhs_api_config) {
            globalState.apiConfig = changes.xhs_api_config.newValue;
            console.log('[Background] 检测到API配置变化，已更新');
        }
    });

    console.log('[XHS Monitor Background] 后台脚本已加载');

})(); 