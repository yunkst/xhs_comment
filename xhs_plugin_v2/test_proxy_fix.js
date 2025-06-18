// 测试代理请求修复
console.log('=== 测试代理请求修复 ===');

// 1. 测试API配置获取
console.log('1. 测试API配置获取...');
if (typeof window.xhsApiService !== 'undefined') {
    window.xhsApiService.testGetApiConfig()
        .then(config => {
            console.log('✓ API配置获取成功:', config);
            
            // 2. 测试代理请求
            console.log('2. 测试代理请求...');
            return window.xhsApiService.testProxyRequest();
        })
        .then(result => {
            console.log('✓ 代理请求测试成功:', result);
        })
        .catch(error => {
            console.error('✗ 测试失败:', error);
        });
} else {
    console.error('✗ API服务未找到');
}

// 3. 手动测试历史评论API
console.log('3. 手动测试历史评论API...');
setTimeout(() => {
    if (typeof window.xhsApiService !== 'undefined') {
        // 使用一个测试用户ID
        const testUserId = '5f524f820000000001001dd0';
        console.log(`开始测试用户 ${testUserId} 的历史评论获取...`);
        
        window.xhsApiService.fetchUserHistoricalComments(testUserId)
            .then(comments => {
                console.log('✓ 历史评论获取成功:', comments);
            })
            .catch(error => {
                console.error('✗ 历史评论获取失败:', error);
            });
    }
}, 2000);

console.log('=== 测试脚本启动完毕 ==='); 