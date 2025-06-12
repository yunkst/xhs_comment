import { isXHSUrl, dispatchInterceptEvent } from './utils.js';

const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSend = XMLHttpRequest.prototype.send;
const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

function interceptXHR() {
    XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
        if (isXHSUrl(url)) {
            this._xhsMethod = method;
            this._xhsUrl = url;
            this._xhsHeaders = {};
            this._xhsRequestId = `xhr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            this._xhsStartTime = Date.now();
        }
        return originalXHROpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
        if (this._xhsUrl && isXHSUrl(this._xhsUrl)) {
            this._xhsHeaders[name] = value;
        }
        return originalSetRequestHeader.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function(data) {
        if (this._xhsUrl && isXHSUrl(this._xhsUrl)) {
            const xhr = this;
            
            dispatchInterceptEvent({
                url: this._xhsUrl,
                method: (this._xhsMethod || 'GET').toUpperCase(),
                headers: this._xhsHeaders || {},
                body: data || null,
                type: 'xhr',
                requestId: this._xhsRequestId,
                timestamp: Date.now()
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