// 小红书网络监控插件 - 弹出窗口脚本
(function() {
    'use strict';

    // DOM 元素
    const elements = {
        apiStatusIndicator: document.getElementById('apiStatusIndicator'),
        apiStatusText: document.getElementById('apiStatusText'),
        ssoContainer: document.getElementById('ssoContainer'),
        ssoStartLogin: document.getElementById('ssoStartLogin'),
        ssoCheckLogin: document.getElementById('ssoCheckLogin'),
        totalRequests: document.getElementById('totalRequests'),
        todayRequests: document.getElementById('todayRequests'),
        viewLogsBtn: document.getElementById('viewLogsBtn'),
        clearLogsBtn: document.getElementById('clearLogsBtn'),
        emptyState: document.getElementById('emptyState'),
        configWarning: document.getElementById('configWarning'),
        configPageLink: document.getElementById('configPageLink'),
        configLink: document.getElementById('configLink'),
        helpLink: document.getElementById('helpLink'),
        aboutLink: document.getElementById('aboutLink')
    };

    // 应用状态
    let appState = {
        apiConfig: {
            host: '',
            token: '',
            refreshToken: ''
        },
        ssoSession: {
            id: null,
            status: 'idle', // 'idle', 'pending', 'completed', 'failed'
            pollInterval: null
        },
        requestStats: {
            total: 0,
            today: 0
        },
        config: null
    };

    // 初始化
    document.addEventListener('DOMContentLoaded', function() {
        console.log('[XHS Monitor Popup] 初始化中...');
        loadApiConfig();
        loadMonitorConfig();
        loadRequestStats();
        setupEventListeners();
        updateUI();
    });

    // 设置事件监听器
    function setupEventListeners() {
        // SSO登录按钮
        elements.ssoStartLogin.addEventListener('click', startSsoLogin);
        elements.ssoCheckLogin.addEventListener('click', checkSsoLoginStatus);

        // 功能按钮
        elements.viewLogsBtn.addEventListener('click', openLogsPage);
        elements.clearLogsBtn.addEventListener('click', clearLogs);

        // 配置链接
        elements.configPageLink.addEventListener('click', openConfigPage);
        elements.configLink.addEventListener('click', openConfigPage);
        elements.helpLink.addEventListener('click', openHelpPage);
        elements.aboutLink.addEventListener('click', openAboutPage);

        // 监听来自background的消息
        chrome.runtime.onMessage.addListener(handleMessage);
    }

    // 加载API配置
    function loadApiConfig() {
        chrome.storage.local.get(['xhs_api_config'], function(result) {
            if (result.xhs_api_config) {
                appState.apiConfig = { ...appState.apiConfig, ...result.xhs_api_config };
            }
            updateApiStatus();
        });
    }

    // 加载监控配置
    function loadMonitorConfig() {
        chrome.storage.sync.get(['xhs_monitor_config'], function(result) {
            if (result.xhs_monitor_config) {
                appState.config = result.xhs_monitor_config;
            }
            updateConfigWarning();
        });
    }

    // 加载请求统计
    function loadRequestStats() {
        chrome.runtime.sendMessage({ action: 'getRequestStats' }, function(response) {
            if (response && response.success) {
                appState.requestStats = response.stats;
                updateRequestStats();
            }
        });
    }

    // 更新UI
    function updateUI() {
        updateApiStatus();
        updateConfigWarning();
        updateRequestStats();
        updateEmptyState();
    }

    // 更新API状态
    function updateApiStatus() {
        const hasHost = !!appState.apiConfig.host;
        const hasToken = !!appState.apiConfig.token;
        
        if (hasHost && hasToken) {
            elements.apiStatusIndicator.classList.add('connected');
            elements.apiStatusText.textContent = `API已连接: ${appState.apiConfig.host.substring(0, 20)}... (已登录)`;
            elements.ssoContainer.style.display = 'none';
        } else if (hasHost) {
            elements.apiStatusIndicator.classList.remove('connected');
            elements.apiStatusText.textContent = `API已配置: ${appState.apiConfig.host.substring(0, 20)}... (未登录)`;
            elements.ssoContainer.style.display = 'block';
        } else {
            elements.apiStatusIndicator.classList.remove('connected');
            elements.apiStatusText.textContent = '未配置API服务';
            elements.ssoContainer.style.display = 'none';
        }
    }

    // 更新配置警告
    function updateConfigWarning() {
        if (!appState.config) {
            elements.configWarning.style.display = 'block';
            return;
        }

        const hasEnabledPatterns = appState.config.urlPatterns && 
            appState.config.urlPatterns.some(p => p.enabled);
        
        if (!appState.config.enableMonitoring || !hasEnabledPatterns) {
            elements.configWarning.style.display = 'block';
        } else {
            elements.configWarning.style.display = 'none';
        }
    }

    // 更新请求统计
    function updateRequestStats() {
        elements.totalRequests.textContent = appState.requestStats.total.toLocaleString();
        elements.todayRequests.textContent = appState.requestStats.today.toLocaleString();
    }

    // 更新空状态显示
    function updateEmptyState() {
        if (appState.requestStats.total === 0) {
            elements.emptyState.style.display = 'block';
        } else {
            elements.emptyState.style.display = 'none';
        }
    }

    // 启动SSO登录
    async function startSsoLogin() {
        const apiHost = appState.apiConfig.host;
        
        if (!apiHost) {
            showToast('请先在配置页面设置API地址', 'error');
            openConfigPage();
            return;
        }

        if (!apiHost.startsWith('http')) {
            showToast('API地址格式不正确，必须以http://或https://开头', 'error');
            return;
        }

        // 更新UI状态
        elements.ssoStartLogin.disabled = true;
        elements.ssoStartLogin.innerHTML = '<div class="spinner"></div>初始化SSO...';
        
        try {
            console.log('[SSO] 开始创建SSO会话...');
            
            // 创建SSO会话
            const response = await fetch(`${apiHost}/api/auth/sso-session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    client_type: 'monitor_plugin'
                })
            });

            if (!response.ok) {
                throw new Error(`服务器返回错误状态: ${response.status}`);
            }

            const data = await response.json();
            console.log('[SSO] SSO会话创建成功:', data);

            // 保存会话信息
            appState.ssoSession.id = data.session_id;
            appState.ssoSession.status = 'pending';

            // 显示"已完成登录"按钮
            elements.ssoCheckLogin.classList.remove('hidden');
            elements.ssoCheckLogin.style.display = 'block';

            // 打开SSO登录页面
            chrome.tabs.create({ url: data.login_url });

            // 重置开始登录按钮
            elements.ssoStartLogin.disabled = false;
            elements.ssoStartLogin.innerHTML = '🔄 重新发起SSO登录';

            showToast('已打开SSO登录页面，请在新标签页完成登录后返回点击"已完成登录"按钮', 'success');

        } catch (error) {
            console.error('[SSO] 登录初始化失败:', error);
            elements.ssoStartLogin.disabled = false;
            elements.ssoStartLogin.innerHTML = '🔐 单点登录 (SSO)';
            showToast(`SSO登录失败: ${error.message}`, 'error');
            appState.ssoSession.status = 'failed';
        }
    }

    // 检查SSO登录状态
    async function checkSsoLoginStatus() {
        const apiHost = appState.apiConfig.host;
        
        if (!appState.ssoSession.id) {
            showToast('无效的SSO会话，请重新发起登录', 'error');
            elements.ssoCheckLogin.style.display = 'none';
            return;
        }

        // 更新UI状态
        elements.ssoCheckLogin.disabled = true;
        elements.ssoCheckLogin.innerHTML = '<div class="spinner"></div>正在检查登录状态...';

        try {
            console.log('[SSO] 检查登录状态...');
            
            const response = await fetch(`${apiHost}/api/auth/sso-session/${appState.ssoSession.id}`);

            if (!response.ok) {
                throw new Error(`服务器返回错误状态: ${response.status}`);
            }

            const data = await response.json();
            console.log('[SSO] 登录状态检查结果:', data);

            if (data.status === 'completed' && data.tokens) {
                // 登录成功，保存token
                const newApiConfig = {
                    host: apiHost,
                    token: data.tokens.access_token,
                    refreshToken: data.tokens.refresh_token || ''
                };

                // 保存到storage
                chrome.storage.local.set({
                    'xhs_api_config': newApiConfig
                }, function() {
                    if (chrome.runtime.lastError) {
                        showToast('保存Token失败: ' + chrome.runtime.lastError.message, 'error');
                    } else {
                        appState.apiConfig = newApiConfig;
                        
                        // 重置SSO会话状态
                        appState.ssoSession = {
                            id: null,
                            status: 'idle',
                            pollInterval: null
                        };

                        // 更新UI
                        updateApiStatus();
                        elements.ssoCheckLogin.style.display = 'none';
                        elements.ssoStartLogin.innerHTML = '🔐 单点登录 (SSO)';

                        showToast('SSO登录成功！', 'success');
                        console.log('[SSO] 登录完成，Token已保存');
                    }
                });

            } else if (data.status === 'pending') {
                // 仍在等待登录
                elements.ssoCheckLogin.disabled = false;
                elements.ssoCheckLogin.innerHTML = '⏳ 等待登录完成...';
                showToast('您尚未完成SSO登录，请在新标签页完成登录后返回', 'info');

            } else {
                // 登录失败或其他状态
                elements.ssoCheckLogin.disabled = false;
                elements.ssoCheckLogin.innerHTML = '❌ 登录失败，点击重试';
                showToast('SSO登录失败，请重试', 'error');
            }

        } catch (error) {
            console.error('[SSO] 检查登录状态失败:', error);
            elements.ssoCheckLogin.disabled = false;
            elements.ssoCheckLogin.innerHTML = '🔄 检查失败，点击重试';
            showToast(`检查登录状态失败: ${error.message}`, 'error');
        }
    }

    // 打开日志页面
    function openLogsPage() {
        chrome.tabs.create({
            url: chrome.runtime.getURL('logs.html')
        });
    }

    // 清空日志
    function clearLogs() {
        if (confirm('确定要清空所有监控日志吗？此操作不可撤销。')) {
            chrome.runtime.sendMessage({ action: 'clearLogs' }, function(response) {
                if (response && response.success) {
                    appState.requestStats = { total: 0, today: 0 };
                    updateRequestStats();
                    updateEmptyState();
                    showToast('日志已清空', 'success');
                } else {
                    showToast('清空日志失败', 'error');
                }
            });
        }
    }

    // 打开配置页面
    function openConfigPage(e) {
        if (e) e.preventDefault();
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            chrome.tabs.create({
                url: chrome.runtime.getURL('options.html')
            });
        }
    }

    // 打开帮助页面
    function openHelpPage(e) {
        if (e) e.preventDefault();
        chrome.tabs.create({
            url: chrome.runtime.getURL('help.html')
        });
    }

    // 打开关于页面
    function openAboutPage(e) {
        if (e) e.preventDefault();
        chrome.tabs.create({
            url: 'https://github.com/your-repo/xhs-monitor-plugin'
        });
    }

    // 处理来自background的消息
    function handleMessage(request, sender, sendResponse) {
        console.log('[Popup] 收到消息:', request);

        switch (request.action) {
            case 'statsUpdated':
                appState.requestStats = request.stats;
                updateRequestStats();
                updateEmptyState();
                break;
                
            case 'configUpdated':
                loadMonitorConfig();
                break;
                
            case 'apiConfigUpdated':
                loadApiConfig();
                break;
                
            case 'ping':
                sendResponse({ pong: true, source: 'popup' });
                break;
        }

        return true;
    }

    // 显示提示消息
    function showToast(message, type = 'info') {
        // 创建toast元素
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        // 添加样式
        Object.assign(toast.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 16px',
            borderRadius: '6px',
            color: 'white',
            fontSize: '14px',
            zIndex: '10000',
            maxWidth: '280px',
            wordWrap: 'break-word',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            transform: 'translateX(100%)',
            transition: 'transform 0.3s ease'
        });

        // 设置背景色
        switch (type) {
            case 'success':
                toast.style.background = '#28a745';
                break;
            case 'error':
                toast.style.background = '#dc3545';
                break;
            case 'warning':
                toast.style.background = '#ffc107';
                toast.style.color = '#212529';
                break;
            default:
                toast.style.background = '#007bff';
        }

        document.body.appendChild(toast);

        // 显示动画
        setTimeout(() => {
            toast.style.transform = 'translateX(0)';
        }, 100);

        // 自动隐藏
        setTimeout(() => {
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    console.log('[XHS Monitor Popup] 脚本加载完成');

})(); 