// 注入脚本 - 在页面上下文中运行，拦截网络请求
(function() {
    'use strict';
    
    console.log('小红书网络请求拦截器已注入');
    
    // 保存原始的fetch和XMLHttpRequest
    const originalFetch = window.fetch;
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    
    // 检查是否为小红书相关的URL
    function isXHSUrl(url) {
        return url && (
            url.includes('xiaohongshu.com') ||
            url.includes('xhscdn.com') ||
            url.includes('fegine.com')
        );
    }
    
    // 发送拦截事件到内容脚本
    function dispatchInterceptEvent(data) {
        const event = new CustomEvent('XHS_REQUEST_INTERCEPTED', {
            detail: data
        });
        window.dispatchEvent(event);
    }
    
    // 拦截fetch请求
    window.fetch = function(input, init = {}) {
        const url = typeof input === 'string' ? input : input.url;
        
        if (isXHSUrl(url)) {
            const method = init.method || 'GET';
            const headers = init.headers || {};
            const body = init.body || null;
            const requestId = `fetch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // 记录请求信息
            dispatchInterceptEvent({
                url: url,
                method: method.toUpperCase(),
                headers: headers,
                body: body,
                type: 'fetch',
                requestId: requestId,
                timestamp: Date.now()
            });
            
            console.log(`[XHS Monitor] Fetch请求拦截: ${method} ${url}`);
            
            // 调用原始fetch并拦截响应
            const fetchPromise = originalFetch.apply(this, arguments);
            
            // 拦截响应
            return fetchPromise.then(response => {
                if (isXHSUrl(url)) {
                    // 克隆响应以避免消费原始响应
                    const responseClone = response.clone();
                    
                    // 异步读取响应体
                    responseClone.text().then(responseText => {
                        dispatchInterceptEvent({
                            url: url,
                            method: method.toUpperCase(),
                            type: 'fetch_response',
                            requestId: requestId,
                            timestamp: Date.now(),
                            response: {
                                status: response.status,
                                statusText: response.statusText,
                                headers: Array.from(response.headers.entries()),
                                body: responseText,
                                contentType: response.headers.get('content-type')
                            }
                        });
                        
                        console.log(`[XHS Monitor] Fetch响应拦截: ${response.status} ${url}`);
                    }).catch(err => {
                        console.warn(`[XHS Monitor] 无法读取响应体:`, err);
                    });
                }
                
                return response;
            }).catch(error => {
                if (isXHSUrl(url)) {
                    dispatchInterceptEvent({
                        url: url,
                        method: method.toUpperCase(),
                        type: 'fetch_error',
                        requestId: requestId,
                        error: error.message
                    });
                }
                throw error;
            });
        }
        
        // 调用原始fetch
        return originalFetch.apply(this, arguments);
    };
    
    // 拦截XMLHttpRequest
    XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
        this._xhsMethod = method;
        this._xhsUrl = url;
        this._xhsHeaders = {};
        this._xhsRequestId = `xhr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this._xhsStartTime = Date.now();
        
        return originalXHROpen.apply(this, arguments);
    };
    
    // 拦截XMLHttpRequest的setRequestHeader
    const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
        if (this._xhsHeaders) {
            this._xhsHeaders[name] = value;
        }
        return originalSetRequestHeader.apply(this, arguments);
    };
    
    // 拦截XMLHttpRequest的send
    XMLHttpRequest.prototype.send = function(data) {
        const xhr = this;
        
        if (isXHSUrl(this._xhsUrl)) {
            // 记录请求信息
            dispatchInterceptEvent({
                url: this._xhsUrl,
                method: (this._xhsMethod || 'GET').toUpperCase(),
                headers: this._xhsHeaders || {},
                body: data || null,
                type: 'xhr',
                requestId: this._xhsRequestId,
                timestamp: Date.now()
            });
            
            console.log(`[XHS Monitor] XHR请求拦截: ${this._xhsMethod} ${this._xhsUrl}`);
            
            // 监听响应
            const originalOnReadyStateChange = xhr.onreadystatechange;
            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4 && isXHSUrl(xhr._xhsUrl)) {
                    // 记录响应信息
                    const responseHeaders = [];
                    try {
                        const headerStr = xhr.getAllResponseHeaders();
                        if (headerStr) {
                            headerStr.split('\r\n').forEach(line => {
                                const parts = line.split(': ');
                                if (parts.length === 2) {
                                    responseHeaders.push([parts[0], parts[1]]);
                                }
                            });
                        }
                    } catch (e) {
                        console.warn('[XHS Monitor] 无法获取响应头:', e);
                    }
                    
                    dispatchInterceptEvent({
                        url: xhr._xhsUrl,
                        method: (xhr._xhsMethod || 'GET').toUpperCase(),
                        type: 'xhr_response',
                        requestId: xhr._xhsRequestId,
                        timestamp: Date.now(),
                        response: {
                            status: xhr.status,
                            statusText: xhr.statusText,
                            headers: responseHeaders,
                            body: xhr.responseText || xhr.response,
                            contentType: xhr.getResponseHeader('content-type'),
                            responseTime: Date.now() - xhr._xhsStartTime
                        }
                    });
                    
                    console.log(`[XHS Monitor] XHR响应拦截: ${xhr.status} ${xhr._xhsUrl}`);
                }
                
                if (originalOnReadyStateChange) {
                    originalOnReadyStateChange.apply(this, arguments);
                }
            };
        }
        
        return originalXHRSend.apply(this, arguments);
    };
    
    // 监控页面中动态创建的请求
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // 检查是否有新的script标签可能发起请求
                    if (node.tagName === 'SCRIPT' && node.src && isXHSUrl(node.src)) {
                        dispatchInterceptEvent({
                            url: node.src,
                            method: 'GET',
                            headers: {},
                            body: null,
                            type: 'script'
                        });
                        
                        console.log(`[XHS Monitor] Script请求拦截: GET ${node.src}`);
                    }
                    
                    // 检查新添加的元素中的script标签
                    const scripts = node.querySelectorAll && node.querySelectorAll('script[src]');
                    if (scripts) {
                        scripts.forEach(function(script) {
                            if (isXHSUrl(script.src)) {
                                dispatchInterceptEvent({
                                    url: script.src,
                                    method: 'GET',
                                    headers: {},
                                    body: null,
                                    type: 'script'
                                });
                                
                                console.log(`[XHS Monitor] Dynamic Script请求拦截: GET ${script.src}`);
                            }
                        });
                    }
                }
            });
        });
    });
    
    // 开始观察DOM变化
    observer.observe(document, {
        childList: true,
        subtree: true
    });
    
    // 拦截图片请求
    const originalImage = window.Image;
    window.Image = function() {
        const img = new originalImage();
        const originalSrcSetter = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src').set;
        
        Object.defineProperty(img, 'src', {
            set: function(value) {
                if (isXHSUrl(value)) {
                    dispatchInterceptEvent({
                        url: value,
                        method: 'GET',
                        headers: {},
                        body: null,
                        type: 'image'
                    });
                    
                    console.log(`[XHS Monitor] Image请求拦截: GET ${value}`);
                }
                return originalSrcSetter.call(this, value);
            },
            get: function() {
                return this.getAttribute('src');
            }
        });
        
        return img;
    };
    
    console.log('小红书网络请求拦截器初始化完成');
    
})(); 