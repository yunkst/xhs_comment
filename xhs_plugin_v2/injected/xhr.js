import { isXHSUrl, dispatchInterceptEvent, matchesHardcodedRule } from './utils.js';

const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSend = XMLHttpRequest.prototype.send;
const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

function interceptXHR() {
    XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
        // 检查是否匹配固化的抓取规则
        const matchedRule = matchesHardcodedRule(url);
        
        if (matchedRule) {
            this._xhsMethod = method;
            this._xhsUrl = url;
            this._xhsHeaders = {};
            this._xhsRequestId = `xhr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this._xhsStartTime = Date.now();
            this._xhsCaptureRule = matchedRule;
            
            console.log(`[XHS Monitor] XHR 匹配到固化规则: ${matchedRule.name}, URL: ${url}`);
        }
        return originalXHROpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
        if (this._xhsUrl && this._xhsCaptureRule) {
            this._xhsHeaders[name] = value;
        }
        return originalSetRequestHeader.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function(data) {
        if (this._xhsUrl && this._xhsCaptureRule) {
            const xhr = this;
            
            // 发送请求事件
            dispatchInterceptEvent({
                url: this._xhsUrl,
                method: (this._xhsMethod || 'GET').toUpperCase(),
                headers: this._xhsHeaders || {},
                body: data || null,
                type: 'xhr',
                requestId: this._xhsRequestId,
                timestamp: Date.now(),
                captureRule: this._xhsCaptureRule
            });

            const originalOnReadyStateChange = xhr.onreadystatechange;
            
            // 重写 onreadystatechange
            xhr.onreadystatechange = function() {
                console.log(`[XHS Monitor] XHR状态变化: ${xhr.readyState}, URL: ${xhr._xhsUrl}`);
                
                if (xhr.readyState === 4) {
                    console.log(`[XHS Monitor] XHR请求完成: ${xhr._xhsUrl}, 状态: ${xhr.status}`);
                    
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
                        console.warn(`[XHS Monitor] 获取响应头失败:`, e);
                    }
                    
                    // 尝试多种方式获取响应体
                    let responseBody = null;
                    let responseMethod = 'none';
                    let responseError = null;
                    
                    try {
                        // 方法1: 尝试 responseText
                        if (xhr.responseText !== undefined && xhr.responseText !== null) {
                            responseBody = xhr.responseText;
                            responseMethod = 'responseText';
                            console.log(`[XHS Monitor] 通过responseText获取响应体: ${xhr._xhsUrl}, 长度: ${responseBody.length}`);
                        }
                        // 方法2: 如果responseText为空，尝试 response
                        else if (xhr.response !== undefined && xhr.response !== null) {
                            if (typeof xhr.response === 'string') {
                                responseBody = xhr.response;
                                responseMethod = 'response(string)';
                            } else if (xhr.response instanceof ArrayBuffer) {
                                const decoder = new TextDecoder('utf-8');
                                responseBody = decoder.decode(xhr.response);
                                responseMethod = 'response(ArrayBuffer)';
                            } else {
                                responseBody = JSON.stringify(xhr.response);
                                responseMethod = 'response(object)';
                            }
                            console.log(`[XHS Monitor] 通过response获取响应体: ${xhr._xhsUrl}, 方法: ${responseMethod}, 长度: ${responseBody?.length || 0}`);
                        }
                        // 方法3: 如果都为空，检查其他属性
                        else {
                            console.warn(`[XHS Monitor] 所有响应体获取方法都为空: ${xhr._xhsUrl}`);
                            console.log(`[XHS Monitor] 调试信息 - responseText: ${xhr.responseText}, response: ${xhr.response}, responseType: ${xhr.responseType}`);
                            responseError = `所有响应体为空 - responseText: ${xhr.responseText}, response: ${xhr.response}`;
                        }
                    } catch (bodyError) {
                        console.error(`[XHS Monitor] 获取响应体异常: ${xhr._xhsUrl}`, bodyError);
                        responseError = bodyError.message;
                    }
                    
                    // 发送响应事件
                    const responseEvent = {
                        url: xhr._xhsUrl,
                        method: (xhr._xhsMethod || 'GET').toUpperCase(),
                        type: 'xhr_response',
                        requestId: xhr._xhsRequestId,
                        timestamp: Date.now(),
                        captureRule: xhr._xhsCaptureRule,
                        response: {
                            status: xhr.status,
                            statusText: xhr.statusText,
                            headers: responseHeaders,
                            body: responseBody,
                            contentType: xhr.getResponseHeader('content-type'),
                            responseTime: Date.now() - xhr._xhsStartTime,
                            responseMethod: responseMethod,
                            responseType: xhr.responseType
                        }
                    };
                    
                    if (responseError) {
                        responseEvent.response.error = responseError;
                }
                
                    console.log(`[XHS Monitor] 发送XHR响应事件:`, {
                        url: responseEvent.url,
                        status: responseEvent.response.status,
                        bodyLength: responseEvent.response.body?.length || 0,
                        method: responseMethod,
                        error: responseError
                    });
                    
                    dispatchInterceptEvent(responseEvent);
                }
                
                // 调用原始的onreadystatechange
                if (originalOnReadyStateChange) {
                    originalOnReadyStateChange.apply(this, arguments);
                }
            };
            
            // 监听 load 事件作为备用
            const originalOnLoad = xhr.onload;
            xhr.onload = function() {
                console.log(`[XHS Monitor] XHR load事件触发: ${xhr._xhsUrl}`);
                
                // 如果readyState不是4，手动触发响应处理
                if (xhr.readyState !== 4) {
                    console.log(`[XHS Monitor] Load事件时readyState=${xhr.readyState}，手动处理响应`);
                    xhr.onreadystatechange();
                }
                
                if (originalOnLoad) {
                    originalOnLoad.apply(this, arguments);
                }
            };
        }
        
        return originalXHRSend.apply(this, arguments);
    };
}

export { interceptXHR }; 