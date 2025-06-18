// 增强网络拦截器 - 安全版本
(function() {
    'use strict';
    
    console.log('增强拦截器已启动');
    
    // 插件配置
    let interceptorConfig = {
        enableMonitoring: true,
        enableEnhanced: true,
        urlPatterns: [
            { pattern: '*.xiaohongshu.com/*', enabled: true },
            { pattern: '*.xhscdn.com/*', enabled: true },
            { pattern: '*.fegine.com/*', enabled: true }
        ]
    };
    
    // 已处理的请求集合，防止重复处理
    const processedRequests = new Set();
    
    // 用于标记内部请求的Symbol（不可枚举，不会暴露）
    const INTERNAL_MARKER = Symbol('xhs_internal');
    
    // 从background获取配置
    try {
        chrome.runtime.sendMessage({ action: 'getConfig' }, function(response) {
            if (response && response.config) {
                interceptorConfig = response.config;
                console.log('[XHS Monitor] 增强拦截器配置已加载');
            }
        });
    } catch (e) {
        console.warn('[XHS Monitor] 无法获取配置，使用默认配置');
    }
    
    // 保存原始函数 - 这时候originalFetch可能已经被injected.js重写了
    const originalFetch = window.fetch;
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    
    // 检查是否应该拦截这个URL
    function shouldInterceptUrl(url) {
        if (!interceptorConfig.enableMonitoring || !interceptorConfig.enableEnhanced) {
            return false;
        }
        
        return interceptorConfig.urlPatterns.some(pattern => {
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
    
    // 检查是否为内部请求（使用Symbol，完全隐蔽）
    function isInternalRequest(requestObj) {
        return requestObj && requestObj[INTERNAL_MARKER] === true;
    }
    
    // 生成请求唯一标识
    function generateRequestKey(url, method, timestamp) {
        return `${method}_${url}_${Math.floor(timestamp / 1000)}`;
    }
    
    // 发送拦截事件
    function dispatchInterceptEvent(data) {
        try {
            const event = new CustomEvent('XHS_REQUEST_INTERCEPTED', {
                detail: data
            });
            document.dispatchEvent(event);
        } catch (e) {
            // 静默处理错误
        }
    }
    
    // 增强版Fetch拦截 - 与基础拦截器协同工作
    window.fetch = function(input, init = {}) {
        const url = typeof input === 'string' ? input : input.url;
        const method = init.method || 'GET';
        
        // 使用Symbol检查内部请求，完全隐蔽
        if (isInternalRequest(init)) {
            return originalFetch.apply(this, arguments);
        }
        
        // 增强拦截只在配置允许时进行额外的记录
        if (shouldInterceptUrl(url)) {
            const requestId = `fetch_enhanced_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const startTime = Date.now();
            const requestKey = generateRequestKey(url, method, startTime);
            
            // 防止重复处理
            if (processedRequests.has(requestKey)) {
                return originalFetch.apply(this, arguments);
            }
            
            processedRequests.add(requestKey);
            
            // 清理过期的请求记录
            setTimeout(() => {
                processedRequests.delete(requestKey);
            }, 5000);
            
            console.log(`[XHS Monitor Enhanced] Fetch拦截: ${method} ${url}`);
            
            // 记录增强信息（不影响原始请求）
            dispatchInterceptEvent({
                url: url,
                method: method.toUpperCase(),
                headers: init.headers || {},
                body: init.body || null,
                type: 'fetch_enhanced',
                requestId: requestId,
                timestamp: startTime,
                enhanced: true
            });
        }
        
        // 调用可能已被基础拦截器重写的fetch
        return originalFetch.apply(this, arguments);
    };
    
    // 安全版XHR拦截 - 最小化干扰
    XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
        // 使用不可枚举的属性存储拦截信息，使用不同的属性名避免冲突
        Object.defineProperty(this, '_xhsEnhancedMethod', { value: method, writable: false, enumerable: false });
        Object.defineProperty(this, '_xhsEnhancedUrl', { value: url, writable: false, enumerable: false });
        Object.defineProperty(this, '_xhsEnhancedHeaders', { value: {}, writable: true, enumerable: false });
        Object.defineProperty(this, '_xhsEnhancedRequestId', { value: `xhr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, writable: false, enumerable: false });
        Object.defineProperty(this, '_xhsEnhancedStartTime', { value: Date.now(), writable: false, enumerable: false });
        Object.defineProperty(this, '_xhsEnhancedRequestKey', { value: generateRequestKey(url, method, Date.now()), writable: false, enumerable: false });
        
        return originalXHROpen.apply(this, arguments);
    };
    
    XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
        if (this._xhsEnhancedHeaders) {
            this._xhsEnhancedHeaders[name] = value;
        }
        return originalSetRequestHeader.apply(this, arguments);
    };
    
    XMLHttpRequest.prototype.send = function(data) {
        const xhr = this;
        
        if (shouldInterceptUrl(this._xhsEnhancedUrl)) {
            // 防止重复处理
            if (processedRequests.has(this._xhsEnhancedRequestKey)) {
                return originalXHRSend.apply(this, arguments);
            }
            
            processedRequests.add(this._xhsEnhancedRequestKey);
            setTimeout(() => {
                processedRequests.delete(xhr._xhsEnhancedRequestKey);
            }, 5000);
            
            console.log(`[XHS Monitor Enhanced] XHR拦截: ${this._xhsEnhancedMethod} ${this._xhsEnhancedUrl}`);
            
            // 记录增强请求信息
            dispatchInterceptEvent({
                url: this._xhsEnhancedUrl,
                method: (this._xhsEnhancedMethod || 'GET').toUpperCase(),
                headers: this._xhsEnhancedHeaders || {},
                body: data || null,
                type: 'xhr_enhanced',
                requestId: this._xhsEnhancedRequestId,
                timestamp: this._xhsEnhancedStartTime,
                enhanced: true
            });
        }
        
        // 调用原始的send方法，让基础拦截器处理响应
        return originalXHRSend.apply(this, arguments);
    };
    
    console.log('[XHS Monitor] 增强拦截器初始化完成（安全模式）');
    
})(); 