// 测试Content Script事件监听
console.log('=== 测试Content Script事件监听 ===');

// 添加一个测试监听器
window.addEventListener('TEST_EVENT', function(event) {
    console.log('[Test] 收到测试事件:', event.detail);
});

// 发送测试事件
const testEvent = new CustomEvent('TEST_EVENT', {
    detail: { message: 'Hello from test!' }
});

console.log('发送测试事件...');
document.dispatchEvent(testEvent);

// 检查现有的监听器
console.log('检查XHS_GET_CONFIG监听器...');

// 创建一个简单的配置请求测试
const configTestId = 'config-test-' + Date.now();
let configReceived = false;

const configTestHandler = (event) => {
    console.log('[Test] XHS_CONFIG_RESPONSE 事件收到:', event.detail);
    if (event.detail.requestId === configTestId) {
        configReceived = true;
        document.removeEventListener('XHS_CONFIG_RESPONSE', configTestHandler);
        console.log('[Test] ✓ 配置响应已收到');
    }
};

document.addEventListener('XHS_CONFIG_RESPONSE', configTestHandler);

// 发送配置请求
const configEvent = new CustomEvent('XHS_GET_CONFIG', {
    detail: { requestId: configTestId }
});

console.log('[Test] 发送XHS_GET_CONFIG事件:', configEvent.detail);
document.dispatchEvent(configEvent);

// 3秒后检查结果
setTimeout(() => {
    if (!configReceived) {
        console.error('[Test] ✗ 配置请求超时，Content Script可能没有正确监听');
        // 列出所有事件监听器（如果可能）
        console.log('[Test] 页面标记:', document.documentElement.getAttribute('data-xhs-monitor'));
    }
    document.removeEventListener('XHS_CONFIG_RESPONSE', configTestHandler);
}, 3000);

console.log('=== 测试脚本执行完毕 ==='); 