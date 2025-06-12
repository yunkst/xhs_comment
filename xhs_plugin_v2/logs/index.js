'use strict';

import { setupEventListeners } from './events.js';
import { loadLogs } from './actions.js';

function initialize() {
    console.log('日志查看页面模块正在初始化...');
    setupEventListeners();
    loadLogs();
    console.log('日志查看页面已成功初始化。');
}

// 等待DOM加载完毕后执行
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
} 