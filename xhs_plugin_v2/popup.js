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
            
            // 清除所有SSO会话状态
            clearSsoSession();
        } else if (hasHost) {
            elements.apiStatusIndicator.classList.remove('connected');
            elements.apiStatusText.textContent = `API已配置: ${appState.apiConfig.host.substring(0, 20)}... (未登录)`;
            elements.ssoContainer.style.display = 'block';
            // 隐藏退出登录按钮
            elements.logoutContainer.classList.remove('show');
            
            // 如果有正在进行的SSO会话，显示检查按钮
            if (appState.ssoSession.id && appState.ssoSession.status === 'pending') {
                elements.ssoCheckLogin.style.display = 'block';
                elements.ssoCheckLogin.classList.remove('hidden');
                elements.ssoStartLogin.innerHTML = '🔄 重新发起SSO登录';
            } else {
                elements.ssoCheckLogin.style.display = 'none';
                elements.ssoStartLogin.innerHTML = '🔐 单点登录 (SSO)';
            }
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

        if (!appState.config.enableMonitoring) {
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

        stopSsoPolling();
        elements.ssoStartLogin.disabled = true;
        elements.ssoStartLogin.innerHTML = '<div class="spinner"></div>初始化SSO...';
        
        try {
            console.log('[SSO重构 Plugin] 开始创建SSO会话...');
            const response = await fetch(`${apiHost}/api/v1/user/auth/sso-session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    client_type: 'monitor_plugin' // 与后端 SSOSessionRequest 模型一致
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[SSO重构 Plugin] 创建SSO会话失败:', response.status, errorText);
                throw new Error(`创建SSO会话失败: ${response.status} ${errorText}`);
            }

            const data = await response.json();
            console.log('[SSO重构 Plugin] SSO会话创建成功:', data);

            if (!data.session_id || !data.initiate_url) {
                console.error('[SSO重构 Plugin] 服务器返回数据不完整:', data);
                throw new Error('服务器返回的会话数据无效 (缺少session_id或initiate_url)');
            }

            appState.ssoSession.id = data.session_id;
            appState.ssoSession.status = 'pending';
            appState.ssoSession.pollCount = 0;
            saveSsoSession(); // 保存会话ID和状态

            elements.ssoCheckLogin.classList.remove('hidden');
            elements.ssoCheckLogin.style.display = 'block';
            elements.ssoCheckLogin.innerHTML = '⏳ 等待授权完成...';
            elements.ssoCheckLogin.disabled = true; // 初始时禁用，直到轮询或手动触发

            console.log('[SSO重构 Plugin] 准备打开Admin UI SSO初始化页面:', data.initiate_url);
            chrome.tabs.create({ url: data.initiate_url });

            elements.ssoStartLogin.disabled = false;
            elements.ssoStartLogin.innerHTML = '🔄 重新发起SSO登录';

            startSsoPolling();
            showToast('已打开授权页面，请在打开的页面中完成操作。', 'success');

        } catch (error) {
            console.error('[SSO重构 Plugin] SSO登录初始化失败:', error);
            elements.ssoStartLogin.disabled = false;
            elements.ssoStartLogin.innerHTML = '🔐 单点登录 (SSO)';
            showToast(`SSO初始化失败: ${error.message}`, 'error');
            appState.ssoSession.status = 'failed';
            saveSsoSession();
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

    // 检查SSO登录状态 (轮询后端 /sso-session/{session_id})
    async function checkSsoLoginStatus(isAutoCheck = false) {
        const apiHost = appState.apiConfig.host;
        
        if (!appState.ssoSession.id || appState.ssoSession.status !== 'pending') {
            if (!isAutoCheck && appState.ssoSession.id) { // 仅在手动点击且有session_id时提示
                showToast('当前没有待处理的SSO会话，或会话已完成/失败。', 'info');
            }
            // 如果没有待处理的会话，则不执行检查，并确保UI正确
            if (appState.ssoSession.status !== 'completed') {
                 elements.ssoCheckLogin.style.display = 'none';
            }
            stopSsoPolling(); // 确保停止无效轮询
            return;
        }

        if (isAutoCheck) {
            appState.ssoSession.pollCount++;
            if (appState.ssoSession.pollCount > appState.ssoSession.maxPollCount) {
                console.log('[SSO重构 Plugin] 轮询次数超限，停止自动检查');
                stopSsoPolling();
                elements.ssoCheckLogin.innerHTML = '⏰ 检查超时，点击手动重试';
                elements.ssoCheckLogin.disabled = false;
                showToast('SSO授权检查超时，请确认已在Admin UI页面完成操作，然后手动重试', 'warning');
                appState.ssoSession.status = 'failed'; // 标记为失败
                saveSsoSession();
                return;
            }
        }

        if (!isAutoCheck) {
            elements.ssoCheckLogin.disabled = true;
            elements.ssoCheckLogin.innerHTML = '<div class="spinner"></div>正在检查授权状态...';
        } else {
            elements.ssoCheckLogin.innerHTML = `⏳ 自动检查授权中... (${appState.ssoSession.pollCount}/${appState.ssoSession.maxPollCount})`;
        }

        try {
            console.log(`[SSO重构 Plugin] 检查授权状态 (第${appState.ssoSession.pollCount}次), 会话ID: ${appState.ssoSession.id}`);
            const response = await fetch(`${apiHost}/api/v1/user/auth/sso-session/${appState.ssoSession.id}`);

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('SSO会话已过期或不存在，请重新发起登录');
                }
                const errorText = await response.text();
                console.error('[SSO重构 Plugin] 检查状态失败:', response.status, errorText);
                throw new Error(`服务器错误: ${response.status} ${errorText}`);
            }

            const data = await response.json();
            console.log('[SSO重构 Plugin] 授权状态检查结果:', data);

            if (data.status === 'completed' && data.tokens && data.tokens.access_token) {
                stopSsoPolling();
                console.log('[SSO重构 Plugin] 授权成功，收到tokens:', data.tokens);

                const newApiConfig = {
                    host: apiHost,
                    token: data.tokens.access_token,
                    refreshToken: data.tokens.refresh_token || ''
                };

                chrome.storage.local.set({ 'xhs_api_config': newApiConfig }, function() {
                    if (chrome.runtime.lastError) {
                        console.error('[SSO重构 Plugin] 保存Token失败:', chrome.runtime.lastError);
                        showToast('保存Token失败: ' + chrome.runtime.lastError.message, 'error');
                        appState.ssoSession.status = 'failed'; // 标记为失败
                    } else {
                        appState.apiConfig = newApiConfig;
                        appState.ssoSession.status = 'completed'; // 标记为完成
                        showToast('🎉 插件授权成功！', 'success');
                        console.log('[SSO重构 Plugin] Token已保存，授权完成。');
                        updateApiStatus(); // 更新整体UI状态，会隐藏SSO按钮等
                         // ssoCheckLogin 按钮应由 updateApiStatus 处理隐藏
                    }
                    saveSsoSession(); // 保存更新后的会话状态 (completed 或 failed)
                });
            } else if (data.status === 'pending') {
                if (!isAutoCheck) {
                    elements.ssoCheckLogin.disabled = false;
                    elements.ssoCheckLogin.innerHTML = '⏳ 等待授权完成...';
                    showToast('授权仍在进行中，请在Admin UI页面完成操作。', 'info');
                }
            } else {
                // 其他状态 (如 failed, unknown, 或者 completed 但缺少 token)
                stopSsoPolling();
                elements.ssoCheckLogin.disabled = false;
                elements.ssoCheckLogin.innerHTML = '❌ 授权失败，点击重试';
                let errorMsg = '授权失败或返回状态异常。';
                if(data.status === 'completed' && (!data.tokens || !data.tokens.access_token)) {
                    errorMsg = '授权已完成，但未能获取有效令牌。';
                }
                console.error('[SSO重构 Plugin] 授权状态异常或数据不完整:', data);
                if (!isAutoCheck) {
                    showToast(errorMsg, 'error');
                }
                appState.ssoSession.status = 'failed';
                saveSsoSession();
            }
        } catch (error) {
            console.error('[SSO重构 Plugin] 检查授权状态时出错:', error);
            stopSsoPolling(); // 发生错误时也应停止轮询以防无限循环
            elements.ssoCheckLogin.disabled = false;
            elements.ssoCheckLogin.innerHTML = '🔄 检查失败，点击重试';
            if (!isAutoCheck) {
                showToast(`检查授权状态出错: ${error.message}`, 'error');
            }
            appState.ssoSession.status = 'failed'; // 标记为失败
            saveSsoSession();
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
            
            // 清除SSO会话状态
            clearSsoSession();
            
            // 清除API配置中的token
            const clearedApiConfig = {
                host: appState.apiConfig.host, // 保留host配置
                token: '',
                refreshToken: ''
            };
            
            // 保存到storage
            chrome.storage.local.set({
                'xhs_api_config': clearedApiConfig
            }, function() {
                if (chrome.runtime.lastError) {
                    showToast('退出登录失败: ' + chrome.runtime.lastError.message, 'error');
                } else {
                    appState.apiConfig = clearedApiConfig;
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

    // 清除SSO会话状态
    function clearSsoSession() {
        // 停止任何正在进行的轮询
        stopSsoPolling();
        
        // 重置会话状态
        appState.ssoSession = {
            id: null,
            status: 'idle',
            pollInterval: null,
            pollCount: 0,
            maxPollCount: 60
        };
        
        // 保存到存储
        saveSsoSession();
        
        // 更新UI
        elements.ssoCheckLogin.style.display = 'none';
        elements.ssoStartLogin.innerHTML = '🔐 单点登录 (SSO)';
        
        console.log('[SSO] 已清除SSO会话状态');
    }

    console.log('[XHS Monitor Popup] 脚本加载完成');

})(); 