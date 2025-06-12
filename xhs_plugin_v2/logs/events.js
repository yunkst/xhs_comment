import { elements } from './state.js';
import { debounce } from './utils.js';
import { loadLogs, clearLogs, exportLogs, handleSearch, handleMethodFilter, handleStatusFilter } from './actions.js';
import { showDetailModal, closeModal, copyModalDetails, toggleLogDetails } from './ui.js';

export function setupEventListeners() {
    elements.searchInput.addEventListener('input', debounce(handleSearch, 300));
    elements.methodFilter.addEventListener('change', handleMethodFilter);
    elements.statusFilter.addEventListener('change', handleStatusFilter);

    elements.refreshBtn.addEventListener('click', loadLogs);
    elements.clearBtn.addEventListener('click', clearLogs);
    elements.exportBtn.addEventListener('click', exportLogs);

    elements.modalClose.addEventListener('click', closeModal);
    elements.closeModalBtn.addEventListener('click', closeModal);
    elements.copyDetailsBtn.addEventListener('click', copyModalDetails);
    
    elements.detailModal.addEventListener('click', (e) => {
        if (e.target === elements.detailModal) {
            closeModal();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && elements.detailModal.classList.contains('show')) {
            closeModal();
        }
    });

    elements.logsContainer.addEventListener('click', (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        
        const action = target.getAttribute('data-action');
        const item = target.closest('.log-item') || target.closest('.log-header');
        const index = item ? item.getAttribute('data-index') : null;

        if (index === null) return;

        if (action === 'detail') {
            e.stopPropagation();
            showDetailModal(parseInt(index, 10));
        } else if (action === 'toggle') {
            toggleLogDetails(parseInt(index, 10));
        }
    });

    chrome.runtime.onMessage.addListener((request) => {
        if (request.action === 'statsUpdated') {
            loadLogs();
        }
    });
} 