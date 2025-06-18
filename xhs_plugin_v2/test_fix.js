// 测试修复后的通信
console.log('=== 测试修复后的通信 ===');

// 1. 测试基本事件通信
console.log('1. 测试基本事件通信...');
const basicTestId = 'basic-test-' + Date.now();

const basicHandler = (event) => {
    console.log('✓ 基本事件通信正常:', event.detail);
    if (event.detail.requestId === basicTestId) {
        document.removeEventListener('BASIC_TEST_RESPONSE', basicHandler);
    }
};

document.addEventListener('BASIC_TEST_RESPONSE', basicHandler);

// 模拟Content Script响应
setTimeout(() => {
    const responseEvent = new CustomEvent('BASIC_TEST_RESPONSE', {
        detail: { requestId: basicTestId, message: 'Test response' }
    });
    document.dispatchEvent(responseEvent);
}, 100);

const basicEvent = new CustomEvent('BASIC_TEST_REQUEST', {
    detail: { requestId: basicTestId }
});
document.dispatchEvent(basicEvent);

// 2. 测试API配置获取
console.log('2. 测试API配置获取...');
setTimeout(() => {
    if (typeof window.xhsApiService !== 'undefined') {
        console.log('API服务可用，开始测试...');
        window.xhsApiService.testGetApiConfig()
            .then(config => console.log('✓ API配置获取成功:', config))
            .catch(error => console.error('✗ API配置获取失败:', error));
    } else {
        console.error('✗ API服务未找到');
    }
}, 1000);

console.log('=== 测试脚本启动完毕 ==='); 