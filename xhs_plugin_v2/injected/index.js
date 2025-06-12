'use strict';

import { interceptFetch } from './fetch.js';
import { interceptXHR } from './xhr.js';
import { observeDOM } from './observer.js';

console.log('小红书网络请求拦截器模块已注入');

// 依次启动各个拦截器
try {
    interceptFetch();
    interceptXHR();
    observeDOM();
    console.log('所有网络请求拦截器已成功初始化');
} catch (error) {
    console.error('初始化网络拦截器时发生错误:', error);
} 