/**
 * DOM 元素引用
 */
export const elements = {
    // API配置元素
    apiHostInput: document.getElementById('apiHostInput'),
    apiConnectionStatus: document.getElementById('apiConnectionStatus'),
    apiLoginStatus: document.getElementById('apiLoginStatus'),
    saveApiConfigBtn: document.getElementById('saveApiConfigBtn'),
    testApiConnectionBtn: document.getElementById('testApiConnectionBtn'),
    
    // 登录表单元素
    loginForm: document.getElementById('loginForm'),
    usernameInput: document.getElementById('usernameInput'),
    passwordInput: document.getElementById('passwordInput'),
    otpInput: document.getElementById('otpInput'),
    useOtpCheckbox: document.getElementById('useOtpCheckbox'),
    otpGroup: document.getElementById('otpGroup'),
    loginBtn: document.getElementById('loginBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    
    // 抓取规则显示元素
    rulesContainer: document.getElementById('rulesContainer'),
    rulesInfo: document.getElementById('rulesInfo'),
    rulesList: document.getElementById('rulesList'),
    refreshRulesBtn: document.getElementById('refreshRulesBtn'),
    
    // 监控配置元素
    enableMonitoring: document.getElementById('enableMonitoring'),
    enableEnhanced: document.getElementById('enableEnhanced'),
    maxLogSize: document.getElementById('maxLogSize'),
    logRequestBody: document.getElementById('logRequestBody'),
    logResponseBody: document.getElementById('logResponseBody'),
    
    // 操作按钮
    saveBtn: document.getElementById('saveBtn'),
    resetBtn: document.getElementById('resetBtn'),
    exportConfigBtn: document.getElementById('exportConfigBtn'),
    importConfigBtn: document.getElementById('importConfigBtn'),
    importFileInput: document.getElementById('importFileInput'),
    statusMessage: document.getElementById('statusMessage'),
    configStatus: document.getElementById('configStatus')
};

/**
 * 设置页面的应用状态
 */
export let appState = {
    config: {
        enableMonitoring: true,
        enableEnhanced: true,
        maxLogSize: 1000,
        logRequestBody: true,
        logResponseBody: true
    },
    apiConfig: {
        host: '',
        token: '',
        refreshToken: ''
    },
    captureRules: []
}; 