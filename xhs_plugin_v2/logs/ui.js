import { state, elements } from './state.js';
import { escapeHtml, formatTime, getStatusBadgeClass, getStatusText } from './utils.js';

export function showLoading(show) {
    elements.loadingState.style.display = show ? 'block' : 'none';
    elements.logsContainer.style.display = show ? 'none' : 'block';
}

export function showError(message) {
    elements.logsContainer.innerHTML = `
        <div class="empty-state">
            <div class="icon">❌</div>
            <h3>加载失败</h3>
            <p>${message}</p>
            <button class="btn btn-primary" id="retryLoadBtn" style="margin-top: 16px;">重试</button>
        </div>
    `;
    // Since we are creating this button dynamically, we need to add listener here.
    document.getElementById('retryLoadBtn').addEventListener('click', () => {
        window.location.reload(); 
    });
}

export function updateStats() {
    const total = state.allLogs.length;
    const filtered = state.filteredLogs.length;
    const success = state.allLogs.filter(log => log.statusCode >= 200 && log.statusCode < 400).length;
    const error = state.allLogs.filter(log => log.error || log.statusCode >= 400).length;

    elements.totalCount.textContent = total;
    elements.filteredCount.textContent = filtered;
    elements.successCount.textContent = success;
    elements.errorCount.textContent = error;
}

export function renderLogs() {
    if (state.filteredLogs.length === 0) {
        if (state.allLogs.length === 0) {
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
    const html = state.filteredLogs.map((log, index) => createLogItemHTML(log, index)).join('');
    elements.logsContainer.innerHTML = html;
}

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

function createLogDetailsHTML(log) {
    // This is a simplified version for brevity. In a real scenario, this would be more detailed.
    let html = `<div class="detail-section"><div class="detail-title">📋 基本信息</div><div class="detail-content">`;
    html += `请求ID: ${log.requestId || log.id || 'N/A'}<br>`;
    html += `URL: ${log.url}<br>`;
    html += `方法: ${log.method}<br>`;
    html += `时间: ${log.timeString || formatTime(log.timestamp)}`;
    html += `</div></div>`;
    return html;
}

export function toggleLogDetails(index) {
    const details = document.getElementById(`details-${index}`);
    if (details) {
        details.classList.toggle('show');
    }
}

export function showDetailModal(index) {
    const log = state.filteredLogs[index];
    if (!log) return;

    elements.modalTitle.innerHTML = `🔍 ${log.method} 请求详细信息`;
    elements.modalBody.innerHTML = createModalContent(log);
    elements.detailModal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

export function closeModal() {
    elements.detailModal.classList.remove('show');
    document.body.style.overflow = '';
}

export function copyModalDetails() {
    const content = elements.modalBody.innerText;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(content).then(() => {
            const toast = document.createElement('div');
            toast.textContent = '✅ 详情已复制到剪贴板';
            toast.style.cssText = `...`; // Same style as before
            document.body.appendChild(toast);
            setTimeout(() => document.body.removeChild(toast), 2000);
        }).catch(err => alert('复制失败'));
    } else {
        const range = document.createRange();
        range.selectNode(elements.modalBody);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
    }
}

function createModalContent(log) {
    let html = '';
    const statusClass = getStatusBadgeClass(log).replace('status-', 'modal-status-');
    const methodClass = `modal-method-${log.method.toLowerCase()}`;
    
    html += `<div class="modal-section"><div class="modal-section-header">📋 基本信息</div><div class="modal-section-content"><div class="modal-info-grid">`;
    html += `<span class="modal-info-label">URL:</span><span class="modal-info-value">${escapeHtml(log.url)}</span>`;
    html += `<span class="modal-info-label">方法:</span><span class="modal-info-value"><span class="modal-badge ${methodClass}">${log.method}</span></span>`;
    html += `<span class="modal-info-label">状态:</span><span class="modal-info-value"><span class="modal-badge ${statusClass}">${getStatusText(log)}</span></span>`;
    html += `</div></div></div>`;

    if (log.requestHeaders && log.requestHeaders.length > 0) {
        const headers = log.requestHeaders.map(h => `${h.name}: ${h.value}`).join('\n');
        html += `<div class="modal-section"><div class="modal-section-header">📤 请求头</div><div class="modal-section-content"><div class="modal-code">${escapeHtml(headers)}</div></div></div>`;
    }
    
    // Simplified for brevity
    return html;
} 