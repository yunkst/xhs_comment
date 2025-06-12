// logs/state.js

export const state = {
    allLogs: [],
    filteredLogs: [],
    currentFilters: {
        search: '',
        method: '',
        status: ''
    }
};

export const elements = {
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
    detailModal: document.getElementById('detailModal'),
    modalTitle: document.getElementById('modalTitle'),
    modalBody: document.getElementById('modalBody'),
    modalClose: document.getElementById('modalClose'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    copyDetailsBtn: document.getElementById('copyDetailsBtn')
}; 