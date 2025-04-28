document.addEventListener('DOMContentLoaded', function() {
  // 获取DOM元素
  const getNotificationsButton = document.getElementById('getNotifications');
  const downloadDataButton = document.getElementById('downloadData');
  const statusElement = document.getElementById('status');
  const resultElement = document.getElementById('result');
  
  // 存储获取到的通知数据
  let notificationsData = [];
  
  // 获取通知按钮点击事件
  getNotificationsButton.addEventListener('click', function() {
    statusElement.textContent = '正在获取通知列表...';
    
    // 检查当前标签页是否是小红书通知页面
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs.length === 0) {
        statusElement.textContent = '无法获取当前标签页信息';
        return;
      }
      
      const currentTab = tabs[0];
      
      // 如果不是小红书通知页面，则跳转
      if (!currentTab.url.includes('xiaohongshu.com/notification')) {
        statusElement.textContent = '正在跳转到小红书通知页面...';
        chrome.tabs.update(currentTab.id, {
          url: 'https://www.xiaohongshu.com/notification'
        });
        return;
      }
      
      // 执行脚本获取数据
      chrome.scripting.executeScript({
        target: {tabId: currentTab.id},
        function: extractNotificationsFromPage
      }).then(results => {
        if (!results || results.length === 0 || !results[0].result) {
          statusElement.textContent = '获取失败: 无法从页面提取数据';
          return;
        }
        
        // 存储获取到的数据
        notificationsData = results[0].result;
        
        // 显示成功信息
        statusElement.textContent = `成功获取 ${notificationsData.length} 条通知`;
        
        // 显示数据预览
        if (notificationsData.length > 0) {
          resultElement.style.display = 'block';
          resultElement.innerHTML = '<h3>数据预览:</h3>' + 
            '<pre>' + JSON.stringify(notificationsData.slice(0, 3), null, 2) + '</pre>' +
            (notificationsData.length > 3 ? '<p>...</p>' : '');
        }
      }).catch(error => {
        console.error('执行脚本出错:', error);
        statusElement.textContent = '获取失败: ' + (error.message || '未知错误');
      });
    });
  });
  
  // 下载数据按钮点击事件
  downloadDataButton.addEventListener('click', function() {
    if (notificationsData.length === 0) {
      statusElement.textContent = '没有数据可供下载，请先获取通知列表';
      return;
    }
    
    // 将数据转换为JSON字符串
    const dataStr = JSON.stringify(notificationsData, null, 2);
    
    // 创建下载链接
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    
    // 创建并触发下载
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = 'xiaohongshu_notifications_' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    statusElement.textContent = '数据已下载';
  });
});

// 此函数将在目标页面中执行
function extractNotificationsFromPage() {
  // 获取当前激活的标签类型
  function getActiveTabType() {
    const activeTab = document.querySelector('.reds-tabs-list .reds-tab-item.active');
    return activeTab ? activeTab.textContent.trim() : '未知';
  }
  
  // 从URL中提取用户ID
  function extractUserIdFromUrl(url) {
    if (!url) return '';
    
    try {
      const match = url.match(/\/profile\/([^?]+)/);
      return match ? match[1] : '';
    } catch (error) {
      return '';
    }
  }
  
  // 提取元素的文本内容（包括emoji）
  function extractTextContent(element) {
    if (!element) return '';
    
    // 克隆节点以避免修改原始DOM
    const clone = element.cloneNode(true);
    
    // 处理emoji图片
    const emojiImgs = clone.querySelectorAll('img.note-content-emoji');
    emojiImgs.forEach(img => {
      // 替换emoji图片为[emoji]标记
      img.replaceWith('[emoji]');
    });
    
    return clone.textContent.trim();
  }
  
  const notifications = [];
  
  // 获取当前激活的标签类型
  const activeTabType = getActiveTabType();
  
  // 获取所有通知容器
  const containerElements = document.querySelectorAll('.tabs-content-container .container');
  
  // 判断是否有数据
  if (containerElements.length === 0) {
    console.log('未找到通知数据，可能页面结构已变化或无数据');
  }
  
  // 遍历每个通知容器
  containerElements.forEach((container, index) => {
    try {
      // 提取用户信息
      const userLink = container.querySelector('.user-info a');
      const userName = userLink ? userLink.textContent.trim() : '';
      const userUrl = userLink ? userLink.href : '';
      const userId = extractUserIdFromUrl(userUrl);
      const userAvatar = container.querySelector('.user-avatar img')?.src || '';
      const userTag = container.querySelector('.user-tag')?.textContent.trim() || '';
      
      // 提取交互信息
      const interactionType = container.querySelector('.interaction-hint span:first-child')?.textContent.trim() || '';
      const interactionTime = container.querySelector('.interaction-hint .interaction-time')?.textContent.trim() || '';
      
      // 提取内容
      const content = extractTextContent(container.querySelector('.interaction-content'));
      
      // 提取引用内容（如果有）
      const quoteInfo = extractTextContent(container.querySelector('.quote-info'));
      
      // 提取图片信息
      const extraImage = container.querySelector('.extra img')?.src || '';
      
      // 构建通知对象
      const notification = {
        id: index.toString(), // 使用索引作为ID
        tabType: activeTabType, // 标签类型
        userInfo: {
          id: userId,
          name: userName,
          avatar: userAvatar,
          url: userUrl,
          tag: userTag
        },
        interaction: {
          type: interactionType,
          time: interactionTime
        },
        content: content,
        quoteContent: quoteInfo,
        extraImage: extraImage
      };
      
      notifications.push(notification);
    } catch (error) {
      console.error('提取通知数据出错:', error);
    }
  });
  
  return notifications;
} 