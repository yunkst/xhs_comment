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
            
            // 发送请求事件
            dispatchInterceptEvent({
                url: url,
                method: method.toUpperCase(),
                headers: headers,
                body: body,
                type: 'fetch',
                requestId: requestId,
                timestamp: Date.now(),
                captureRule: matchedRule
            });
            
            const fetchPromise = originalFetch.apply(this, arguments);
            
            return fetchPromise.then(response => {
                console.log(`[XHS Monitor] 收到响应: ${url}, 状态: ${response.status}`);
                
                // 增强的响应处理
                try {
                    // 检查响应是否可读
                    if (!response.body) {
                        console.warn(`[XHS Monitor] 警告: 响应没有body - ${url}`);
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
                                body: null,
                                contentType: response.headers.get('content-type'),
                                error: 'No response body'
                            }
                        });
                        return response;
                    }
                    
                    // 使用多种方式尝试读取响应体
                const responseClone = response.clone();
                    
                    // 方法1: 尝试使用text()
                    const textPromise = responseClone.text().then(responseText => {
                        console.log(`[XHS Monitor] 成功读取响应体: ${url}, 长度: ${responseText.length}`);
                        
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
                                contentType: response.headers.get('content-type'),
                                method: 'text'
                            }
                        });
                    }).catch(textError => {
                        console.warn(`[XHS Monitor] text()读取失败: ${url}`, textError);
                        
                        // 方法2: 尝试使用arrayBuffer()
                        const responseClone2 = response.clone();
                        responseClone2.arrayBuffer().then(arrayBuffer => {
                            const decoder = new TextDecoder('utf-8');
                            const responseText = decoder.decode(arrayBuffer);
                            console.log(`[XHS Monitor] arrayBuffer()读取成功: ${url}, 长度: ${responseText.length}`);
                            
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
                                    contentType: response.headers.get('content-type'),
                                    method: 'arrayBuffer'
                                }
                            });
                        }).catch(arrayBufferError => {
                            console.error(`[XHS Monitor] 所有读取方法都失败: ${url}`, {textError, arrayBufferError});
                            
                            // 发送错误信息
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
                                    body: null,
                                    contentType: response.headers.get('content-type'),
                                    error: `读取失败: text()=${textError.message}, arrayBuffer()=${arrayBufferError.message}`
                                }
                            });
                        });
                    });
                    
                } catch (processError) {
                    console.error(`[XHS Monitor] 响应处理异常: ${url}`, processError);
                    
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
                            body: null,
                            contentType: response.headers.get('content-type'),
                            error: `处理异常: ${processError.message}`
                        }
                    });
                }
                
                return response;
            }).catch(error => {
                console.error(`[XHS Monitor] Fetch请求失败: ${url}`, error);
                
                dispatchInterceptEvent({
                    url: url,
                    method: method.toUpperCase(),
                    type: 'fetch_error',
                    requestId: requestId,
                    timestamp: Date.now(),
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