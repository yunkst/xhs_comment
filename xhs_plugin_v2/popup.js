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
            pollInterval: null,
            pollCount: 0,
            maxPollCount: 60 // 最大轮询次数 (60次 * 3秒 = 3分钟)
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

    // 初始化
    document.addEventListener('DOMContentLoaded', function() {
        console.log('[XHS Monitor Popup] 初始化中...');
        loadApiConfig();
        loadSsoSession(); // 加载SSO会话状态
        loadMonitorConfig();
        loadRequestStats();
        loadCaptureRules(); // 加载抓取规则
        setupEventListeners();
        updateUI();
    });

    // 设置事件监听器
    function setupEventListeners() {
        // SSO登录按钮
        elements.ssoStartLogin.addEventListener('click', startSsoLogin);
        elements.ssoCheckLogin.addEventListener('click', checkSsoLoginStatus);
        
        // 退出登录按钮
        elements.logoutBtn.addEventListener('click', logout);

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

        // 页面卸载时清理定时器
        window.addEventListener('beforeunload', function() {
            stopSsoPolling();
        });

        // 刷新抓取规则按钮
        if (elements.refreshRulesBtn) {
            elements.refreshRulesBtn.addEventListener('click', refreshCaptureRules);
        }

        // 过滤器选择
        if (elements.filterSelect) {
            elements.filterSelect.addEventListener('change', function() {
                appState.currentFilter = this.value;
                filterAndDisplayLog();
            });
        }

        // 链接
        if (elements.optionsLink) {
            elements.optionsLink.addEventListener('click', function(e) {
                e.preventDefault();
                chrome.runtime.openOptionsPage();
            });
        }
        
        if (elements.logsLink) {
            elements.logsLink.addEventListener('click', function(e) {
                e.preventDefault();
                chrome.tabs.create({ url: chrome.runtime.getURL('logs.html') });
            });
        }
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

    // 加载SSO会话状态
    function loadSsoSession() {
        chrome.storage.local.get(['xhs_sso_session'], function(result) {
            if (result.xhs_sso_session) {
                appState.ssoSession = { ...appState.ssoSession, ...result.xhs_sso_session };
                console.log('[SSO] 已加载保存的SSO会话状态:', appState.ssoSession);
                
                // 如果有pending状态的会话，自动开始轮询检查
                if (appState.ssoSession.status === 'pending' && appState.ssoSession.id) {
                    elements.ssoCheckLogin.classList.remove('hidden');
                    elements.ssoCheckLogin.style.display = 'block';
                    elements.ssoStartLogin.innerHTML = '🔄 重新发起SSO登录';
                    
                    // 开始自动轮询检查
                    startSsoPolling();
                }
            }
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

    // 加载抓取规则
    function loadCaptureRules() {
        chrome.runtime.sendMessage({ action: 'getCaptureRules' }, function(response) {
            if (response && response.success) {
                appState.captureRules = response.data || [];
                console.log('已加载抓取规则:', appState.captureRules.length, '条');
                updateCaptureRulesDisplay();
            } else {
                appState.captureRules = [];
                console.log('未加载到抓取规则');
                updateCaptureRulesDisplay();
            }
        });
    }

    // 更新UI
    function updateUI() {
        updateApiStatus();
        updateConfigWarning();
        updateRequestStats();
        updateEmptyState();
        updateSsoButtons();
        updateCaptureRulesDisplay();
    }

    // 更新API状态
    function updateApiStatus() {
        const hasHost = !!appState.apiConfig.host;
        const hasToken = !!appState.apiConfig.token;
        
        if (hasHost && hasToken) {
            elements.apiStatusIndicator.classList.add('connected');
            elements.apiStatusText.textContent = `API已连接: ${appState.apiConfig.host.substring(0, 20)}... (已登录)`;
            elements.ssoContainer.style.display = 'none';
            // 显示退出登录按钮
            elements.logoutContainer.classList.add('show');
        } else if (hasHost) {
            elements.apiStatusIndicator.classList.remove('connected');
            elements.apiStatusText.textContent = `API已配置: ${appState.apiConfig.host.substring(0, 20)}... (未登录)`;
            elements.ssoContainer.style.display = 'block';
            // 隐藏退出登录按钮
            elements.logoutContainer.classList.remove('show');
        } else {
            elements.apiStatusIndicator.classList.remove('connected');
            elements.apiStatusText.textContent = '未配置API服务';
            elements.ssoContainer.style.display = 'none';
            // 隐藏退出登录按钮
            elements.logoutContainer.classList.remove('show');
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

        // 停止之前的轮询
        stopSsoPolling();

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
            appState.ssoSession.pollCount = 0;
            saveSsoSession(); // 保存到存储

            // 显示状态按钮
            elements.ssoCheckLogin.classList.remove('hidden');
            elements.ssoCheckLogin.style.display = 'block';
            elements.ssoCheckLogin.innerHTML = '⏳ 等待登录完成...';
            elements.ssoCheckLogin.disabled = true;

            // 打开SSO登录页面
            chrome.tabs.create({ url: data.login_url });

            // 重置开始登录按钮
            elements.ssoStartLogin.disabled = false;
            elements.ssoStartLogin.innerHTML = '🔄 重新发起SSO登录';

            // 开始自动轮询检查登录状态
            startSsoPolling();

            showToast('已打开SSO登录页面，正在自动检查登录状态...', 'success');

        } catch (error) {
            console.error('[SSO] 登录初始化失败:', error);
            elements.ssoStartLogin.disabled = false;
            elements.ssoStartLogin.innerHTML = '🔐 单点登录 (SSO)';
            showToast(`SSO登录失败: ${error.message}`, 'error');
            appState.ssoSession.status = 'failed';
        }
    }

    // 开始SSO轮询检查
    function startSsoPolling() {
        console.log('[SSO] 开始自动轮询检查登录状态...');
        
        // 清除之前的定时器
        stopSsoPolling();
        
        // 立即检查一次
        checkSsoLoginStatus(true);
        
        // 设置定时器，每3秒检查一次
        appState.ssoSession.pollInterval = setInterval(() => {
            checkSsoLoginStatus(true);
        }, 3000);
    }

    // 停止SSO轮询检查
    function stopSsoPolling() {
        if (appState.ssoSession.pollInterval) {
            console.log('[SSO] 停止自动轮询检查');
            clearInterval(appState.ssoSession.pollInterval);
            appState.ssoSession.pollInterval = null;
        }
    }

    // 检查SSO登录状态
    async function checkSsoLoginStatus(isAutoCheck = false) {
        const apiHost = appState.apiConfig.host;
        
        if (!appState.ssoSession.id) {
            if (!isAutoCheck) {
                showToast('无效的SSO会话，请重新发起登录', 'error');
            }
            elements.ssoCheckLogin.style.display = 'none';
            // 清除可能存在的无效会话状态
            appState.ssoSession = { id: null, status: 'idle', pollInterval: null, pollCount: 0, maxPollCount: 60 };
            saveSsoSession();
            stopSsoPolling();
            return;
        }

        // 检查轮询次数限制
        if (isAutoCheck) {
            appState.ssoSession.pollCount++;
            if (appState.ssoSession.pollCount > appState.ssoSession.maxPollCount) {
                console.log('[SSO] 轮询次数超限，停止自动检查');
                stopSsoPolling();
                elements.ssoCheckLogin.innerHTML = '⏰ 检查超时，点击手动重试';
                elements.ssoCheckLogin.disabled = false;
                showToast('SSO登录检查超时，请手动点击重试或重新发起登录', 'warning');
                return;
            }
        }

        // 更新UI状态（仅在手动检查时）
        if (!isAutoCheck) {
            elements.ssoCheckLogin.disabled = true;
            elements.ssoCheckLogin.innerHTML = '<div class="spinner"></div>正在检查登录状态...';
        } else {
            // 自动检查时显示轮询进度
            const progress = Math.round((appState.ssoSession.pollCount / appState.ssoSession.maxPollCount) * 100);
            elements.ssoCheckLogin.innerHTML = `⏳ 自动检查中... (${appState.ssoSession.pollCount}/${appState.ssoSession.maxPollCount})`;
        }

        try {
            console.log(`[SSO] 检查登录状态... (第${appState.ssoSession.pollCount}次)`);
            
            const response = await fetch(`${apiHost}/api/auth/sso-session/${appState.ssoSession.id}`);

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('SSO会话已过期或不存在，请重新发起登录');
                }
                throw new Error(`服务器返回错误状态: ${response.status}`);
            }

            const data = await response.json();
            console.log('[SSO] 登录状态检查结果:', data);

            if (data.status === 'completed' && data.tokens) {
                // 登录成功，停止轮询
                stopSsoPolling();
                
                // 保存token
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
                        
                        // 重置并清除SSO会话状态
                        appState.ssoSession = {
                            id: null,
                            status: 'idle',
                            pollInterval: null,
                            pollCount: 0,
                            maxPollCount: 60
                        };
                        saveSsoSession(); // 清除存储中的会话状态

                        // 更新UI
                        updateApiStatus();
                        elements.ssoCheckLogin.style.display = 'none';
                        elements.ssoStartLogin.innerHTML = '🔐 单点登录 (SSO)';

                        showToast('🎉 SSO登录成功！Token已自动保存', 'success');
                        console.log('[SSO] 登录完成，Token已保存');
                    }
                });

            } else if (data.status === 'pending') {
                // 仍在等待登录
                if (!isAutoCheck) {
                    elements.ssoCheckLogin.disabled = false;
                    elements.ssoCheckLogin.innerHTML = '⏳ 等待登录完成...';
                    showToast('您尚未完成SSO登录，请在新标签页完成登录', 'info');
                }
                // 自动检查时继续轮询，不显示提示

            } else {
                // 登录失败或其他状态
                stopSsoPolling();
                elements.ssoCheckLogin.disabled = false;
                elements.ssoCheckLogin.innerHTML = '❌ 登录失败，点击重试';
                if (!isAutoCheck) {
                    showToast('SSO登录失败，请重试', 'error');
                }
            }

        } catch (error) {
            console.error('[SSO] 检查登录状态失败:', error);
            
            // 如果是会话过期错误，停止轮询并清除状态
            if (error.message.includes('过期') || error.message.includes('不存在')) {
                stopSsoPolling();
                elements.ssoCheckLogin.style.display = 'none';
                elements.ssoStartLogin.innerHTML = '🔐 单点登录 (SSO)';
                appState.ssoSession = { id: null, status: 'idle', pollInterval: null, pollCount: 0, maxPollCount: 60 };
                saveSsoSession();
                
                if (!isAutoCheck) {
                    showToast(`检查登录状态失败: ${error.message}`, 'error');
                }
            } else {
                // 其他错误，允许重试
                elements.ssoCheckLogin.disabled = false;
                elements.ssoCheckLogin.innerHTML = '🔄 检查失败，点击重试';
                
                if (!isAutoCheck) {
                    showToast(`检查登录状态失败: ${error.message}`, 'error');
                }
            }
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

    // 退出登录
    function logout() {
        if (confirm('确定要退出登录吗？您需要重新进行SSO登录才能使用API功能。')) {
            // 停止SSO轮询
            stopSsoPolling();
            
            // 清除API配置中的token
            const clearedApiConfig = {
                host: appState.apiConfig.host, // 保留host配置
                token: '',
                refreshToken: ''
            };
            
            // 保存清除后的配置
            chrome.storage.local.set({
                'xhs_api_config': clearedApiConfig
            }, function() {
                if (chrome.runtime.lastError) {
                    showToast('退出登录失败: ' + chrome.runtime.lastError.message, 'error');
                } else {
                    // 更新本地状态
                    appState.apiConfig = clearedApiConfig;
                    
                    // 清除SSO会话状态
                    appState.ssoSession = {
                        id: null,
                        status: 'idle',
                        pollInterval: null,
                        pollCount: 0,
                        maxPollCount: 60
                    };
                    saveSsoSession();
                    
                    // 重置SSO按钮状态
                    elements.ssoStartLogin.innerHTML = '🔐 单点登录 (SSO)';
                    elements.ssoStartLogin.disabled = false;
                    elements.ssoCheckLogin.style.display = 'none';
                    elements.ssoCheckLogin.classList.add('hidden');
                    
                    // 更新UI
                    updateApiStatus();
                    
                    showToast('✅ 已成功退出登录', 'success');
                    console.log('[Auth] 用户已退出登录');
                    
                    // 通知background清除相关缓存
                    chrome.runtime.sendMessage({ 
                        action: 'userLoggedOut' 
                    });
                }
            });
        }
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

    // 保存SSO会话状态
    function saveSsoSession() {
        chrome.storage.local.set({
            'xhs_sso_session': appState.ssoSession
        });
    }

    // 更新抓取规则显示
    function updateCaptureRulesDisplay() {
        if (!elements.captureRulesInfo || !elements.rulesList) {
            return;
        }

        // 更新规则数量
        const enabledRules = appState.captureRules.filter(rule => rule.enabled);
        elements.captureRulesInfo.textContent = `当前启用 ${enabledRules.length} 条抓取规则`;

        // 清空规则列表
        elements.rulesList.innerHTML = '';

        if (enabledRules.length === 0) {
            const noRulesItem = document.createElement('div');
            noRulesItem.className = 'rule-item';
            noRulesItem.innerHTML = `
                <div class="rule-content">
                    <div class="rule-name">暂无抓取规则</div>
                    <div class="rule-description">请在后端配置抓取规则或检查API连接</div>
                </div>
            `;
            elements.rulesList.appendChild(noRulesItem);
            return;
        }

        // 按优先级排序显示规则
        const sortedRules = enabledRules.sort((a, b) => b.priority - a.priority);
        
        sortedRules.forEach(rule => {
            const ruleItem = document.createElement('div');
            ruleItem.className = 'rule-item';
            ruleItem.innerHTML = `
                <div class="rule-content">
                    <div class="rule-name">${escapeHtml(rule.name)}</div>
                    <div class="rule-pattern">${escapeHtml(rule.pattern)}</div>
                    ${rule.description ? `<div class="rule-description">${escapeHtml(rule.description)}</div>` : ''}
                </div>
                <div class="rule-priority">优先级: ${rule.priority}</div>
            `;
            elements.rulesList.appendChild(ruleItem);
        });
    }

    // 刷新抓取规则
    async function refreshCaptureRules() {
        if (elements.refreshRulesBtn) {
            elements.refreshRulesBtn.disabled = true;
            elements.refreshRulesBtn.textContent = '刷新中...';
        }

        try {
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ action: 'refreshCaptureRules' }, resolve);
            });

            if (response && response.success) {
                appState.captureRules = response.data || [];
                updateCaptureRulesDisplay();
                showToast('抓取规则已刷新', 'success');
            } else {
                showToast('刷新抓取规则失败: ' + (response?.error || '未知错误'), 'error');
            }
        } catch (error) {
            console.error('刷新抓取规则时出错:', error);
            showToast('刷新抓取规则时出错', 'error');
        } finally {
            if (elements.refreshRulesBtn) {
                elements.refreshRulesBtn.disabled = false;
                elements.refreshRulesBtn.textContent = '刷新规则';
            }
        }
    }

    // HTML转义函数
    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
    }

    console.log('[XHS Monitor Popup] 脚本加载完成');

})(); 