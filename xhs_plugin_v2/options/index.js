import { loadConfig, loadApiConfig } from './actions.js';
import { setupEventListeners } from './events.js';
import { toggleOtpInput } from './ui.js';

/**
 * 初始化设置页面
 */
function initialize() {
    // 加载配置
    loadConfig();
    loadApiConfig();

    // 设置事件监听器
    setupEventListeners();

    // 初始化UI状态
    toggleOtpInput(document.getElementById('useOtpCheckbox').checked);
}

// 当DOM加载完成后开始初始化
document.addEventListener('DOMContentLoaded', initialize); 