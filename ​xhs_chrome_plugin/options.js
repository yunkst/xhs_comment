// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', function() {
  // 获取DOM元素
  const apiHostInput = document.getElementById('apiHost');
  const apiTokenInput = document.getElementById('apiToken');
  const saveBtn = document.getElementById('saveBtn');
  const statusEl = document.getElementById('status');
  
  // 从storage中加载已保存的配置
  chrome.storage.local.get(['apiBaseUrl', 'apiToken'], function(result) {
    if (result.apiBaseUrl) {
      apiHostInput.value = result.apiBaseUrl;
    }
    if (result.apiToken) {
      apiTokenInput.value = result.apiToken;
    }
    
    console.log('从存储加载配置:', result);
  });
  
  // 保存按钮点击事件
  saveBtn.addEventListener('click', function() {
    const apiBaseUrl = apiHostInput.value.trim();
    const apiToken = apiTokenInput.value.trim();
    
    // 基本验证
    if (apiBaseUrl && !apiBaseUrl.startsWith('http')) {
      showStatus('错误：API接口地址必须以http://或https://开头', 'error');
      return;
    }
    
    // 保存配置到storage
    chrome.storage.local.set({
      apiBaseUrl: apiBaseUrl,
      apiToken: apiToken
    }, function() {
      // 检查是否发生错误
      if (chrome.runtime.lastError) {
        showStatus('保存失败: ' + chrome.runtime.lastError.message, 'error');
        console.error('保存配置失败:', chrome.runtime.lastError);
      } else {
        showStatus('配置已保存', 'success');
        console.log('配置已保存成功');
      }
    });
  });
  
  // 显示状态消息
  function showStatus(message, type) {
    statusEl.textContent = message;
    statusEl.className = 'status ' + type;
    statusEl.style.display = 'block';
    
    // 3秒后自动隐藏
    setTimeout(function() {
      statusEl.style.display = 'none';
    }, 3000);
  }
}); 