// 内容脚本 - 在页面中运行
(function() {
    'use strict';
    
    console.log('小红书网络请求监控 - 内容脚本已加载');
    
    // 插件配置
    let contentConfig = {
        enableMonitoring: true,
        enableEnhanced: true
    };
    
    // 检查当前页面是否应该注入监控脚本
    function shouldInjectMonitoring() {
        const currentUrl = window.location.href;
        
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
                // 如果无法获取配置，使用默认行为
                console.warn('[XHS Monitor] 无法获取配置，使用默认监控');
                injectMonitoringScripts();
            }
        });
    }
    
    // 检查URL是否匹配配置
    function isUrlMatched(url) {
        // 对于小红书相关域名，默认总是注入监控脚本
        if (url.includes('xiaohongshu.com') || url.includes('xhscdn.com') || url.includes('fegine.com')) {
            return true;
        }
        
        // 对于其他网站，检查配置
        if (!contentConfig.urlPatterns) return false;
        
        return contentConfig.urlPatterns.some(pattern => {
            if (!pattern.enabled) return false;
            return matchUrlPattern(url, pattern.pattern);
        });
    }
    
    // URL模式匹配函数
    function matchUrlPattern(url, pattern) {
        const regexPattern = pattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '\\?');
        
        const regex = new RegExp('^' + regexPattern + '$', 'i');
        return regex.test(url);
    }
    
    // 注入监控脚本
    function injectMonitoringScripts() {
        console.log('[XHS Monitor] 正在注入监控脚本...');
        
        // 注入原始监控脚本
        const script1 = document.createElement('script');
        script1.src = chrome.runtime.getURL('injected.js');
        script1.onload = function() {
            this.remove();
            console.log('[XHS Monitor] 基础监控脚本已注入');
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
    }
    
    // 监听来自注入脚本的消息
    window.addEventListener('XHS_REQUEST_INTERCEPTED', function(event) {
        const requestData = event.detail;
        
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
            if (response && !response.success && response.reason === 'URL not matched') {
                console.log('[XHS Monitor] 请求被过滤 - URL不匹配配置:', requestData.url);
            }
        });
    });
    
    // 监听页面卸载，清理资源
    window.addEventListener('beforeunload', function() {
        console.log('[XHS Monitor] 页面即将卸载');
    });
    
    // 监听配置变化
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'configUpdated') {
            console.log('[XHS Monitor] 配置已更新，重新加载页面以应用新配置');
            // 可以选择重新加载页面或重新注入脚本
            if (confirm('插件配置已更新，是否重新加载页面以应用新配置？')) {
                window.location.reload();
            }
        }
    });
    
    // 开始监控检查
    shouldInjectMonitoring();
    
})(); 