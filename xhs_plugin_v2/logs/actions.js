import { state, elements } from './state.js';
import { renderLogs, updateStats, showLoading, showError } from './ui.js';
import { getStatusCategory } from './utils.js';

export function loadLogs() {
    showLoading(true);
    chrome.runtime.sendMessage({ action: 'getRequestLog' }, (response) => {
        if (chrome.runtime.lastError) {
            console.error('获取日志失败:', chrome.runtime.lastError);
            showError('获取日志失败: ' + chrome.runtime.lastError.message);
            return;
        }

        if (response && response.success) {
            state.allLogs = response.data || [];
            applyFilters();
            updateStats();
            renderLogs();
        } else {
            showError('获取日志失败');
        }
        showLoading(false);
    });
}

export function clearLogs() {
    if (confirm('确定要清空所有日志记录吗？此操作不可撤销。')) {
        chrome.runtime.sendMessage({ action: 'clearRequestLog' }, (response) => {
            if (response && response.success) {
                state.allLogs = [];
                state.filteredLogs = [];
                renderLogs();
                updateStats();
            } else {
                alert('清空日志失败');
            }
        });
    }
}

export function exportLogs() {
    if (state.allLogs.length === 0) {
        alert('没有日志数据可以导出');
        return;
    }
    chrome.runtime.sendMessage({ action: 'exportLog' }, (response) => {
        if (!response || !response.success) {
            alert('导出失败: ' + (response.error || '未知错误'));
        }
    });
}

export function applyFilters() {
    state.filteredLogs = state.allLogs.filter(log => {
        const { search, method, status } = state.currentFilters;
        if (search) {
            const searchText = search.toLowerCase();
            const matchUrl = log.url.toLowerCase().includes(searchText);
            const matchMethod = log.method.toLowerCase().includes(searchText);
            const matchStatus = log.statusCode && log.statusCode.toString().includes(searchText);
            if (!matchUrl && !matchMethod && !matchStatus) return false;
        }
        if (method && log.method !== method) return false;
        if (status && getStatusCategory(log) !== status) return false;
        return true;
    });
}

export function handleSearch() {
    state.currentFilters.search = elements.searchInput.value.trim();
    applyFilters();
    renderLogs();
    updateStats();
}

export function handleMethodFilter() {
    state.currentFilters.method = elements.methodFilter.value;
    applyFilters();
    renderLogs();
    updateStats();
}

export function handleStatusFilter() {
    state.currentFilters.status = elements.statusFilter.value;
    applyFilters();
    renderLogs();
    updateStats();
} 