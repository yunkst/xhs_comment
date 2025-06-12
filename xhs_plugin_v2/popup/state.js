/**
 * DOM 元素引用
 */
export const elements = {
    apiStatusIndicator: document.getElementById('apiStatusIndicator'),
    apiStatusText: document.getElementById('apiStatusText'),
    ssoContainer: document.getElementById('ssoContainer'),
    ssoStartLogin: document.getElementById('ssoStartLogin'),
    ssoCheckLogin: document.getElementById('ssoCheckLogin'),
    logoutContainer: document.getElementById('logoutContainer'),
    logoutBtn: document.getElementById('logoutBtn'),
    totalRequests: document.getElementById('totalRequests'),
    todayRequests: document.getElementById('todayRequests'),
    viewLogsBtn: document.getElementById('viewLogsBtn'),
    clearLogsBtn: document.getElementById('clearLogsBtn'),
    emptyState: document.getElementById('emptyState'),
    configWarning: document.getElementById('configWarning'),
    configPageLink: document.getElementById('configPageLink'),
    configLink: document.getElementById('configLink'),
    helpLink: document.getElementById('helpLink'),
    aboutLink: document.getElementById('aboutLink'),
    captureRulesInfo: document.getElementById('captureRulesInfo'),
    rulesList: document.getElementById('rulesList'),
    refreshRulesBtn: document.getElementById('refreshRulesBtn'),
    requestLogContainer: document.getElementById('requestLogContainer'),
    filterSelect: document.getElementById('filterSelect'),
    optionsLink: document.getElementById('optionsLink'),
    logsLink: document.getElementById('logsLink')
};

/**
 * Popup 页面的应用状态
 */
export let appState = {
    apiConfig: {
        host: '',
        token: '',
        refreshToken: ''
    },
    ssoSession: {
        id: null,
        status: 'idle', // 'idle', 'pending', 'completed', 'failed'
        pollInterval: null,
        pollCount: 0,
        maxPollCount: 60
    },
    requestStats: {
        total: 0,
        today: 0
    },
    config: null,
    currentRequestLog: [],
    filteredLog: [],
    currentFilter: 'all',
    ssoConfig: {},
    captureRules: []
}; 