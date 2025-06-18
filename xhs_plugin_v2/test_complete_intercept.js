// 完整拦截功能测试
console.log('=== 完整拦截功能测试 ===');

// 1. 检查页面监控状态
console.log('1. 检查页面监控状态...');
const monitorStatus = document.documentElement.getAttribute('data-xhs-monitor');
console.log('页面监控状态:', monitorStatus);

// 2. 监听所有拦截事件
let totalInterceptCount = 0;
let requestInterceptCount = 0;
let responseInterceptCount = 0;

const interceptHandler = (event) => {
    totalInterceptCount++;
    const data = event.detail;
    
    if (data.type.includes('_response')) {
        responseInterceptCount++;
        console.log(`✓ 响应拦截事件 #${responseInterceptCount}:`, {
            url: data.url,
            method: data.method,
            type: data.type,
            hasResponse: !!data.response,
            responseBody: data.response?.body ? '有响应体' : '无响应体'
        });
    } else {
        requestInterceptCount++;
        console.log(`✓ 请求拦截事件 #${requestInterceptCount}:`, {
            url: data.url,
            method: data.method,
            type: data.type,
            hasBody: !!data.body
        });
    }
};

document.addEventListener('XHS_REQUEST_INTERCEPTED', interceptHandler);
console.log('开始监听拦截事件...');

// 3. 检查抓取规则
setTimeout(() => {
    console.log('2. 检查后端抓取规则配置...');
    
    // 通过Chrome storage检查抓取规则
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({ action: 'getCaptureRules' }, function(response) {
            if (response && response.data) {
                console.log('✓ 抓取规则已加载:', response.data.length, '条规则');
                response.data.forEach((rule, index) => {
                    console.log(`  规则 ${index + 1}: ${rule.name} - ${rule.pattern}`);
                });
            } else {
                console.error('✗ 未找到抓取规则配置');
            }
        });
    }
}, 500);

// 4. 模拟小红书API请求
setTimeout(() => {
    console.log('3. 发送测试请求以触发拦截...');
    
    // 发送一个肯定会被拦截的小红书API请求
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
        console.log('测试请求响应数据:', data);
    })
    .catch(error => {
        console.log('测试请求失败:', error);
    });
}, 2000);

// 5. 15秒后停止监听并报告结果
setTimeout(() => {
    document.removeEventListener('XHS_REQUEST_INTERCEPTED', interceptHandler);
    
    console.log('=== 测试结果 ===');
    console.log(`总拦截事件: ${totalInterceptCount}`);
    console.log(`请求事件: ${requestInterceptCount}`);
    console.log(`响应事件: ${responseInterceptCount}`);
    
    if (totalInterceptCount > 0) {
        console.log('✓ 拦截功能正常工作');
        if (responseInterceptCount > 0) {
            console.log('✓ 响应数据拦截正常');
        } else {
            console.warn('⚠ 只拦截到请求，没有拦截到响应');
        }
    } else {
        console.error('✗ 拦截功能没有工作');
        console.log('可能的原因:');
        console.log('- 事件监听器没有正确设置');
        console.log('- 抓取规则配置有问题');
        console.log('- 注入脚本没有正确工作');
    }
    
    console.log('=== 测试完成 ===');
}, 15000);

console.log('=== 测试脚本启动完毕，将运行15秒 ==='); 