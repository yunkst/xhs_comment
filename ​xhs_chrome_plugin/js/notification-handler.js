// 通知相关功能模块

// 从页面DOM中提取通知数据
function extractNotificationsFromDOM() {
  console.log('开始从DOM提取通知数据');
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
      const userId = window.xhsUtils.extractUserIdFromUrl(userUrl);
      const userAvatar = container.querySelector('.user-avatar img')?.src || '';
      const userTag = container.querySelector('.user-tag')?.textContent.trim() || '';
      
      // 提取交互信息
      const interactionType = container.querySelector('.interaction-hint span:first-child')?.textContent.trim() || '';
      const interactionTime = container.querySelector('.interaction-hint .interaction-time')?.textContent.trim() || '';
      
      // 提取内容
      const content = window.xhsUtils.extractTextContent(container.querySelector('.interaction-content'));
      
      // 提取引用内容（如果有）
      const quoteInfo = window.xhsUtils.extractTextContent(container.querySelector('.quote-info'));
      
      // 提取图片信息
      const extraImage = container.querySelector('.extra img')?.src || '';
      
      // 获取笔记信息（如果有）
      const noteInfo = window.xhsUtils.extractNoteInfo(extraImage);
      
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
        noteInfo: noteInfo,
        extraImage: extraImage
      };
      
      notifications.push(notification);
    } catch (error) {
      console.error('提取通知数据出错:', error);
    }
  });
  
  return notifications;
}

