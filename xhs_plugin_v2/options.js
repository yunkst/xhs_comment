// 配置页面JavaScript逻辑
(function() {
    'use strict';

    // 默认配置
    const DEFAULT_CONFIG = {
        enableMonitoring: true,
        enableEnhanced: true,
        urlPatterns: [
            { pattern: '*.xiaohongshu.com/*', enabled: true },
            { pattern: '*.xhscdn.com/*', enabled: true },
            { pattern: '*.fegine.com/*', enabled: true }
        ],
        monitorTypes: {
            xhr: true,
            fetch: true,
            images: true,
            scripts: true,
            styles: true,
            documents: true
        },
        maxLogSize: 1000,
        logRequestBody: true,
        logResponseBody: true
    };

    // 当前配置
    let currentConfig = { ...DEFAULT_CONFIG };

    // DOM 元素
    const elements = {
        enableMonitoring: document.getElementById('enableMonitoring'),
        enableEnhanced: document.getElementById('enableEnhanced'),
        newPatternInput: document.getElementById('newPatternInput'),
        addPatternBtn: document.getElementById('addPatternBtn'),
        patternsList: document.getElementById('patternsList'),
        monitorXHR: document.getElementById('monitorXHR'),
        monitorFetch: document.getElementById('monitorFetch'),
        monitorImages: document.getElementById('monitorImages'),
        monitorScripts: document.getElementById('monitorScripts'),
        monitorStyles: document.getElementById('monitorStyles'),
        monitorDocuments: document.getElementById('monitorDocuments'),
        maxLogSize: document.getElementById('maxLogSize'),
        logRequestBody: document.getElementById('logRequestBody'),
        logResponseBody: document.getElementById('logResponseBody'),
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
        setupEventListeners();
    });

    // 设置事件监听器
    function setupEventListeners() {
        // 添加URL模式
        elements.addPatternBtn.addEventListener('click', addUrlPattern);
        elements.newPatternInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                addUrlPattern();
            }
        });

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

        // 实时验证URL模式
        elements.newPatternInput.addEventListener('input', validatePatternInput);
    }

    // 加载配置
    function loadConfig() {
        chrome.storage.sync.get(['xhs_monitor_config'], function(result) {
            if (result.xhs_monitor_config) {
                currentConfig = { ...DEFAULT_CONFIG, ...result.xhs_monitor_config };
            } else {
                currentConfig = { ...DEFAULT_CONFIG };
            }
            
            updateUI();
            showStatus('配置加载完成', 'success');
        });
    }

    // 更新UI
    function updateUI() {
        // 全局设置
        elements.enableMonitoring.checked = currentConfig.enableMonitoring;
        elements.enableEnhanced.checked = currentConfig.enableEnhanced;

        // 监控类型
        elements.monitorXHR.checked = currentConfig.monitorTypes.xhr;
        elements.monitorFetch.checked = currentConfig.monitorTypes.fetch;
        elements.monitorImages.checked = currentConfig.monitorTypes.images;
        elements.monitorScripts.checked = currentConfig.monitorTypes.scripts;
        elements.monitorStyles.checked = currentConfig.monitorTypes.styles;
        elements.monitorDocuments.checked = currentConfig.monitorTypes.documents;

        // 高级设置
        elements.maxLogSize.value = currentConfig.maxLogSize;
        elements.logRequestBody.checked = currentConfig.logRequestBody;
        elements.logResponseBody.checked = currentConfig.logResponseBody;

        // URL模式列表
        renderPatternsList();
    }

    // 渲染URL模式列表
    function renderPatternsList() {
        if (currentConfig.urlPatterns.length === 0) {
            elements.patternsList.innerHTML = '<div class="empty-patterns">暂无自定义URL监控规则。插件会自动监控所有小红书页面的请求。</div>';
            return;
        }

        const html = currentConfig.urlPatterns.map((item, index) => `
            <div class="pattern-item ${!item.enabled ? 'disabled' : ''}">
                <div class="pattern-text">${escapeHtml(item.pattern)}</div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <label style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
                        <input type="checkbox" class="pattern-enabled" ${item.enabled ? 'checked' : ''} 
                               data-index="${index}">
                        <span style="font-size: 12px; color: #666;">${item.enabled ? '启用' : '禁用'}</span>
                    </label>
                    <button class="remove-pattern" data-index="${index}" title="删除此模式">删除</button>
                </div>
            </div>
        `).join('');

        elements.patternsList.innerHTML = html;
        
        // 绑定事件监听器
        bindPatternListEvents();
    }

    // 绑定模式列表事件
    function bindPatternListEvents() {
        // 绑定复选框事件
        const checkboxes = elements.patternsList.querySelectorAll('.pattern-enabled');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                const index = parseInt(this.dataset.index);
                togglePatternEnabled(index);
            });
        });
        
        // 绑定删除按钮事件
        const deleteButtons = elements.patternsList.querySelectorAll('.remove-pattern');
        deleteButtons.forEach(button => {
            button.addEventListener('click', function() {
                const index = parseInt(this.dataset.index);
                removePattern(index);
            });
        });
    }

    // 添加URL模式
    function addUrlPattern() {
        const pattern = elements.newPatternInput.value.trim();
        
        if (!pattern) {
            showStatus('请输入URL模式', 'error');
            return;
        }

        if (!isValidUrlPattern(pattern)) {
            showStatus('URL模式格式不正确', 'error');
            return;
        }

        // 检查是否已存在
        if (currentConfig.urlPatterns.some(item => item.pattern === pattern)) {
            showStatus('该URL模式已存在', 'error');
            return;
        }

        currentConfig.urlPatterns.push({
            pattern: pattern,
            enabled: true
        });

        elements.newPatternInput.value = '';
        renderPatternsList();
        
        // 立即保存配置，避免添加后刷新页面丢失更改
        chrome.storage.sync.set({
            'xhs_monitor_config': currentConfig
        }, function() {
            if (chrome.runtime.lastError) {
                showStatus('添加失败: ' + chrome.runtime.lastError.message, 'error');
            } else {
                showStatus(`URL模式 "${pattern}" 添加成功并保存`, 'success');
                updateConfigStatus(true, '配置已自动保存');
                
                // 通知后台脚本配置已更新
                chrome.runtime.sendMessage({
                    action: 'configUpdated',
                    config: currentConfig
                });
            }
        });
    }

    // 验证URL模式格式
    function isValidUrlPattern(pattern) {
        // 基本验证：包含域名相关内容
        return pattern.includes('.') || pattern.includes('*') || pattern.includes('://');
    }

    // 验证输入框中的URL模式
    function validatePatternInput() {
        const pattern = elements.newPatternInput.value.trim();
        const input = elements.newPatternInput;
        
        if (pattern && !isValidUrlPattern(pattern)) {
            input.style.borderColor = '#dc3545';
        } else {
            input.style.borderColor = '';
        }
    }

    // 切换模式启用状态
    function togglePatternEnabled(index) {
        if (currentConfig.urlPatterns[index]) {
            currentConfig.urlPatterns[index].enabled = !currentConfig.urlPatterns[index].enabled;
            
            // 重新渲染列表以更新视觉效果
            renderPatternsList();
            
            const pattern = currentConfig.urlPatterns[index].pattern;
            const status = currentConfig.urlPatterns[index].enabled ? '启用' : '禁用';
            
            // 立即保存配置，避免状态切换后刷新页面丢失更改
            chrome.storage.sync.set({
                'xhs_monitor_config': currentConfig
            }, function() {
                if (chrome.runtime.lastError) {
                    showStatus('状态更新失败: ' + chrome.runtime.lastError.message, 'error');
                } else {
                    showStatus(`模式 "${pattern}" 已${status}并保存`, 'info');
                    updateConfigStatus(true, '配置已自动保存');
                    
                    // 通知后台脚本配置已更新
                    chrome.runtime.sendMessage({
                        action: 'configUpdated',
                        config: currentConfig
                    });
                }
            });
        }
    }

    // 删除模式
    function removePattern(index) {
        if (confirm('确定要删除这个URL模式吗？')) {
            const deletedPattern = currentConfig.urlPatterns[index].pattern;
            currentConfig.urlPatterns.splice(index, 1);
            renderPatternsList();
            
            // 立即保存配置，避免删除后刷新页面丢失更改
            chrome.storage.sync.set({
                'xhs_monitor_config': currentConfig
            }, function() {
                if (chrome.runtime.lastError) {
                    showStatus('删除失败: ' + chrome.runtime.lastError.message, 'error');
                } else {
                    showStatus(`URL模式 "${deletedPattern}" 已删除并保存`, 'success');
                    updateConfigStatus(true, '配置已自动保存');
                    
                    // 通知后台脚本配置已更新
                    chrome.runtime.sendMessage({
                        action: 'configUpdated',
                        config: currentConfig
                    });
                }
            });
        }
    }

    // 保存配置
    function saveConfig() {
        // 收集URL模式的最新状态
        const patternCheckboxes = document.querySelectorAll('.pattern-enabled');
        patternCheckboxes.forEach((checkbox, index) => {
            if (currentConfig.urlPatterns[index]) {
                currentConfig.urlPatterns[index].enabled = checkbox.checked;
            }
        });
        
        // 收集所有配置
        const config = {
            enableMonitoring: elements.enableMonitoring.checked,
            enableEnhanced: elements.enableEnhanced.checked,
            urlPatterns: currentConfig.urlPatterns,
            monitorTypes: {
                xhr: elements.monitorXHR.checked,
                fetch: elements.monitorFetch.checked,
                images: elements.monitorImages.checked,
                scripts: elements.monitorScripts.checked,
                styles: elements.monitorStyles.checked,
                documents: elements.monitorDocuments.checked
            },
            maxLogSize: parseInt(elements.maxLogSize.value) || 1000,
            logRequestBody: elements.logRequestBody.checked,
            logResponseBody: elements.logResponseBody.checked
        };

        // 验证配置
        if (config.urlPatterns.length === 0) {
            // 如果没有URL模式，添加默认的小红书模式
            config.urlPatterns = [
                { pattern: '*.xiaohongshu.com/*', enabled: true },
                { pattern: '*.xhscdn.com/*', enabled: true },
                { pattern: '*.fegine.com/*', enabled: true }
            ];
            showStatus('已自动添加默认的小红书URL模式', 'info');
        }

        if (config.maxLogSize < 100 || config.maxLogSize > 10000) {
            showStatus('最大记录数量必须在100-10000之间', 'error');
            return;
        }

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
            ...currentConfig,
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

                // 合并配置
                currentConfig = { ...DEFAULT_CONFIG, ...importedConfig };
                updateUI();
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
        if (config.urlPatterns && !Array.isArray(config.urlPatterns)) return false;
        if (config.monitorTypes && typeof config.monitorTypes !== 'object') return false;
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

    // HTML转义
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 监听来自其他脚本的消息
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'getConfig') {
            sendResponse({ config: currentConfig });
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

    console.log('小红书监控插件配置页面已加载');

})(); 