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
        errorCount: document.getElementById('errorCount'),
        // 弹框相关元素
        detailModal: document.getElementById('detailModal'),
        modalTitle: document.getElementById('modalTitle'),
        modalBody: document.getElementById('modalBody'),
        modalClose: document.getElementById('modalClose'),
        closeModalBtn: document.getElementById('closeModalBtn'),
        copyDetailsBtn: document.getElementById('copyDetailsBtn')
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

        // 弹框事件
        elements.modalClose.addEventListener('click', closeModal);
        elements.closeModalBtn.addEventListener('click', closeModal);
        elements.copyDetailsBtn.addEventListener('click', copyModalDetails);
        
        // 点击弹框背景关闭
        elements.detailModal.addEventListener('click', function(e) {
            if (e.target === elements.detailModal) {
                closeModal();
            }
        });

        // ESC键关闭弹框
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && elements.detailModal.classList.contains('show')) {
                closeModal();
            }
        });

        // 日志项事件委托
        elements.logsContainer.addEventListener('click', function(e) {
            const target = e.target;
            const action = target.getAttribute('data-action');
            const index = target.getAttribute('data-index');

            if (action === 'detail') {
                // 点击详情按钮
                e.stopPropagation();
                showDetailModal(parseInt(index));
            } else if (action === 'toggle') {
                // 点击日志头部，切换详情显示
                toggleLogDetails(parseInt(index));
            } else if (target.classList.contains('log-header') || target.closest('.log-header')) {
                // 点击日志头部区域（但不是详情按钮）
                const header = target.classList.contains('log-header') ? target : target.closest('.log-header');
                const headerIndex = header.getAttribute('data-index');
                if (headerIndex && !target.classList.contains('detail-btn')) {
                    toggleLogDetails(parseInt(headerIndex));
                }
            }
        });
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
                allLogs = response.data || [];
                console.log('[Logs] 成功加载日志数据，共', allLogs.length, '条记录');
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

        // 事件已通过事件委托处理，不需要单独绑定
    }

    // 创建日志项HTML
    function createLogItemHTML(log, index) {
        const methodClass = `method-${log.method.toLowerCase()}`;
        const statusClass = getStatusBadgeClass(log);
        const statusText = getStatusText(log);
        
        return `
            <div class="log-item" data-index="${index}">
                <div class="log-header" data-index="${index}" data-action="toggle">
                    <span class="method-badge ${methodClass}">${log.method}</span>
                    <span class="log-url">${escapeHtml(log.url)}</span>
                    <span class="log-time">${log.timeString || formatTime(log.timestamp)}</span>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                    <button class="btn btn-primary detail-btn" style="margin-left: 12px; padding: 6px 12px; font-size: 12px;" 
                            data-index="${index}" data-action="detail">
                        🔍 详情
                    </button>
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

    // 切换日志详情显示
    function toggleLogDetails(index) {
        const details = document.getElementById(`details-${index}`);
        if (details) {
            details.classList.toggle('show');
        }
    }

    // 清空日志
    function clearLogs() {
        if (confirm('确定要清空所有日志记录吗？此操作不可撤销。')) {
            chrome.runtime.sendMessage({ action: 'clearRequestLog' }, function(response) {
                if (response && response.success) {
                    allLogs = [];
                    filteredLogs = [];
                    renderLogs();
                    updateStats();
                    console.log('[Logs] 日志已清空');
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

    // 显示详情弹框
    function showDetailModal(index) {
        const log = filteredLogs[index];
        if (!log) return;

        // 设置弹框标题
        elements.modalTitle.innerHTML = `🔍 ${log.method} 请求详细信息`;
        
        // 生成详细内容
        elements.modalBody.innerHTML = createModalContent(log);
        
        // 显示弹框
        elements.detailModal.classList.add('show');
        document.body.style.overflow = 'hidden'; // 防止背景滚动
    }

    // 关闭弹框
    function closeModal() {
        elements.detailModal.classList.remove('show');
        document.body.style.overflow = ''; // 恢复滚动
    }

    // 复制详情到剪贴板
    function copyModalDetails() {
        const content = elements.modalBody.innerText;
        
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(content).then(() => {
                // 创建临时提示
                const toast = document.createElement('div');
                toast.textContent = '✅ 详情已复制到剪贴板';
                toast.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: #28a745;
                    color: white;
                    padding: 12px 16px;
                    border-radius: 6px;
                    z-index: 10001;
                    font-size: 14px;
                `;
                document.body.appendChild(toast);
                
                setTimeout(() => {
                    document.body.removeChild(toast);
                }, 2000);
            }).catch(err => {
                console.error('复制失败:', err);
                alert('复制失败，请手动选择文本复制');
            });
        } else {
            // 降级方案：选择文本
            const range = document.createRange();
            range.selectNode(elements.modalBody);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
        }
    }

    // 创建弹框内容
    function createModalContent(log) {
        let html = '';

        // 基本信息部分
        const statusClass = getStatusBadgeClass(log).replace('status-', 'modal-status-');
        const methodClass = `modal-method-${log.method.toLowerCase()}`;
        
        html += `
            <div class="modal-section">
                <div class="modal-section-header">
                    📋 基本信息
                </div>
                <div class="modal-section-content">
                    <div class="modal-info-grid">
                        <span class="modal-info-label">请求ID:</span>
                        <span class="modal-info-value">${log.requestId || log.id || 'N/A'}</span>
                        
                        <span class="modal-info-label">URL:</span>
                        <span class="modal-info-value">${escapeHtml(log.url)}</span>
                        
                        <span class="modal-info-label">请求方法:</span>
                        <span class="modal-info-value">
                            <span class="modal-badge ${methodClass}">${log.method}</span>
                        </span>
                        
                        <span class="modal-info-label">状态码:</span>
                        <span class="modal-info-value">
                            <span class="modal-badge ${statusClass}">${getStatusText(log)}</span>
                        </span>
                        
                        <span class="modal-info-label">请求类型:</span>
                        <span class="modal-info-value">${log.type || 'N/A'}</span>
                        
                        <span class="modal-info-label">时间戳:</span>
                        <span class="modal-info-value">${log.timeString || formatTime(log.timestamp)}</span>
                        
                        <span class="modal-info-label">数据来源:</span>
                        <span class="modal-info-value">${log.source || 'webRequest'}</span>
                        
                        <span class="modal-info-label">标签页ID:</span>
                        <span class="modal-info-value">${log.tabId || 'N/A'}</span>
                        
                        <span class="modal-info-label">框架ID:</span>
                        <span class="modal-info-value">${log.frameId || 'N/A'}</span>
                    </div>
                </div>
            </div>
        `;

        // 匹配规则信息
        if (log.matchedRule) {
            html += `
                <div class="modal-section">
                    <div class="modal-section-header">
                        🎯 匹配的抓取规则
                    </div>
                    <div class="modal-section-content">
                        <div class="modal-info-grid">
                            <span class="modal-info-label">规则名称:</span>
                            <span class="modal-info-value">${escapeHtml(log.matchedRule.name || 'N/A')}</span>
                            
                            <span class="modal-info-label">匹配模式:</span>
                            <span class="modal-info-value">${escapeHtml(log.matchedRule.pattern || 'N/A')}</span>
                            
                            <span class="modal-info-label">数据类型:</span>
                            <span class="modal-info-value">${escapeHtml(log.matchedRule.data_type || 'N/A')}</span>
                        </div>
                    </div>
                </div>
            `;
        }

        // 请求头
        if (log.requestHeaders && log.requestHeaders.length > 0) {
            const headers = log.requestHeaders.map(h => `${h.name}: ${h.value}`).join('\n');
            html += `
                <div class="modal-section">
                    <div class="modal-section-header">
                        📤 请求头 (${log.requestHeaders.length})
                    </div>
                    <div class="modal-section-content">
                        <div class="modal-code">${escapeHtml(headers)}</div>
                    </div>
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
                <div class="modal-section">
                    <div class="modal-section-header">
                        📤 请求体
                    </div>
                    <div class="modal-section-content">
                        <div class="modal-code">${escapeHtml(bodyText)}</div>
                    </div>
                </div>
            `;
        }

        // 响应头
        if (log.responseHeaders && log.responseHeaders.length > 0) {
            const headers = log.responseHeaders.map(h => `${h.name}: ${h.value}`).join('\n');
            html += `
                <div class="modal-section">
                    <div class="modal-section-header">
                        📥 响应头 (${log.responseHeaders.length})
                    </div>
                    <div class="modal-section-content">
                        <div class="modal-code">${escapeHtml(headers)}</div>
                    </div>
                </div>
            `;
        }

        // 响应体
        if (log.response && log.response.body) {
            html += `
                <div class="modal-section">
                    <div class="modal-section-header">
                        📥 响应体
                    </div>
                    <div class="modal-section-content">
                        <div class="modal-code">${escapeHtml(log.response.body)}</div>
                    </div>
                </div>
            `;
        }

        // 性能数据
        if (log.performanceData) {
            const perfData = JSON.stringify(log.performanceData, null, 2);
            html += `
                <div class="modal-section">
                    <div class="modal-section-header">
                        ⚡ 性能数据
                    </div>
                    <div class="modal-section-content">
                        <div class="modal-code">${escapeHtml(perfData)}</div>
                    </div>
                </div>
            `;
        }

        // 错误信息
        if (log.error) {
            html += `
                <div class="modal-section">
                    <div class="modal-section-header">
                        ❌ 错误信息
                    </div>
                    <div class="modal-section-content">
                        <div class="modal-code" style="color: #dc3545;">${escapeHtml(log.error)}</div>
                    </div>
                </div>
            `;
        }

        return html;
    }

    console.log('日志查看页面已加载');

})(); 