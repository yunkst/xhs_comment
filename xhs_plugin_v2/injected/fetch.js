// injected/fetch.js

import { isXHSUrl, dispatchInterceptEvent, matchesHardcodedRule } from './utils.js';

const originalFetch = window.fetch;

function interceptFetch() {
    window.fetch = function(input, init = {}) {
        const url = typeof input === 'string' ? input : input.url;
        
        // 检查是否匹配固化的抓取规则
        const matchedRule = matchesHardcodedRule(url);
        
        if (matchedRule) {
            const method = init.method || 'GET';
            const headers = init.headers || {};
            const body = init.body || null;
            const requestId = `fetch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            console.log(`[XHS Monitor] 匹配到固化规则: ${matchedRule.name}, URL: ${url}`);
            
            dispatchInterceptEvent({
                url: url,
                method: method.toUpperCase(),
                headers: headers,
                body: body,
                type: 'fetch',
                requestId: requestId,
                timestamp: Date.now(),
                captureRule: matchedRule // 添加匹配的规则信息
            });
            
            const fetchPromise = originalFetch.apply(this, arguments);
            
            return fetchPromise.then(response => {
                const responseClone = response.clone();
                responseClone.text().then(responseText => {
                    dispatchInterceptEvent({
                        url: url,
                        method: method.toUpperCase(),
                        type: 'fetch_response',
                        requestId: requestId,
                        timestamp: Date.now(),
                        captureRule: matchedRule,
                        response: {
                            status: response.status,
                            statusText: response.statusText,
                            headers: Array.from(response.headers.entries()),
                            body: responseText,
                            contentType: response.headers.get('content-type')
                        }
                    });
                }).catch(err => {
                    console.warn(`[XHS Monitor] 无法读取响应体:`, err);
                });
                
                return response;
            }).catch(error => {
                dispatchInterceptEvent({
                    url: url,
                    method: method.toUpperCase(),
                    type: 'fetch_error',
                    requestId: requestId,
                    captureRule: matchedRule,
                    error: error.message
                });
                throw error;
            });
        }
        
        return originalFetch.apply(this, arguments);
    };
}

export { interceptFetch }; 