// 为通知列表添加红色按钮
function addButtonsToNotifications() {
  // 检查是否在通知页面
  if (!window.location.href.includes('xiaohongshu.com/notification')) {
    console.log('当前不在通知页面，不添加按钮');
    return;
  }
  
  console.log('准备为通知列表添加红色按钮和备注输入框');
  
  // 遍历每个通知容器，添加红色按钮和备注输入框
  function addButtonsToContainers(containers) {
    console.log(`开始为 ${containers.length} 个容器添加按钮和备注输入框`);
    
    // 提取通知数据
    const notificationsData = extractNotificationsFromDOM();
    
    // 收集新的用户ID，以便批量获取他们的备注
    const newUserIds = new Set();
    notificationsData.forEach(notification => {
      const userId = notification.userInfo?.id;
      if (userId && !window.xhsApiService.userNotes.hasOwnProperty('_loaded_user_' + userId)) {
        newUserIds.add(userId);
        // 标记这个用户ID已经被处理，避免重复请求
        window.xhsApiService.userNotes['_loaded_user_' + userId] = true;
      }
    });
    
    // 如果有新用户，批量获取他们的备注
    if (newUserIds.size > 0) {
      console.log(`发现 ${newUserIds.size} 个新用户，批量获取他们的备注`);
      // 异步获取所有用户的备注，不阻塞UI
      (async function() {
        try {
          // 将Set转为数组
          const userIdsArray = Array.from(newUserIds);
          await window.xhsApiService.fetchUserNotesInBatch(userIdsArray);
        } catch(error) {
          console.error(`批量获取用户备注失败:`, error);
        }
      })();
    }
    
    containers.forEach((container, index) => {
      // 检查容器是否已经有按钮
      if (container.querySelector('.xhs-plugin-action-btn')) {
        console.log(`容器 ${index} 已有按钮，跳过`);
      } else {
        console.log(`为通知 ${index} 添加按钮`);
        // 创建按钮元素
        const button = document.createElement('div');
        button.className = 'xhs-plugin-action-btn';
        button.style.cssText = `
          width: auto;
          height: 28px;
          padding: 0 10px;
          border-radius: 14px;
          background-color: #ff2442;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          position: absolute;
          left: -100px;
          top: 50%;
          transform: translateY(-50%);
          cursor: pointer;
          z-index: 999;
          font-size: 12px;
          font-weight: bold;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        `;
        button.innerHTML = '历史评论';
        
        // 添加点击事件，显示弹出框
        button.addEventListener('click', (event) => {
          console.log(`点击了通知按钮 ${index}`);
          event.stopPropagation();
          // 从DOM层次结构找到这个容器的索引
          const allContainers = Array.from(document.querySelectorAll('.tabs-content-container .container'));
          const containerIndex = allContainers.indexOf(container);
          console.log(`容器索引: ${containerIndex}`);
          window.xhsDialogManager.showNotificationDialog(containerIndex);
        });
        
        // 确保容器是相对定位，这样按钮的绝对定位才能正确显示
        if (window.getComputedStyle(container).position === 'static') {
          console.log(`设置容器 ${index} 为相对定位`);
          container.style.position = 'relative';
        }
        
        // 为容器添加额外的右侧内边距，避免内容被备注输入框遮挡
        container.style.paddingRight = '180px';
        
        // 将按钮添加到容器中
        container.appendChild(button);
        console.log(`按钮 ${index} 添加成功`);
      }
      
      // 添加备注输入框
      if (notificationsData[index]) {
        const notification = notificationsData[index];
        const userId = notification.userInfo?.id;
        
        if (userId) {
          // 检查容器是否已经有备注输入框
          if (!container.querySelector('.xhs-note-input')) {
            console.log(`为通知 ${index} 添加备注输入框`);
            window.xhsUserNotes.addNoteInputToContainer(container, userId, notification);
          }
        }
      }
    });
    
    console.log(`完成按钮和备注输入框添加，共处理 ${containers.length} 个容器`);
  }

  // 初始添加按钮
  const initialContainers = document.querySelectorAll('.tabs-content-container .container');
  console.log(`初始化时发现 ${initialContainers.length} 个容器`);
  addButtonsToContainers(initialContainers);
  
  // 设置DOM变化监听器
  const observer = new MutationObserver((mutations) => {
    // 检查是否有新的通知容器被添加
    const newContainers = document.querySelectorAll('.tabs-content-container .container');
    console.log(`Observer检测到变化, 当前有 ${newContainers.length} 个容器`);
    
    // 添加检查以确定是否有无按钮的容器
    const containersWithoutButtons = Array.from(newContainers).filter(container => 
      !container.querySelector('.xhs-plugin-action-btn')
    );
    
    if (containersWithoutButtons.length > 0) {
      console.log(`发现 ${containersWithoutButtons.length} 个无按钮的容器，添加按钮`);
      addButtonsToContainers(newContainers);
    }
  });
  
  // 开始监听DOM变化
  const tabsContentContainer = document.querySelector('.tabs-content-container');
  if (tabsContentContainer) {
    observer.observe(tabsContentContainer, { 
      childList: true, // 监听子节点变化
      subtree: true,   // 监听所有后代节点变化
      attributes: false
    });
    console.log('已设置DOM监听器，将自动为新通知添加按钮');
    
    // 每秒检查一次是否有新的通知容器
    const intervalId = setInterval(() => {
      const allContainers = document.querySelectorAll('.tabs-content-container .container');
      const containersWithoutButtons = Array.from(allContainers).filter(container => 
        !container.querySelector('.xhs-plugin-action-btn')
      );
      
      if (containersWithoutButtons.length > 0) {
        console.log(`定时检查: 发现 ${containersWithoutButtons.length} 个无按钮的容器，添加按钮`);
        addButtonsToContainers(allContainers);
      }
    }, 1000);
    
    // 监听滚动事件，滚动后检查是否需要添加按钮
    window.addEventListener('scroll', () => {
      console.log('页面滚动，检查是否有新容器');
      // 防抖，滚动结束后再检查
      clearTimeout(window.scrollTimer);
      window.scrollTimer = setTimeout(() => {
        const allContainers = document.querySelectorAll('.tabs-content-container .container');
        console.log(`滚动后检查: 当前有 ${allContainers.length} 个容器`);
        addButtonsToContainers(allContainers);
      }, 300);
    });
  }
  
  // 添加样式
  if (!document.querySelector('style.xhs-plugin-style')) {
    console.log('添加插件样式');
    const style = document.createElement('style');
    style.className = 'xhs-plugin-style';
    style.textContent = `
      .xhs-plugin-action-btn:hover {
        opacity: 0.9;
        transform: translateY(-50%) scale(1.05);
        transition: all 0.2s ease;
      }
      
      .xhs-plugin-dialog {
        position: fixed;
        top: 50%;
        left: 15%;
        transform: translate(-50%, -50%);
        width: 500px;
        height: 80vh;
        background-color: #000000;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        z-index: 10000;
        display: flex;
        flex-direction: column;
        color: white;
        pointer-events: auto; /* 确保弹框可以接收鼠标事件 */
      }
      
      .xhs-plugin-dialog-header {
        padding: 10px;
        border-bottom: 1px solid #333;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background-color: #111;
      }
      
      .xhs-plugin-dialog-title {
        font-weight: bold;
        color: white;
      }
      
      .xhs-plugin-dialog-close {
        cursor: pointer;
        font-size: 20px;
        color: white;
      }
      
      .xhs-plugin-dialog-content {
        flex: 1;
        padding: 20px;
        overflow: auto;
        background-color: #000000;
        color: white;
      }
      
      /* 备注输入框样式 */
      .xhs-note-input {
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 5px 8px;
        font-size: 12px;
        height: 60px;
        width: 150px;
        outline: none;
        transition: border-color 0.2s;
        resize: none;
        color: #777;
        line-height: 1.4;
        font-family: Arial, sans-serif;
      }
      
      .xhs-note-input:focus {
        border-color: #ff2442;
        box-shadow: 0 0 3px rgba(255, 36, 66, 0.3);
      }
      
      .xhs-note-input::placeholder {
        color: #aaa;
      }
    `;
    document.head.appendChild(style);
  }
  
  console.log('成功添加红色按钮到通知列表');
}

// 获取当前激活的标签类型
function getActiveTabType() {
  const activeTab = document.querySelector('.reds-tabs-list .reds-tab-item.active');
  return activeTab ? activeTab.textContent.trim() : '未知';
}

// 导航到通知页面
function navigateToNotificationPage() {
  window.location.href = 'https://www.xiaohongshu.com/notification';
}

// 导出函数
window.xhsNotificationHandler = {
  extractNotificationsFromDOM,
  addButtonsToNotifications,
  getActiveTabType,
  navigateToNotificationPage
}; 