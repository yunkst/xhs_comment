// 调试API配置获取功能
(function() {
    console.log('[Debug] 开始调试API配置获取功能...');
    
    // 检查插件API服务是否可用
    if (typeof window.xhsApiService === 'undefined') {
        console.error('[Debug] 插件API服务未找到，请确保在小红书页面执行此脚本');
        return;
    }
    
    console.log('[Debug] 插件API服务已找到:', Object.keys(window.xhsApiService));
    
    // 测试API配置获取
    async function debugApiConfig() {
        try {
            console.log('[Debug] 开始测试getApiConfig...');
            
            // 直接调用getApiConfig函数
            const config = await window.xhsApiService.getApiConfig();
            console.log('[Debug] getApiConfig成功:', config);
            
            return config;
        } catch (error) {
            console.error('[Debug] getApiConfig失败:', error);
            throw error;
        }
    }
    
    // 测试事件通信
    function debugEventCommunication() {
        console.log('[Debug] 开始测试事件通信...');
        
        const requestId = Math.random().toString(36).substr(2, 9);
        console.log('[Debug] 生成requestId:', requestId);
        
        // 监听响应
        const responseHandler = (event) => {
            const response = event.detail;
            console.log('[Debug] 收到事件响应:', response);
            
            if (response.requestId === requestId) {
                document.removeEventListener('XHS_CONFIG_RESPONSE', responseHandler);
                console.log('[Debug] 事件通信测试完成');
            }
        };
        
        document.addEventListener('XHS_CONFIG_RESPONSE', responseHandler);
        
        // 发送请求
        const event = new CustomEvent('XHS_GET_CONFIG', {
            detail: { requestId: requestId }
        });
        
        console.log('[Debug] 发送配置请求事件:', event.detail);
        document.dispatchEvent(event);
        
        // 5秒后检查是否收到响应
        setTimeout(() => {
            document.removeEventListener('XHS_CONFIG_RESPONSE', responseHandler);
            console.log('[Debug] 事件通信测试超时');
        }, 5000);
    }
    
    // 暴露调试函数到全局
    window.debugApiConfig = debugApiConfig;
    window.debugEventCommunication = debugEventCommunication;
    
    console.log('[Debug] 调试函数已准备完毕，可以调用:');
    console.log('- window.debugApiConfig() // 测试API配置获取');
    console.log('- window.debugEventCommunication() // 测试事件通信');
    
})(); 