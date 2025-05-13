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
    right: 15px;
    top: 50%;
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
    transition: border-color 0.2s;
    resize: none;
    overflow: auto;
    color: #777;
    line-height: 1.4;
    font-family: Arial, sans-serif;
  `;
  
  // 添加输入框获取焦点时的样式
  noteInput.addEventListener('focus', () => {
    noteInput.style.borderColor = '#ff2442';
  });
  
  // 添加输入框失去焦点时的样式
  noteInput.addEventListener('blur', () => {
    noteInput.style.borderColor = '#ddd';
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
        noteInput.style.borderColor = '#ffaa00'; // 保存中状态
        
        const saveSuccess = await window.xhsApiService.saveUserNote(userId, notificationHash, newNoteContent);
        
        if (saveSuccess) {
          noteInput.style.borderColor = '#4caf50'; // 保存成功状态
          setTimeout(() => {
            noteInput.style.borderColor = '#ddd';
          }, 1000);
        } else {
          noteInput.style.borderColor = '#f44336'; // 保存失败状态
          setTimeout(() => {
            noteInput.style.borderColor = '#ddd';
          }, 1000);
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