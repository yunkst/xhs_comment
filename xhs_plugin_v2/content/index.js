// 内容脚本 - 在页面中运行
(function() {
    'use strict';
    
    console.log('[Content] 小红书网络请求监控 - 内容脚本已加载');
    console.log('[Content] 当前页面URL:', window.location.href);
    console.log('[Content] Chrome runtime 可用:', !!chrome?.runtime);
    
    // 插件配置
    let contentConfig = {
        enableMonitoring: true,
        enableEnhanced: true
    };
    
    // 检查当前页面是否应该注入监控脚本
    function shouldInjectMonitoring() {
        const currentUrl = window.location.href;
        
        // 对于小红书页面，直接注入，不等待配置
        if (isUrlMatched(currentUrl)) {
            console.log('[XHS Monitor] 检测到小红书页面，直接注入脚本');
            injectMonitoringScripts();
            return;
        }
        
        // 向background获取配置并检查
        chrome.runtime.sendMessage({ action: 'getConfig' }, function(response) {
            if (response && response.config) {
                contentConfig = response.config;
                
                if (contentConfig.enableMonitoring && isUrlMatched(currentUrl)) {
                    injectMonitoringScripts();
                } else {
                    console.log('[XHS Monitor] 当前页面不在监控范围内:', currentUrl);
                }
            } else {
                // 如果无法获取配置，对小红书页面使用默认行为
                console.warn('[XHS Monitor] 无法获取配置，使用默认监控');
                if (isUrlMatched(currentUrl)) {
                    injectMonitoringScripts();
                }
            }
        });
    }
    
    // 检查URL是否匹配配置
    function isUrlMatched(url) {
        // 对于小红书相关域名，默认总是注入监控脚本
        if (url.includes('xiaohongshu.com') || url.includes('xhscdn.com') || url.includes('fegine.com')) {
            return true;
        }
        
        // 对于其他网站，不再支持用户自定义 URL 模式
        return false;
    }
    
    // 注入监控脚本
    function injectMonitoringScripts() {
        console.log('[XHS Monitor] 正在注入监控脚本...');
        
        // 检查是否已经注入过
        if (document.documentElement.getAttribute('data-xhs-monitor')) {
            console.log('[XHS Monitor] 脚本已经注入过，跳过');
            return;
        }
        
        // 注入原始监控脚本
        const script1 = document.createElement('script');
        script1.src = chrome.runtime.getURL('injected/index.js');
        script1.type = 'module';
        script1.onload = function() {
            this.remove();
            console.log('[XHS Monitor] 基础监控脚本已注入');
        };
        script1.onerror = function() {
            console.error('[XHS Monitor] 基础监控脚本注入失败');
        };
        
        // 注入增强拦截器（如果启用）
        let script2 = null;
        if (contentConfig.enableEnhanced) {
            script2 = document.createElement('script');
            script2.src = chrome.runtime.getURL('enhanced_interceptor.js');
            script2.onload = function() {
                this.remove();
                console.log('[XHS Monitor] 隐蔽增强拦截器已注入');
            };
            script2.onerror = function() {
                console.error('[XHS Monitor] 增强拦截器注入失败');
            };
        }
        
        // 尽早注入脚本
        const targetElement = document.head || document.documentElement;
        targetElement.appendChild(script1);
        if (script2) {
            targetElement.appendChild(script2);
        }
        
        // 添加页面标记，表示监控已激活
        document.documentElement.setAttribute('data-xhs-monitor', 'active');
        if (contentConfig.enableEnhanced) {
            document.documentElement.setAttribute('data-xhs-monitor-enhanced', 'true');
            document.documentElement.setAttribute('data-xhs-monitor-mode', 'stealth');
        }
        
        console.log('[XHS Monitor] 监控脚本注入完成');
    }
    
    // 监听来自注入脚本的消息
    document.addEventListener('XHS_REQUEST_INTERCEPTED', function(event) {
        const requestData = event.detail;
        
        console.log('[Content] 收到拦截事件:', {
            url: requestData.url,
            method: requestData.method,
            type: requestData.type,
            hasResponse: !!requestData.response,
            timestamp: requestData.timestamp
        });
        
        // 发送给后台脚本记录
        chrome.runtime.sendMessage({
            action: 'logCustomRequest',
            data: {
                url: requestData.url,
                method: requestData.method,
                headers: requestData.headers,
                body: requestData.body,
                timestamp: requestData.timestamp || Date.now(),
                timeString: new Date().toLocaleString('zh-CN'),
                type: requestData.type,
                source: 'injected',
                requestId: requestData.requestId,
                response: requestData.response,
                performanceData: requestData.performanceData,
                error: requestData.error
            }
        }, function(response) {
            if (response && response.success) {
                console.log('[Content] 成功记录请求:', requestData.url);
            } else if (response && !response.success && response.reason === 'URL not matched') {
                console.log('[Content] 请求被过滤 - URL不匹配配置:', requestData.url);
            } else {
                console.log('[Content] 记录请求失败:', requestData.url, response);
            }
        });
    });
    
    // 监听代理请求事件
    document.addEventListener('XHS_PROXY_REQUEST', function(event) {
        const requestData = event.detail;
        
        console.log('[Content] 收到代理请求:', requestData);
        
        // 发送给后台脚本处理
        chrome.runtime.sendMessage({
            action: 'proxyRequest',
            data: requestData
        }, function(response) {
            console.log('[Content] 收到代理请求响应:', response);
            
            // 检查Chrome runtime错误
            if (chrome.runtime.lastError) {
                console.error('[Content] Chrome runtime错误:', chrome.runtime.lastError);
                const errorEvent = new CustomEvent('XHS_PROXY_RESPONSE', {
                    detail: {
                        requestId: requestData.requestId,
                        success: false,
                        status: 500,
                        data: null,
                        error: chrome.runtime.lastError.message
                    }
                });
                document.dispatchEvent(errorEvent);
                return;
            }
            
            // 将响应发送回注入脚本
            const responseEvent = new CustomEvent('XHS_PROXY_RESPONSE', {
                detail: {
                    requestId: requestData.requestId,
                    success: response ? response.success : false,
                    status: response ? response.status : 500,
                    data: response ? response.data : null,
                    error: response ? response.error : '未收到响应'
                }
            });
            document.dispatchEvent(responseEvent);
        });
    });
    
    // 监听配置请求事件
    document.addEventListener('XHS_GET_CONFIG', function(event) {
        const requestData = event.detail;
        
        console.log('[Content] 收到配置请求:', requestData);
        console.log('[Content] Chrome runtime 状态:', !!chrome?.runtime);
        
        // 发送给后台脚本获取全局状态（包括抓取规则）
        chrome.runtime.sendMessage({
            action: 'getGlobalState'
        }, function(response) {
            console.log('[Content] 收到全局状态响应:', response);
            
            // 检查Chrome runtime错误
            if (chrome.runtime.lastError) {
                console.error('[Content] Chrome runtime错误:', chrome.runtime.lastError);
                const errorEvent = new CustomEvent('XHS_CONFIG_RESPONSE', {
                    detail: {
                        requestId: requestData.requestId,
                        success: false,
                        globalState: null,
                        error: chrome.runtime.lastError.message
                    }
                });
                document.dispatchEvent(errorEvent);
                return;
            }
            
            // 将全局状态发送回注入脚本
            const configEvent = new CustomEvent('XHS_CONFIG_RESPONSE', {
                detail: {
                    requestId: requestData.requestId,
                    success: response ? response.success : false,
                    globalState: response ? response.globalState : null,
                    error: response ? response.error : '未收到响应'
                }
            });
            document.dispatchEvent(configEvent);
        });
    });
    
    // 监听页面卸载，清理资源
    window.addEventListener('beforeunload', function() {
        console.log('[XHS Monitor] 页面即将卸载');
    });
    
    // 监听配置变化和其他消息
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'configUpdated') {
            console.log('[XHS Monitor] 配置已更新，重新加载页面以应用新配置');
            // 可以选择重新加载页面或重新注入脚本
            if (confirm('插件配置已更新，是否重新加载页面以应用新配置？')) {
                window.location.reload();
            }
        } else if (request.action === 'initializeHistoryComments') {
            console.log('[Content] 收到初始化历史评论功能的请求');
            // 向注入脚本发送初始化消息
            const event = new CustomEvent('XHS_INITIALIZE_HISTORY_COMMENTS', {
                detail: { timestamp: Date.now() }
            });
            document.dispatchEvent(event);
            sendResponse({ success: true });
        }
    });
    
    // 开始监控检查
    shouldInjectMonitoring();
    
})(); 