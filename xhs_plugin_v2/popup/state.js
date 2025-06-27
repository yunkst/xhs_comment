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
    configWarning: document.getElementById('configWarning'),
    captureRulesInfo: document.getElementById('captureRulesInfo'),
    rulesList: document.getElementById('rulesList'),
    refreshRulesBtn: document.getElementById('refreshRulesBtn'),
    configPageBtn: document.getElementById('configPageBtn')
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
    config: null,
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