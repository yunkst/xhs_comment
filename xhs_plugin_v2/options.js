// 配置页面JavaScript逻辑
(function() {
    'use strict';

    // 默认配置（移除URL模式配置）
    const DEFAULT_CONFIG = {
        enableMonitoring: true,
        enableEnhanced: true,
        maxLogSize: 1000,
        logRequestBody: true,
        logResponseBody: true
    };

    // 当前配置
    let currentConfig = { ...DEFAULT_CONFIG };
    let currentApiConfig = {
        host: '',
        token: '',
        refreshToken: ''
    };
    let captureRules = []; // 抓取规则

    // DOM 元素
    const elements = {
        // API配置元素
        apiHostInput: document.getElementById('apiHostInput'),
        apiConnectionStatus: document.getElementById('apiConnectionStatus'),
        apiLoginStatus: document.getElementById('apiLoginStatus'),
        saveApiConfigBtn: document.getElementById('saveApiConfigBtn'),
        testApiConnectionBtn: document.getElementById('testApiConnectionBtn'),
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

    // 初始化
    document.addEventListener('DOMContentLoaded', function() {
        loadConfig();
        loadApiConfig();
        setupEventListeners();
    });

    // 设置事件监听器
    function setupEventListeners() {
        // API配置事件
        elements.saveApiConfigBtn.addEventListener('click', saveApiConfig);
        elements.testApiConnectionBtn.addEventListener('click', testApiConnection);
        elements.logoutBtn.addEventListener('click', logoutFromApi);

        // 刷新抓取规则
        if (elements.refreshRulesBtn) {
            elements.refreshRulesBtn.addEventListener('click', refreshCaptureRules);
        }

        // 保存配置
        elements.saveBtn.addEventListener('click', saveConfig);

        // 恢复默认
        elements.resetBtn.addEventListener('click', function() {
            if (confirm('确定要恢复默认配置吗？所有自定义设置将会丢失！')) {
                resetToDefault();
            }
        });

        // 导出配置
        elements.exportConfigBtn.addEventListener('click', exportConfig);

        // 导入配置
        elements.importConfigBtn.addEventListener('click', function() {
            elements.importFileInput.click();
        });

        elements.importFileInput.addEventListener('change', importConfig);
    }

    // 加载API配置
    function loadApiConfig() {
        chrome.storage.local.get(['xhs_api_config'], function(result) {
            if (result.xhs_api_config) {
                currentApiConfig = { ...currentApiConfig, ...result.xhs_api_config };
            }
            
            updateApiUI();
            loadCaptureRules(); // API配置加载后加载抓取规则
            showStatus('API配置加载完成', 'success');
        });
    }

    // 更新API相关UI
    function updateApiUI() {
        // 更新输入框
        elements.apiHostInput.value = currentApiConfig.host || '';
        
        // 更新连接状态
        if (currentApiConfig.host) {
            elements.apiConnectionStatus.textContent = '已配置';
            elements.apiConnectionStatus.className = 'status-value connected';
        } else {
            elements.apiConnectionStatus.textContent = '未配置';
            elements.apiConnectionStatus.className = 'status-value disconnected';
        }
        
        // 更新登录状态
        if (currentApiConfig.token) {
            elements.apiLoginStatus.textContent = '已登录';
            elements.apiLoginStatus.className = 'status-value logged-in';
            elements.logoutBtn.style.display = 'inline-flex';
        } else {
            elements.apiLoginStatus.textContent = '未登录';
            elements.apiLoginStatus.className = 'status-value logged-out';
            elements.logoutBtn.style.display = 'none';
        }
    }

    // 保存API配置
    function saveApiConfig() {
        const apiHost = elements.apiHostInput.value.trim();
        
        if (!apiHost) {
            showStatus('请输入API服务器地址', 'error');
            return;
        }

        if (!apiHost.startsWith('http://') && !apiHost.startsWith('https://')) {
            showStatus('API地址必须以http://或https://开头', 'error');
            return;
        }

        // 保存API配置（保留现有的token）
        const newApiConfig = {
            ...currentApiConfig,
            host: apiHost
        };

        chrome.storage.local.set({
            'xhs_api_config': newApiConfig
        }, function() {
            if (chrome.runtime.lastError) {
                showStatus('保存API配置失败: ' + chrome.runtime.lastError.message, 'error');
            } else {
                currentApiConfig = newApiConfig;
                updateApiUI();
                loadCaptureRules(); // 重新加载抓取规则
                showStatus('API配置保存成功！', 'success');
                
                // 通知background更新API配置
                chrome.runtime.sendMessage({
                    action: 'setApiConfig',
                    config: newApiConfig
                });
            }
        });
    }

    // 测试API连接
    async function testApiConnection() {
        const apiHost = elements.apiHostInput.value.trim();
        
        if (!apiHost) {
            showStatus('请先输入API服务器地址', 'error');
            return;
        }

        if (!apiHost.startsWith('http://') && !apiHost.startsWith('https://')) {
            showStatus('API地址格式不正确', 'error');
            return;
        }

        // 更新按钮状态
        elements.testApiConnectionBtn.disabled = true;
        elements.testApiConnectionBtn.innerHTML = '<div class="spinner"></div>测试中...';

        try {
            // 测试连接到API服务器
            const response = await fetch(`${apiHost}/api/health`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                showStatus(`连接成功！服务器状态: ${data.status || 'OK'}`, 'success');
                
                // 自动保存配置
                saveApiConfig();
            } else {
                showStatus(`连接失败: HTTP ${response.status}`, 'error');
            }

        } catch (error) {
            console.error('API连接测试失败:', error);
            showStatus(`连接失败: ${error.message}`, 'error');
        } finally {
            // 恢复按钮状态
            elements.testApiConnectionBtn.disabled = false;
            elements.testApiConnectionBtn.innerHTML = '🔗 测试连接';
        }
    }

    // 退出登录
    function logoutFromApi() {
        if (confirm('确定要退出登录吗？这将清除保存的登录凭据。')) {
            // 清除token
            const newApiConfig = {
                ...currentApiConfig,
                token: '',
                refreshToken: ''
            };

            chrome.storage.local.set({
                'xhs_api_config': newApiConfig
            }, function() {
                if (chrome.runtime.lastError) {
                    showStatus('退出登录失败: ' + chrome.runtime.lastError.message, 'error');
                } else {
                    currentApiConfig = newApiConfig;
                    updateApiUI();
                    showStatus('已退出登录', 'success');
                    
                    // 通知popup更新
                    chrome.runtime.sendMessage({
                        action: 'apiConfigUpdated',
                        config: newApiConfig
                    });
                }
            });
        }
    }

    // 加载配置
    function loadConfig() {
        chrome.storage.sync.get(['xhs_monitor_config'], function(result) {
            if (result.xhs_monitor_config) {
                currentConfig = { ...DEFAULT_CONFIG, ...result.xhs_monitor_config };
            }
            
            updateUI();
            showStatus('配置加载完成', 'success');
        });
    }

    // 更新UI
    function updateUI() {
        // 基本设置
        elements.enableMonitoring.checked = currentConfig.enableMonitoring;
        elements.enableEnhanced.checked = currentConfig.enableEnhanced;

        // 高级设置
        elements.maxLogSize.value = currentConfig.maxLogSize;
        elements.logRequestBody.checked = currentConfig.logRequestBody;
        elements.logResponseBody.checked = currentConfig.logResponseBody;
    }

    // 保存配置
    function saveConfig() {
        // 收集所有配置
        const config = {
            enableMonitoring: elements.enableMonitoring.checked,
            enableEnhanced: elements.enableEnhanced.checked,
            maxLogSize: parseInt(elements.maxLogSize.value) || 1000,
            logRequestBody: elements.logRequestBody.checked,
            logResponseBody: elements.logResponseBody.checked
        };

        // 保存到存储
        chrome.storage.sync.set({
            'xhs_monitor_config': config
        }, function() {
            if (chrome.runtime.lastError) {
                showStatus('配置保存失败: ' + chrome.runtime.lastError.message, 'error');
            } else {
                currentConfig = config;
                showStatus('配置保存成功！插件将使用新配置', 'success');
                updateConfigStatus(true, '配置已自动保存');
                
                // 通知后台脚本配置已更新
                chrome.runtime.sendMessage({
                    action: 'configUpdated',
                    config: config
                });
            }
        });
    }

    // 恢复默认配置
    function resetToDefault() {
        currentConfig = { ...DEFAULT_CONFIG };
        updateUI();
        showStatus('已恢复默认配置，请点击保存按钮应用', 'info');
    }

    // 导出配置
    function exportConfig() {
        const config = {
            monitor: currentConfig,
            api: currentApiConfig,
            exportTime: new Date().toISOString(),
            version: '1.0'
        };

        const dataStr = JSON.stringify(config, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        
        const fileName = `xhs_monitor_config_${new Date().toISOString().slice(0, 10)}.json`;
        
        chrome.downloads.download({
            url: dataUri,
            filename: fileName,
            saveAs: true
        }, function(downloadId) {
            if (chrome.runtime.lastError) {
                showStatus('配置导出失败: ' + chrome.runtime.lastError.message, 'error');
            } else {
                showStatus('配置导出成功！', 'success');
            }
        });
    }

    // 导入配置
    function importConfig(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedConfig = JSON.parse(e.target.result);
                
                // 验证配置格式
                if (!validateImportedConfig(importedConfig)) {
                    showStatus('配置文件格式不正确', 'error');
                    return;
                }

                // 合并监控配置
                if (importedConfig.monitor) {
                    currentConfig = { ...DEFAULT_CONFIG, ...importedConfig.monitor };
                    updateUI();
                }

                // 合并API配置（不包含敏感信息）
                if (importedConfig.api && importedConfig.api.host) {
                    elements.apiHostInput.value = importedConfig.api.host;
                }

                showStatus('配置导入成功！请检查设置并保存', 'success');
                
            } catch (error) {
                showStatus('配置文件解析失败: ' + error.message, 'error');
            }
        };

        reader.readAsText(file);
        event.target.value = ''; // 重置文件输入
    }

    // 验证导入的配置
    function validateImportedConfig(config) {
        if (!config || typeof config !== 'object') return false;
        if (config.monitor && config.monitor.maxLogSize && (config.monitor.maxLogSize < 100 || config.monitor.maxLogSize > 10000)) return false;
        return true;
    }

    // 显示状态消息
    function showStatus(message, type = 'info') {
        const statusEl = elements.statusMessage;
        statusEl.textContent = message;
        statusEl.className = `status-message ${type} show`;

        setTimeout(() => {
            statusEl.classList.remove('show');
        }, 3000);
    }

    // 监听来自其他脚本的消息
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'getConfig') {
            sendResponse({ config: currentConfig });
        } else if (request.action === 'getApiConfig') {
            sendResponse({ config: currentApiConfig });
        }
    });

    // 更新配置状态指示器
    function updateConfigStatus(saved = true, message = '') {
        const indicator = elements.configStatus.querySelector('.status-indicator');
        const text = elements.configStatus.querySelector('.status-text');
        
        if (saved) {
            indicator.classList.remove('unsaved');
            text.textContent = message || '配置已同步';
        } else {
            indicator.classList.add('unsaved');
            text.textContent = message || '配置未保存';
        }
    }

    // 加载抓取规则
    function loadCaptureRules() {
        if (!currentApiConfig.host) {
            updateCaptureRulesDisplay();
            return;
        }

        chrome.runtime.sendMessage({ action: 'getCaptureRules' }, function(response) {
            if (response && response.success) {
                captureRules = response.data || [];
                console.log('已加载抓取规则:', captureRules.length, '条');
            } else {
                captureRules = [];
                console.log('未加载到抓取规则');
            }
            updateCaptureRulesDisplay();
        });
    }

    // 刷新抓取规则
    async function refreshCaptureRules() {
        if (!currentApiConfig.host) {
            showStatus('请先配置API服务器地址', 'error');
            return;
        }

        if (elements.refreshRulesBtn) {
            elements.refreshRulesBtn.disabled = true;
            elements.refreshRulesBtn.textContent = '刷新中...';
        }

        try {
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ action: 'refreshCaptureRules' }, resolve);
            });

            if (response && response.success) {
                captureRules = response.data || [];
                updateCaptureRulesDisplay();
                showStatus('抓取规则已刷新', 'success');
            } else {
                showStatus('刷新抓取规则失败: ' + (response?.error || '未知错误'), 'error');
            }
        } catch (error) {
            console.error('刷新抓取规则时出错:', error);
            showStatus('刷新抓取规则时出错', 'error');
        } finally {
            if (elements.refreshRulesBtn) {
                elements.refreshRulesBtn.disabled = false;
                elements.refreshRulesBtn.textContent = '🔄 刷新规则';
            }
        }
    }

    // 更新抓取规则显示
    function updateCaptureRulesDisplay() {
        if (!elements.rulesContainer) {
            return;
        }

        if (!currentApiConfig.host) {
            elements.rulesContainer.style.display = 'none';
            return;
        }

        elements.rulesContainer.style.display = 'block';

        if (!elements.rulesInfo || !elements.rulesList) {
            return;
        }

        // 更新规则数量信息
        const enabledRules = captureRules.filter(rule => rule.enabled);
        const totalRules = captureRules.length;
        elements.rulesInfo.textContent = `当前共有 ${totalRules} 条抓取规则，其中 ${enabledRules.length} 条已启用`;

        // 清空规则列表
        elements.rulesList.innerHTML = '';

        if (totalRules === 0) {
            const noRulesDiv = document.createElement('div');
            noRulesDiv.className = 'no-rules-message';
            noRulesDiv.innerHTML = `
                <div class="icon">📋</div>
                <div class="message">暂无抓取规则</div>
                <div class="description">请在后端系统中配置抓取规则，或检查API连接状态</div>
            `;
            elements.rulesList.appendChild(noRulesDiv);
            return;
        }

        // 按优先级排序显示规则
        const sortedRules = [...captureRules].sort((a, b) => b.priority - a.priority);
        
        sortedRules.forEach(rule => {
            const ruleDiv = document.createElement('div');
            ruleDiv.className = `rule-item ${rule.enabled ? 'enabled' : 'disabled'}`;
            
            const priorityClass = rule.priority >= 10 ? 'high' : rule.priority >= 5 ? 'medium' : 'low';
            
            ruleDiv.innerHTML = `
                <div class="rule-header">
                    <div class="rule-name">${escapeHtml(rule.name)}</div>
                    <div class="rule-status ${rule.enabled ? 'enabled' : 'disabled'}">
                        ${rule.enabled ? '已启用' : '已禁用'}
                    </div>
                </div>
                <div class="rule-pattern">
                    <code>${escapeHtml(rule.pattern)}</code>
                </div>
                ${rule.description ? `<div class="rule-description">${escapeHtml(rule.description)}</div>` : ''}
                <div class="rule-meta">
                    <span class="rule-type">${rule.data_type || 'general'}</span>
                    <span class="rule-priority priority-${priorityClass}">优先级: ${rule.priority}</span>
                    ${rule.created_at ? `<span class="rule-date">创建: ${new Date(rule.created_at).toLocaleDateString()}</span>` : ''}
                </div>
            `;
            
            elements.rulesList.appendChild(ruleDiv);
        });
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

    console.log('小红书监控插件配置页面已加载');

})(); 