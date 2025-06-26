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
        maxPollCount: 60,
        apiVersion: 'v1' // 记录使用的API版本: 'v1' 或 'legacy'
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
    captureRules: [],
    lastApiError: null // 记录最近的API错误，用于检测token过期
}; 

/**
 * 获取API配置
 * @returns {Object} API配置对象
 */
export function getApiConfig() {
    return {
        baseUrl: appState.apiConfig.host,
        token: appState.apiConfig.token,
        refreshToken: appState.apiConfig.refreshToken
    };
} 