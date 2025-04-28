// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', function() {
  // 获取DOM元素
  const apiHostInput = document.getElementById('apiHost');
  const apiTokenInput = document.getElementById('apiToken');
  const saveBtn = document.getElementById('saveBtn');
  const statusEl = document.getElementById('status');
  
  // 从storage中加载已保存的配置
  chrome.storage.sync.get(['apiHost', 'apiToken'], function(result) {
    if (result.apiHost) {
      apiHostInput.value = result.apiHost;
    }
    if (result.apiToken) {
      apiTokenInput.value = result.apiToken;
    }
  });
  
  // 保存按钮点击事件
  saveBtn.addEventListener('click', function() {
    const apiHost = apiHostInput.value.trim();
    const apiToken = apiTokenInput.value.trim();
    
    // 基本验证
    if (apiHost && !apiHost.startsWith('http')) {
      showStatus('错误：API接口地址必须以http://或https://开头', 'error');
      return;
    }
    
    // 保存配置到storage
    chrome.storage.sync.set({
      apiHost: apiHost,
      apiToken: apiToken
    }, function() {
      // 检查是否发生错误
      if (chrome.runtime.lastError) {
        showStatus('保存失败: ' + chrome.runtime.lastError.message, 'error');
      } else {
        showStatus('配置已保存', 'success');
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