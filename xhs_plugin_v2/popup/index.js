import { setupEventListeners } from './events.js';
import { loadApiConfig, loadSsoSession, loadMonitorConfig, loadRequestStats, loadCaptureRules } from './actions.js';
import { updateAllUI } from './ui.js';

/**
 * 初始化Popup页面
 */
function initialize() {
    console.log('[XHS Monitor Popup] 初始化...');
    
    // 加载所有必要的数据
    loadApiConfig();
    loadSsoSession();
    loadMonitorConfig();
    loadRequestStats();
    loadCaptureRules();
    
    // 设置事件监听器
    setupEventListeners();
    
    // 初始UI更新
    updateAllUI();
}

// 当DOM加载完成后开始初始化
document.addEventListener('DOMContentLoaded', initialize); 