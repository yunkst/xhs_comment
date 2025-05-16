// 用户备注相关模块

// 添加备注输入框到通知容器
function addNoteInputToContainer(container, userId, notification) {
  if (!container || !userId) return;
  
  // 检查是否已添加备注输入框
  if (container.querySelector('.xhs-note-input')) {
    // 如果已存在备注输入框，检查是否需要更新内容
    updateExistingNoteInput(container, userId, notification);
    return;
  }
  
  // 生成通知哈希
  const notificationHash = generateNotificationHash(notification);
  
  // 创建备注输入框容器
  const noteInputContainer = document.createElement('div');
  noteInputContainer.className = 'xhs-note-container';
  noteInputContainer.style.cssText = `
    position: absolute;
    right: -15px;
    top: 20px;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
  `;
  
  // 创建备注输入框
  const noteInput = document.createElement('textarea');
  noteInput.className = 'xhs-note-input';
  noteInput.placeholder = '添加备注...';
  noteInput.value = window.xhsApiService.userNotes[notificationHash] || '';
  noteInput.dataset.notificationHash = notificationHash; // 存储哈希值到DOM中
  noteInput.dataset.userId = userId; // 存储用户ID到DOM中
  noteInput.style.cssText = `
    width: 150px;
    height: 60px;
    padding: 5px 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 12px;
    outline: none;
    transition: all 0.3s ease;
    resize: none;
    overflow: auto;
    color: #333;
    line-height: 1.4;
    font-family: Arial, sans-serif;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  `;
  
  // 创建状态指示器
  const statusIndicator = document.createElement('div');
  statusIndicator.className = 'xhs-note-status';
  statusIndicator.style.cssText = `
    position: absolute;
    top: -8px;
    right: -8px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background-color: transparent;
    display: none;
    transition: all 0.3s ease;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  `;
  noteInputContainer.appendChild(statusIndicator);
  
  // 添加输入框获取焦点时的样式
  noteInput.addEventListener('focus', () => {
    noteInput.style.borderColor = '#ff2442';
    noteInput.style.boxShadow = '0 0 5px rgba(255,36,66,0.3)';
  });
  
  // 添加输入框失去焦点时的样式
  noteInput.addEventListener('blur', () => {
    noteInput.style.borderColor = '#ddd';
    noteInput.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
  });
  
  // 创建防抖函数，延迟保存备注
  let saveTimeout;
  
  // 添加输入事件，实时保存备注
  noteInput.addEventListener('input', () => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      const newNoteContent = noteInput.value.trim();
      
      // 如果备注内容有变化，则保存
      if (newNoteContent !== (window.xhsApiService.userNotes[notificationHash] || '')) {
        // 显示保存中状态
        statusIndicator.style.display = 'block';
        statusIndicator.style.backgroundColor = '#ffaa00';
        noteInput.style.borderColor = '#ffaa00';
        noteInput.style.boxShadow = '0 0 8px rgba(255,170,0,0.5)';
        
        // 添加保存中动画
        statusIndicator.style.animation = 'xhs-note-saving-pulse 1s infinite';
        
        const saveSuccess = await window.xhsApiService.saveUserNote(userId, notificationHash, newNoteContent);
        
        // 停止保存中动画
        statusIndicator.style.animation = '';
        
        if (saveSuccess) {
          // 保存成功动画
          statusIndicator.style.backgroundColor = '#4caf50';
          noteInput.style.borderColor = '#4caf50';
          noteInput.style.boxShadow = '0 0 8px rgba(76,175,80,0.5)';
          
          // 创建成功提示元素
          const successIcon = document.createElement('div');
          successIcon.className = 'xhs-save-success-icon';
          successIcon.innerHTML = '✓';
          successIcon.style.cssText = `
            position: absolute;
            color: white;
            font-size: 10px;
            font-weight: bold;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
          `;
          statusIndicator.innerHTML = '';
          statusIndicator.appendChild(successIcon);
          
          // 3秒后隐藏状态
          setTimeout(() => {
            statusIndicator.style.display = 'none';
            noteInput.style.borderColor = '#ddd';
            noteInput.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
          }, 2000);
        } else {
          // 保存失败动画
          statusIndicator.style.backgroundColor = '#f44336';
          noteInput.style.borderColor = '#f44336';
          noteInput.style.boxShadow = '0 0 8px rgba(244,67,54,0.5)';
          
          // 创建失败提示元素
          const failIcon = document.createElement('div');
          failIcon.className = 'xhs-save-fail-icon';
          failIcon.innerHTML = '!';
          failIcon.style.cssText = `
            position: absolute;
            color: white;
            font-size: 10px;
            font-weight: bold;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
          `;
          statusIndicator.innerHTML = '';
          statusIndicator.appendChild(failIcon);
          
          // 3秒后隐藏状态
          setTimeout(() => {
            statusIndicator.style.display = 'none';
            noteInput.style.borderColor = '#ddd';
            noteInput.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
          }, 2000);
        }
      }
    }, 500); // 延迟500ms保存，防止频繁请求
  });
  
  // 将输入框添加到容器
  noteInputContainer.appendChild(noteInput);
  container.appendChild(noteInputContainer);
}

// 更新已存在的备注输入框内容
function updateExistingNoteInput(container, userId, notification) {
  const noteInput = container.querySelector('.xhs-note-input');
  if (!noteInput) return;
  
  // 生成通知哈希
  const notificationHash = generateNotificationHash(notification);
  
  // 如果备注内容有变化，则更新输入框
  const currentValue = noteInput.value;
  const newValue = window.xhsApiService.userNotes[notificationHash] || '';
  
  if (currentValue !== newValue) {
    console.log(`更新通知备注输入框内容: ${currentValue} -> ${newValue}`);
    noteInput.value = newValue;
    
    // 更新数据属性
    noteInput.dataset.notificationHash = notificationHash;
    noteInput.dataset.userId = userId;
  }
}

// 刷新页面上所有备注输入框
function refreshAllNoteInputs() {
  console.log('刷新页面上所有备注输入框');
  const noteInputs = document.querySelectorAll('.xhs-note-input');
  
  noteInputs.forEach(input => {
    const notificationHash = input.dataset.notificationHash;
    if (notificationHash) {
      const newValue = window.xhsApiService.userNotes[notificationHash] || '';
      const currentValue = input.value;
      
      if (currentValue !== newValue) {
        console.log(`刷新备注输入框内容: ${currentValue} -> ${newValue}`);
        input.value = newValue;
      }
    }
  });
}

// 生成通知哈希值作为唯一标识
function generateNotificationHash(notification) {
  // 从通知中提取关键信息
  const userId = notification.userInfo?.id || '';
  const content = notification.content || '';
  const interactionType = notification.interaction?.type || '';
  const time = notification.interaction?.time || '';
  
  // 组合关键信息生成唯一标识
  return `${userId}_${content.substring(0, 20)}_${interactionType}_${time}`.replace(/\s+/g, '_');
}

// 导出函数
window.xhsUserNotes = {
  addNoteInputToContainer,
  updateExistingNoteInput,
  refreshAllNoteInputs,
  generateNotificationHash
}; 