// DOM 元素
const requestCountEl = document.getElementById('requestCount');
const requestListEl = document.getElementById('requestList');
const refreshBtn = document.getElementById('refreshBtn');
const clearBtn = document.getElementById('clearBtn');
const exportBtn = document.getElementById('exportBtn');
const filterInput = document.getElementById('filterInput');
const methodFilter = document.getElementById('methodFilter');

// 存储当前的请求数据
let currentRequests = [];
let filteredRequests = [];

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    loadRequestData();
    setupEventListeners();
    addConfigButton();
});

// 设置事件监听器
function setupEventListeners() {
    refreshBtn.addEventListener('click', loadRequestData);
    clearBtn.addEventListener('click', clearRequestLog);
    exportBtn.addEventListener('click', exportRequestLog);
    
    // 过滤器事件
    filterInput.addEventListener('input', applyFilters);
    methodFilter.addEventListener('change', applyFilters);
}

// 添加配置按钮
function addConfigButton() {
    const configBtn = document.createElement('button');
    configBtn.innerHTML = '⚙️ 配置';
    configBtn.className = 'config-btn';
    configBtn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #667eea;
        color: white;
        border: none;
        border-radius: 20px;
        padding: 8px 16px;
        font-size: 12px;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        z-index: 1000;
        transition: 0.3s;
    `;
    
    configBtn.addEventListener('click', function() {
        chrome.runtime.openOptionsPage();
    });
    
    configBtn.addEventListener('mouseover', function() {
        this.style.background = '#5a6fd8';
        this.style.transform = 'translateY(-1px)';
    });
    
    configBtn.addEventListener('mouseout', function() {
        this.style.background = '#667eea';
        this.style.transform = 'translateY(0)';
    });
    
    document.body.appendChild(configBtn);
}

// 加载请求数据
function loadRequestData() {
    console.log('[Popup Debug] 开始加载请求数据...');
    
    chrome.runtime.sendMessage({action: 'getRequestLog'}, function(response) {
        console.log('[Popup Debug] 收到background响应:', response);
        
        if (chrome.runtime.lastError) {
            console.error('[Popup Debug] Chrome runtime错误:', chrome.runtime.lastError);
            showEmptyState();
            return;
        }
        
        if (!response) {
            console.warn('[Popup Debug] 响应为空');
            showEmptyState();
            return;
        }
        
        if (response.log) {
            console.log('[Popup Debug] 日志数据长度:', response.log.length);
            console.log('[Popup Debug] 前3条记录:', response.log.slice(0, 3));
            
            currentRequests = response.log;
            applyFilters();
            updateRequestCount(response.totalCount);
            
            // 显示配置信息
            if (response.config) {
                console.log('[Popup Debug] 配置信息:', response.config);
                showConfigStatus(response.config);
            }
        } else {
            console.warn('[Popup Debug] 响应中无log字段:', Object.keys(response));
            showEmptyState();
        }
    });
}

// 显示配置状态
function showConfigStatus(config) {
    if (!config.enableMonitoring) {
        showConfigWarning('监控已禁用', '请在配置页面启用监控功能');
    } else if (config.urlPatterns.length === 0) {
        showConfigWarning('无监控规则', '请在配置页面添加URL监控规则');
    } else {
        const enabledPatterns = config.urlPatterns.filter(p => p.enabled);
        if (enabledPatterns.length === 0) {
            showConfigWarning('所有规则已禁用', '请在配置页面启用至少一个URL规则');
        }
    }
}

// 显示配置警告
function showConfigWarning(title, message) {
    const warningEl = document.createElement('div');
    warningEl.className = 'config-warning';
    warningEl.innerHTML = `
        <div style="
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 12px;
            margin: 10px 0;
            color: #856404;
            font-size: 12px;
        ">
            <strong>⚠️ ${title}</strong><br>
            ${message}
            <br><button onclick="chrome.runtime.openOptionsPage()" style="
                background: #ffc107;
                border: none;
                border-radius: 4px;
                padding: 4px 8px;
                margin-top: 6px;
                font-size: 11px;
                cursor: pointer;
            ">打开配置</button>
        </div>
    `;
    
    // 插入到请求计数后面
    const targetEl = document.querySelector('.header') || document.body;
    targetEl.appendChild(warningEl);
}

// 应用过滤器
function applyFilters() {
    const urlFilter = filterInput.value.toLowerCase().trim();
    const method = methodFilter.value;
    
    filteredRequests = currentRequests.filter(request => {
        const matchesUrl = !urlFilter || request.url.toLowerCase().includes(urlFilter);
        const matchesMethod = !method || request.method === method;
        return matchesUrl && matchesMethod;
    });
    
    renderRequestList();
}

// 渲染请求列表
function renderRequestList() {
    if (filteredRequests.length === 0) {
        showEmptyState();
        return;
    }
    
    const html = filteredRequests.map(request => createRequestItemHTML(request)).join('');
    requestListEl.innerHTML = html;
    
    // 添加点击事件
    const requestItems = requestListEl.querySelectorAll('.request-item');
    requestItems.forEach((item, index) => {
        item.addEventListener('click', () => toggleRequestDetails(index));
    });
}

// 创建请求项HTML
function createRequestItemHTML(request) {
    const statusClass = getStatusClass(request.statusCode);
    const methodClass = `method-${request.method}`;
    const url = truncateUrl(request.url, 50);
    
    return `
        <div class="request-item">
            <div class="request-header">
                <span class="request-method ${methodClass}">${request.method}</span>
                <span class="request-url" title="${request.url}">${url}</span>
                <div>
                    <span class="request-time">${request.timeString}</span>
                    ${request.responseTime ? `<span class="request-time">${request.responseTime}ms</span>` : ''}
                    ${request.statusCode ? `<span class="request-status ${statusClass}">${request.statusCode}</span>` : ''}
                    ${request.status === 'error' ? '<span class="request-status status-error">ERROR</span>' : ''}
                </div>
            </div>
            <div class="request-details">
                ${createRequestDetailsHTML(request)}
            </div>
        </div>
    `;
}

// 创建请求详情HTML
function createRequestDetailsHTML(request) {
    let html = `
        <div class="detail-section">
            <div class="detail-title">请求URL</div>
            <div class="detail-content">${request.url}</div>
        </div>
        
        <div class="detail-section">
            <div class="detail-title">请求方法</div>
            <div class="detail-content">${request.method}</div>
        </div>
        
        <div class="detail-section">
            <div class="detail-title">请求类型</div>
            <div class="detail-content">${request.type || 'Unknown'}</div>
        </div>
        
        <div class="detail-section">
            <div class="detail-title">时间戳</div>
            <div class="detail-content">${request.timeString} (${request.timestamp})</div>
        </div>
    `;
    
    if (request.statusCode) {
        html += `
            <div class="detail-section">
                <div class="detail-title">状态码</div>
                <div class="detail-content">${request.statusCode}</div>
            </div>
        `;
    }
    
    if (request.requestHeaders && request.requestHeaders.length > 0) {
        html += `
            <div class="detail-section">
                <div class="detail-title">请求头</div>
                <div class="detail-content">${formatHeaders(request.requestHeaders)}</div>
            </div>
        `;
    }
    
    if (request.responseHeaders && request.responseHeaders.length > 0) {
        html += `
            <div class="detail-section">
                <div class="detail-title">响应头</div>
                <div class="detail-content">${formatHeaders(request.responseHeaders)}</div>
            </div>
        `;
    }
    
    if (request.requestBody) {
        html += `
            <div class="detail-section">
                <div class="detail-title">请求体</div>
                <div class="detail-content">${formatRequestBody(request.requestBody)}</div>
            </div>
        `;
    }
    
    if (request.responseTime) {
        html += `
            <div class="detail-section">
                <div class="detail-title">响应时间</div>
                <div class="detail-content">${request.responseTime}ms</div>
            </div>
        `;
    }
    
    if (request.response) {
        html += `
            <div class="detail-section">
                <div class="detail-title">响应状态</div>
                <div class="detail-content">${request.response.status} ${request.response.statusText || ''}</div>
            </div>
        `;
        
        if (request.response.contentType) {
            html += `
                <div class="detail-section">
                    <div class="detail-title">内容类型</div>
                    <div class="detail-content">${request.response.contentType}</div>
                </div>
            `;
        }
        
        if (request.response.body) {
            html += `
                <div class="detail-section">
                    <div class="detail-title">响应体</div>
                    <div class="detail-content">${formatResponseBody(request.response.body, request.response.contentType)}</div>
                </div>
            `;
        }
    }
    
    if (request.responseSize || request.contentLength) {
        html += `
            <div class="detail-section">
                <div class="detail-title">响应大小</div>
                <div class="detail-content">${formatBytes(request.responseSize || parseInt(request.contentLength) || 0)}</div>
            </div>
        `;
    }
    
    if (request.performanceData) {
        html += `
            <div class="detail-section">
                <div class="detail-title">性能数据</div>
                <div class="detail-content">
                    传输大小: ${formatBytes(request.performanceData.transferSize || 0)}<br>
                    编码大小: ${formatBytes(request.performanceData.encodedBodySize || 0)}<br>
                    解码大小: ${formatBytes(request.performanceData.decodedBodySize || 0)}<br>
                    持续时间: ${request.performanceData.duration ? request.performanceData.duration.toFixed(2) + 'ms' : 'N/A'}<br>
                    发起类型: ${request.performanceData.initiatorType || 'Unknown'}
                </div>
            </div>
        `;
    }
    
    if (request.error) {
        html += `
            <div class="detail-section">
                <div class="detail-title">错误信息</div>
                <div class="detail-content">${request.error}</div>
            </div>
        `;
    }
    
    return html;
}

// 格式化请求头
function formatHeaders(headers) {
    return headers.map(header => `${header.name}: ${header.value}`).join('\n');
}

// 格式化请求体
function formatRequestBody(requestBody) {
    if (!requestBody) return '';
    
    if (requestBody.formData) {
        return Object.entries(requestBody.formData)
            .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
            .join('\n');
    }
    
    if (requestBody.raw && requestBody.raw.length > 0) {
        return requestBody.raw.map(item => {
            if (item.bytes) {
                try {
                    const decoder = new TextDecoder('utf-8');
                    return decoder.decode(new Uint8Array(item.bytes));
                } catch (e) {
                    return '[Binary Data]';
                }
            }
            return item.file || '[Unknown]';
        }).join('\n');
    }
    
    return JSON.stringify(requestBody, null, 2);
}

// 切换请求详情显示
function toggleRequestDetails(index) {
    const requestItem = requestListEl.children[index];
    const detailsEl = requestItem.querySelector('.request-details');
    
    if (detailsEl.classList.contains('show')) {
        detailsEl.classList.remove('show');
    } else {
        // 先关闭其他所有展开的详情
        const allDetails = requestListEl.querySelectorAll('.request-details.show');
        allDetails.forEach(detail => detail.classList.remove('show'));
        
        // 展开当前项
        detailsEl.classList.add('show');
    }
}

// 获取状态码对应的CSS类
function getStatusClass(statusCode) {
    if (!statusCode) return '';
    
    if (statusCode >= 200 && statusCode < 300) return 'status-2xx';
    if (statusCode >= 300 && statusCode < 400) return 'status-3xx';
    if (statusCode >= 400 && statusCode < 500) return 'status-4xx';
    if (statusCode >= 500) return 'status-5xx';
    
    return '';
}

// 截断URL
function truncateUrl(url, maxLength) {
    if (url.length <= maxLength) return url;
    
    const start = url.substring(0, Math.floor(maxLength / 2));
    const end = url.substring(url.length - Math.floor(maxLength / 2));
    
    return `${start}...${end}`;
}

// 更新请求计数
function updateRequestCount(count) {
    requestCountEl.textContent = count || 0;
}

// 显示空状态
function showEmptyState() {
    requestListEl.innerHTML = `
        <div class="empty-state">
            <h3>暂无请求记录</h3>
            <p>访问小红书网站以开始监控网络请求</p>
        </div>
    `;
}

// 清空请求日志
function clearRequestLog() {
    if (confirm('确定要清空所有请求记录吗？')) {
        chrome.runtime.sendMessage({action: 'clearLog'}, function(response) {
            if (response && response.success) {
                currentRequests = [];
                filteredRequests = [];
                updateRequestCount(0);
                showEmptyState();
            }
        });
    }
}

// 格式化响应体
function formatResponseBody(body, contentType) {
    if (!body) return '';
    
    // 限制显示长度
    const maxLength = 1000;
    let displayBody = body;
    
    if (body.length > maxLength) {
        displayBody = body.substring(0, maxLength) + '\n... (内容过长，已截断)';
    }
    
    // 根据内容类型格式化
    if (contentType && contentType.includes('application/json')) {
        try {
            const jsonObj = JSON.parse(body);
            return JSON.stringify(jsonObj, null, 2);
        } catch (e) {
            return displayBody;
        }
    } else if (contentType && contentType.includes('text/html')) {
        // HTML内容进行转义
        return displayBody.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    
    return displayBody;
}

// 格式化字节数
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    if (!bytes) return 'Unknown';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 导出请求日志
function exportRequestLog() {
    if (currentRequests.length === 0) {
        alert('没有请求记录可以导出');
        return;
    }
    
    // 显示导出中状态
    const originalText = exportBtn.textContent;
    exportBtn.textContent = '导出中...';
    exportBtn.disabled = true;
    
    chrome.runtime.sendMessage({action: 'exportLog'}, function(response) {
        // 恢复按钮状态
        exportBtn.disabled = false;
        
        if (response && response.success) {
            // 显示成功消息
            exportBtn.textContent = '导出成功!';
            exportBtn.style.background = '#28a745';
            
            setTimeout(() => {
                exportBtn.textContent = originalText;
                exportBtn.style.background = '';
            }, 2000);
        } else {
            // 显示错误消息
            exportBtn.textContent = '导出失败';
            exportBtn.style.background = '#dc3545';
            
            console.error('导出失败:', response ? response.error : '未知错误');
            alert('导出失败: ' + (response ? response.error : '未知错误'));
            
            setTimeout(() => {
                exportBtn.textContent = originalText;
                exportBtn.style.background = '';
            }, 3000);
        }
    });
} 