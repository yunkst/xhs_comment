// API服务相关模块

// 从后端API获取用户历史评论
async function fetchUserHistoricalComments(userId) {
  try {
    console.log(`开始获取用户 ${userId} 的历史评论`);
    
    // 从storage获取API地址和令牌
    const { apiBaseUrl, apiToken } = await getApiConfig();
    
    if (!apiBaseUrl) {
      throw new Error('未配置API地址，请在插件选项中设置');
    }
    
    if (!apiToken) {
      throw new Error('未配置API令牌，请在插件选项中设置');
    }
    
    const url = `${apiBaseUrl}/api/user/${userId}/comments`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API请求失败 (${response.status}): ${errorText}`);
    }
    
    const data = await response.json();
    console.log(`成功获取到用户 ${userId} 的历史评论:`, data);
    return data;
  } catch (error) {
    console.error(`获取用户 ${userId} 的历史评论时出错:`, error);
    throw error;
  }
}

// 从storage获取API配置
function getApiConfig() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['apiBaseUrl', 'apiToken'], function(result) {
      if (chrome.runtime.lastError) {
        reject(new Error(`获取存储数据时出错: ${chrome.runtime.lastError.message}`));
        return;
      }
      
      // 默认API地址，如果未配置则使用默认值
      const apiBaseUrl = result.apiBaseUrl || 'http://localhost:8000';
      const apiToken = result.apiToken || '';
      
      resolve({ apiBaseUrl, apiToken });
    });
  });
}

// 全局变量，用于存储用户备注数据
let userNotes = {};

// 从后端API获取用户备注数据
async function fetchUserNotes(userId) {
  try {
    console.log(`开始获取用户 ${userId} 的备注数据`);
    
    // 从storage获取API地址和令牌
    const { apiBaseUrl, apiToken } = await getApiConfig();
    
    if (!apiBaseUrl) {
      throw new Error('未配置API地址，请在插件选项中设置');
    }
    
    if (!apiToken) {
      throw new Error('未配置API令牌，请在插件选项中设置');
    }
    
    const url = `${apiBaseUrl}/api/user-notes?user_id=${userId}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API请求失败 (${response.status}): ${errorText}`);
    }
    
    const data = await response.json();
    console.log(`成功获取到用户 ${userId} 的备注数据:`, data);
    
    // 将备注数据转换为哈希表格式，方便查找
    const notesMap = {};
    if (data.success && Array.isArray(data.data)) {
      data.data.forEach(note => {
        notesMap[note.notificationHash] = note.noteContent;
      });
    }
    
    // 更新全局备注数据
    Object.assign(userNotes, notesMap);
    
    // 如果用户备注刷新函数存在，调用它刷新页面上的备注显示
    if (window.xhsUserNotes && window.xhsUserNotes.refreshAllNoteInputs) {
      window.xhsUserNotes.refreshAllNoteInputs();
    }
    
    return notesMap;
  } catch (error) {
    console.error(`获取用户 ${userId} 的备注数据时出错:`, error);
    return {};
  }
}

// 保存用户备注到后端
async function saveUserNote(userId, notificationHash, noteContent) {
  try {
    console.log(`开始保存用户 ${userId} 的备注数据`);
    
    // 从storage获取API地址和令牌
    const { apiBaseUrl, apiToken } = await getApiConfig();
    
    if (!apiBaseUrl) {
      throw new Error('未配置API地址，请在插件选项中设置');
    }
    
    if (!apiToken) {
      throw new Error('未配置API令牌，请在插件选项中设置');
    }
    
    const url = `${apiBaseUrl}/api/user-notes`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: userId,
        notificationHash: notificationHash,
        noteContent: noteContent
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API请求失败 (${response.status}): ${errorText}`);
    }
    
    const data = await response.json();
    console.log(`成功保存用户 ${userId} 的备注数据:`, data);
    
    // 更新全局备注数据
    userNotes[notificationHash] = noteContent;
    return true;
  } catch (error) {
    console.error(`保存用户 ${userId} 的备注数据时出错:`, error);
    return false;
  }
}

// 批量获取多个用户的备注数据
async function fetchUserNotesInBatch(userIds) {
  if (!userIds || userIds.length === 0) {
    console.log('没有提供用户ID，无法获取备注');
    return {};
  }
  
  try {
    console.log(`开始批量获取 ${userIds.length} 个用户的备注数据`);
    
    // 从storage获取API地址和令牌
    const { apiBaseUrl, apiToken } = await getApiConfig();
    
    if (!apiBaseUrl) {
      throw new Error('未配置API地址，请在插件选项中设置');
    }
    
    if (!apiToken) {
      throw new Error('未配置API令牌，请在插件选项中设置');
    }
    
    // 构建批量请求URL
    const userIdsParam = userIds.join(',');
    const url = `${apiBaseUrl}/api/user-notes/batch?user_ids=${userIdsParam}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API请求失败 (${response.status}): ${errorText}`);
    }
    
    const data = await response.json();
    console.log(`成功批量获取到 ${userIds.length} 个用户的备注数据:`, data);
    
    // 更新全局备注数据
    if (data.success && data.data) {
      // 合并所有用户的备注
      Object.assign(userNotes, data.data);
      
      // 如果用户备注刷新函数存在，调用它刷新页面上的备注显示
      if (window.xhsUserNotes && window.xhsUserNotes.refreshAllNoteInputs) {
        window.xhsUserNotes.refreshAllNoteInputs();
      }
      
      console.log(`成功更新 ${Object.keys(data.data).length} 条备注数据`);
    }
    
    return data.data || {};
  } catch (error) {
    console.error(`批量获取用户备注数据时出错:`, error);
    return {};
  }
}

// 在页面加载时初始化用户备注
async function initializeUserNotes() {
  try {
    console.log('开始初始化用户备注');
    
    // 获取所有显示的用户ID
    const userIds = getVisibleUserIds();
    
    if (!userIds.length) {
      console.log('未找到页面上的用户ID，暂不获取备注');
      return;
    }
    
    // 从storage获取API令牌
    const { apiToken } = await getApiConfig();
    
    if (!apiToken) {
      console.warn('未登录或未配置API令牌，无法获取备注');
      return;
    }
    
    // 批量获取所有用户备注
    console.log(`开始批量获取 ${userIds.length} 个用户的备注数据`);
    await fetchUserNotesInBatch(userIds);
    
  } catch (error) {
    console.error('初始化用户备注时出错:', error);
  }
}

// 获取页面上显示的所有用户ID
function getVisibleUserIds() {
  try {
    // 获取所有通知容器
    const containers = document.querySelectorAll('.tabs-content-container .container');
    const userIds = [];
    
    // 遍历每个容器，提取用户ID
    containers.forEach(container => {
      // 提取用户信息
      const userLink = container.querySelector('.user-info a');
      if (userLink) {
        const userUrl = userLink.href;
        const userId = window.xhsUtils.extractUserIdFromUrl(userUrl);
        if (userId && !userIds.includes(userId)) {
          userIds.push(userId);
        }
      }
    });
    
    console.log(`从页面上获取到 ${userIds.length} 个用户ID`);
    return userIds;
  } catch (error) {
    console.error('获取页面用户ID时出错:', error);
    return [];
  }
}

// 导出函数和变量
window.xhsApiService = {
  fetchUserHistoricalComments,
  getApiConfig,
  fetchUserNotes,
  fetchUserNotesInBatch,
  saveUserNote,
  initializeUserNotes,
  getVisibleUserIds,
  userNotes
}; 