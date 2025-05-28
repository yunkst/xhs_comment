// 日志查看页面JavaScript逻辑
(function() {
    'use strict';

    // 全局状态
    let allLogs = [];
    let filteredLogs = [];
    let currentFilters = {
        search: '',
        method: '',
        status: ''
    };

    // DOM 元素
    const elements = {
        loadingState: document.getElementById('loadingState'),
        emptyState: document.getElementById('emptyState'),
        logsContainer: document.getElementById('logsContainer'),
        searchInput: document.getElementById('searchInput'),
        methodFilter: document.getElementById('methodFilter'),
        statusFilter: document.getElementById('statusFilter'),
        refreshBtn: document.getElementById('refreshBtn'),
        clearBtn: document.getElementById('clearBtn'),
        exportBtn: document.getElementById('exportBtn'),
        totalCount: document.getElementById('totalCount'),
        filteredCount: document.getElementById('filteredCount'),
        successCount: document.getElementById('successCount'),
        errorCount: document.getElementById('errorCount')
    };

    // 初始化
    document.addEventListener('DOMContentLoaded', function() {
        setupEventListeners();
        loadLogs();
    });

    // 设置事件监听器
    function setupEventListeners() {
        // 搜索和过滤
        elements.searchInput.addEventListener('input', debounce(handleSearch, 300));
        elements.methodFilter.addEventListener('change', handleMethodFilter);
        elements.statusFilter.addEventListener('change', handleStatusFilter);

        // 按钮事件
        elements.refreshBtn.addEventListener('click', loadLogs);
        elements.clearBtn.addEventListener('click', clearLogs);
        elements.exportBtn.addEventListener('click', exportLogs);
    }

    // 防抖函数
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // 加载日志数据
    function loadLogs() {
        showLoading(true);
        
        chrome.runtime.sendMessage({ action: 'getRequestLog' }, function(response) {
            if (chrome.runtime.lastError) {
                console.error('获取日志失败:', chrome.runtime.lastError);
                showError('获取日志失败: ' + chrome.runtime.lastError.message);
                return;
            }

            if (response && response.success) {
                allLogs = response.log || [];
                applyFilters();
                updateStats();
                renderLogs();
            } else {
                console.error('获取日志失败:', response);
                showError('获取日志失败');
            }
            
            showLoading(false);
        });
    }

    // 显示加载状态
    function showLoading(show) {
        elements.loadingState.style.display = show ? 'block' : 'none';
        elements.logsContainer.style.display = show ? 'none' : 'block';
    }

    // 显示错误
    function showError(message) {
        elements.logsContainer.innerHTML = `
            <div class="empty-state">
                <div class="icon">❌</div>
                <h3>加载失败</h3>
                <p>${message}</p>
                <button class="btn btn-primary" onclick="loadLogs()" style="margin-top: 16px;">重试</button>
            </div>
        `;
    }

    // 处理搜索
    function handleSearch() {
        currentFilters.search = elements.searchInput.value.trim().toLowerCase();
        applyFilters();
        renderLogs();
        updateStats();
    }

    // 处理方法过滤
    function handleMethodFilter() {
        currentFilters.method = elements.methodFilter.value;
        applyFilters();
        renderLogs();
        updateStats();
    }

    // 处理状态过滤
    function handleStatusFilter() {
        currentFilters.status = elements.statusFilter.value;
        applyFilters();
        renderLogs();
        updateStats();
    }

    // 应用过滤器
    function applyFilters() {
        filteredLogs = allLogs.filter(log => {
            // 搜索过滤
            if (currentFilters.search) {
                const searchText = currentFilters.search;
                const matchUrl = log.url.toLowerCase().includes(searchText);
                const matchMethod = log.method.toLowerCase().includes(searchText);
                const matchStatus = log.statusCode && log.statusCode.toString().includes(searchText);
                
                if (!matchUrl && !matchMethod && !matchStatus) {
                    return false;
                }
            }

            // 方法过滤
            if (currentFilters.method && log.method !== currentFilters.method) {
                return false;
            }

            // 状态过滤
            if (currentFilters.status) {
                const status = getStatusCategory(log);
                if (status !== currentFilters.status) {
                    return false;
                }
            }

            return true;
        });
    }

    // 获取状态分类
    function getStatusCategory(log) {
        if (log.error) return 'error';
        if (!log.statusCode) return 'error';
        
        const status = log.statusCode;
        if (status >= 200 && status < 300) return '2xx';
        if (status >= 300 && status < 400) return '3xx';
        if (status >= 400 && status < 500) return '4xx';
        if (status >= 500) return '5xx';
        
        return 'error';
    }

    // 更新统计信息
    function updateStats() {
        const total = allLogs.length;
        const filtered = filteredLogs.length;
        const success = allLogs.filter(log => log.statusCode >= 200 && log.statusCode < 400).length;
        const error = allLogs.filter(log => log.error || log.statusCode >= 400).length;

        elements.totalCount.textContent = total;
        elements.filteredCount.textContent = filtered;
        elements.successCount.textContent = success;
        elements.errorCount.textContent = error;
    }

    // 渲染日志列表
    function renderLogs() {
        if (filteredLogs.length === 0) {
            if (allLogs.length === 0) {
                elements.emptyState.style.display = 'block';
                elements.logsContainer.innerHTML = '';
            } else {
                elements.emptyState.style.display = 'none';
                elements.logsContainer.innerHTML = `
                    <div class="empty-state">
                        <div class="icon">🔍</div>
                        <h3>没有匹配的记录</h3>
                        <p>尝试调整搜索条件或过滤器</p>
                    </div>
                `;
            }
            return;
        }

        elements.emptyState.style.display = 'none';
        
        const html = filteredLogs.map((log, index) => createLogItemHTML(log, index)).join('');
        elements.logsContainer.innerHTML = html;

        // 绑定点击事件
        bindLogItemEvents();
    }

    // 创建日志项HTML
    function createLogItemHTML(log, index) {
        const methodClass = `method-${log.method.toLowerCase()}`;
        const statusClass = getStatusBadgeClass(log);
        const statusText = getStatusText(log);
        
        return `
            <div class="log-item" data-index="${index}">
                <div class="log-header" onclick="toggleLogDetails(${index})">
                    <span class="method-badge ${methodClass}">${log.method}</span>
                    <span class="log-url">${escapeHtml(log.url)}</span>
                    <span class="log-time">${log.timeString || formatTime(log.timestamp)}</span>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
                <div class="log-details" id="details-${index}">
                    ${createLogDetailsHTML(log)}
                </div>
            </div>
        `;
    }

    // 获取状态徽章样式类
    function getStatusBadgeClass(log) {
        if (log.error) return 'status-error';
        if (!log.statusCode) return 'status-error';
        
        const status = log.statusCode;
        if (status >= 200 && status < 300) return 'status-2xx';
        if (status >= 300 && status < 400) return 'status-3xx';
        if (status >= 400 && status < 500) return 'status-4xx';
        if (status >= 500) return 'status-5xx';
        
        return 'status-error';
    }

    // 获取状态文本
    function getStatusText(log) {
        if (log.error) return `错误: ${log.error}`;
        if (log.statusCode) return log.statusCode.toString();
        return '未知';
    }

    // 创建日志详情HTML
    function createLogDetailsHTML(log) {
        let html = '';

        // 基本信息
        html += `
            <div class="detail-section">
                <div class="detail-title">📋 基本信息</div>
                <div class="detail-content">请求ID: ${log.requestId || log.id || 'N/A'}
URL: ${log.url}
方法: ${log.method}
类型: ${log.type || 'N/A'}
时间: ${log.timeString || formatTime(log.timestamp)}
来源: ${log.source || 'webRequest'}
标签页ID: ${log.tabId || 'N/A'}</div>
            </div>
        `;

        // 请求头
        if (log.requestHeaders && log.requestHeaders.length > 0) {
            const headers = log.requestHeaders.map(h => `${h.name}: ${h.value}`).join('\n');
            html += `
                <div class="detail-section">
                    <div class="detail-title">📤 请求头</div>
                    <div class="detail-content">${escapeHtml(headers)}</div>
                </div>
            `;
        }

        // 请求体
        if (log.requestBody) {
            let bodyText = '';
            if (log.requestBody.raw && log.requestBody.raw.length > 0) {
                try {
                    const decoder = new TextDecoder();
                    bodyText = decoder.decode(log.requestBody.raw[0].bytes);
                } catch (e) {
                    bodyText = '[二进制数据]';
                }
            } else if (typeof log.requestBody === 'string') {
                bodyText = log.requestBody;
            } else {
                bodyText = JSON.stringify(log.requestBody, null, 2);
            }
            
            html += `
                <div class="detail-section">
                    <div class="detail-title">📤 请求体</div>
                    <div class="detail-content">${escapeHtml(bodyText)}</div>
                </div>
            `;
        }

        // 响应头
        if (log.responseHeaders && log.responseHeaders.length > 0) {
            const headers = log.responseHeaders.map(h => `${h.name}: ${h.value}`).join('\n');
            html += `
                <div class="detail-section">
                    <div class="detail-title">📥 响应头</div>
                    <div class="detail-content">${escapeHtml(headers)}</div>
                </div>
            `;
        }

        // 响应体
        if (log.response && log.response.body) {
            html += `
                <div class="detail-section">
                    <div class="detail-title">📥 响应体</div>
                    <div class="detail-content">${escapeHtml(log.response.body)}</div>
                </div>
            `;
        }

        // 性能数据
        if (log.performanceData) {
            const perfData = JSON.stringify(log.performanceData, null, 2);
            html += `
                <div class="detail-section">
                    <div class="detail-title">⚡ 性能数据</div>
                    <div class="detail-content">${escapeHtml(perfData)}</div>
                </div>
            `;
        }

        // 错误信息
        if (log.error) {
            html += `
                <div class="detail-section">
                    <div class="detail-title">❌ 错误信息</div>
                    <div class="detail-content">${escapeHtml(log.error)}</div>
                </div>
            `;
        }

        return html;
    }

    // 绑定日志项事件
    function bindLogItemEvents() {
        // 事件已通过onclick绑定，这里可以添加其他事件
    }

    // 切换日志详情显示
    window.toggleLogDetails = function(index) {
        const details = document.getElementById(`details-${index}`);
        if (details) {
            details.classList.toggle('show');
        }
    };

    // 清空日志
    function clearLogs() {
        if (confirm('确定要清空所有日志记录吗？此操作不可撤销。')) {
            chrome.runtime.sendMessage({ action: 'clearLogs' }, function(response) {
                if (response && response.success) {
                    allLogs = [];
                    filteredLogs = [];
                    renderLogs();
                    updateStats();
                } else {
                    alert('清空日志失败');
                }
            });
        }
    }

    // 导出日志
    function exportLogs() {
        if (allLogs.length === 0) {
            alert('没有日志数据可以导出');
            return;
        }

        chrome.runtime.sendMessage({ action: 'exportLog' }, function(response) {
            if (response && response.success) {
                // 导出成功，文件已开始下载
            } else {
                alert('导出失败: ' + (response.error || '未知错误'));
            }
        });
    }

    // 格式化时间
    function formatTime(timestamp) {
        if (!timestamp) return 'N/A';
        return new Date(timestamp).toLocaleString('zh-CN');
    }

    // HTML转义
    function escapeHtml(text) {
        if (typeof text !== 'string') {
            text = String(text);
        }
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 监听来自background的消息
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'statsUpdated') {
            // 统计数据更新，重新加载日志
            loadLogs();
        }
    });

    console.log('日志查看页面已加载');

})(); 