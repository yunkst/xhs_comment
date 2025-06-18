// 快速测试通信链路
console.log('=== 开始快速测试 ===');

// 1. 测试Content Script是否存在
console.log('1. 测试页面标记:', document.documentElement.getAttribute('data-xhs-monitor'));

// 2. 测试事件监听是否工作
console.log('2. 测试事件通信...');
const testRequestId = 'test-' + Date.now();

// 监听响应
const testHandler = (event) => {
    console.log('✓ 收到测试响应:', event.detail);
    if (event.detail.requestId === testRequestId) {
        document.removeEventListener('XHS_CONFIG_RESPONSE', testHandler);
        console.log('✓ 事件通信正常工作');
    }
};

document.addEventListener('XHS_CONFIG_RESPONSE', testHandler);

// 发送测试事件
const testEvent = new CustomEvent('XHS_GET_CONFIG', {
    detail: { requestId: testRequestId }
});

console.log('发送测试事件:', testEvent.detail);
document.dispatchEvent(testEvent);

// 5秒后清理
setTimeout(() => {
    document.removeEventListener('XHS_CONFIG_RESPONSE', testHandler);
    console.log('测试超时，清理监听器');
}, 5000);

console.log('=== 测试脚本执行完毕 ==='); 