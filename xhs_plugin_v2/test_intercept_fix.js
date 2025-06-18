// 测试拦截功能修复
console.log('=== 测试拦截功能修复 ===');

// 1. 监听拦截事件
let interceptCount = 0;
const interceptHandler = (event) => {
    interceptCount++;
    const data = event.detail;
    console.log(`✓ 拦截事件 #${interceptCount}:`, {
        url: data.url,
        method: data.method,
        type: data.type,
        hasResponse: !!data.response,
        timestamp: data.timestamp
    });
};

document.addEventListener('XHS_REQUEST_INTERCEPTED', interceptHandler);

console.log('开始监听拦截事件...');

// 2. 模拟一个小红书API请求来测试拦截
setTimeout(() => {
    console.log('发送测试请求...');
    
    // 发送一个实际的小红书API请求来触发拦截
    fetch('//edith.xiaohongshu.com/api/sns/web/unread_count', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        console.log('测试请求完成，状态:', response.status);
        return response.json();
    })
    .then(data => {
        console.log('测试请求响应:', data);
    })
    .catch(error => {
        console.log('测试请求失败:', error);
    });
}, 1000);

// 3. 10秒后停止监听并报告结果
setTimeout(() => {
    document.removeEventListener('XHS_REQUEST_INTERCEPTED', interceptHandler);
    
    if (interceptCount > 0) {
        console.log(`✓ 拦截功能正常工作，共拦截到 ${interceptCount} 个事件`);
    } else {
        console.error('✗ 拦截功能没有工作，未拦截到任何事件');
    }
    
    console.log('=== 测试完成 ===');
}, 10000);

console.log('=== 测试脚本启动完毕 ==='); 