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
            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
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
                        // ignore
                    }
                    
                    dispatchInterceptEvent({
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
                            body: xhr.responseText || xhr.response,
                            contentType: xhr.getResponseHeader('content-type'),
                            responseTime: Date.now() - xhr._xhsStartTime
                        }
                    });
                }
                
                if (originalOnReadyStateChange) {
                    originalOnReadyStateChange.apply(this, arguments);
                }
            };
        }
        
        return originalXHRSend.apply(this, arguments);
    };
}

export { interceptXHR }; 