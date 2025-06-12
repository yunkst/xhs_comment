import { appState, elements } from './state.js';
import * as sso from './sso.js';
import { clearLogs, refreshCaptureRules, filterAndDisplayLog } from './actions.js';
import { updateAllUI } from './ui.js';

function openPage(url) {
    chrome.tabs.create({ url });
}

function openOptionsPage(e) {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
}

function handleMessage(request, sender, sendResponse) {
    if (request.action === 'updateLog') {
        appState.currentRequestLog = request.data;
        filterAndDisplayLog();
    }
}

export function setupEventListeners() {
    elements.ssoStartLogin.addEventListener('click', sso.startSsoLogin);
    elements.ssoCheckLogin.addEventListener('click', () => sso.checkSsoLoginStatus(false));
    elements.logoutBtn.addEventListener('click', sso.logout);

    elements.viewLogsBtn.addEventListener('click', () => openPage(chrome.runtime.getURL('logs.html')));
    elements.clearLogsBtn.addEventListener('click', clearLogs);

    elements.configPageLink.addEventListener('click', openOptionsPage);
    elements.configLink.addEventListener('click', openOptionsPage);
    elements.helpLink.addEventListener('click', () => openPage('https://github.com/your-repo/issues')); // Replace with actual help link
    elements.aboutLink.addEventListener('click', () => openPage('https://github.com/your-repo')); // Replace with actual about link
    
    if (elements.refreshRulesBtn) {
        elements.refreshRulesBtn.addEventListener('click', refreshCaptureRules);
    }

    if (elements.filterSelect) {
        elements.filterSelect.addEventListener('change', function() {
            appState.currentFilter = this.value;
            filterAndDisplayLog();
        });
    }

    if (elements.optionsLink) {
        elements.optionsLink.addEventListener('click', openOptionsPage);
    }
    
    if (elements.logsLink) {
        elements.logsLink.addEventListener('click', (e) => {
            e.preventDefault();
            openPage(chrome.runtime.getURL('logs.html'));
        });
    }

    chrome.runtime.onMessage.addListener(handleMessage);

    window.addEventListener('beforeunload', () => {
        sso.stopSsoPolling();
    });
} 