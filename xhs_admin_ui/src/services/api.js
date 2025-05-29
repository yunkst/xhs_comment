import axios from 'axios';

// 创建axios实例
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// 是否正在刷新token的标记
let isRefreshing = false;
// 重试队列，每一项将是一个待执行的函数形式
let refreshSubscribers = [];

// 将所有请求加入队列
const subscribeTokenRefresh = (cb) => {
  refreshSubscribers.push(cb);
};

// 刷新请求（通知队列中的请求继续执行）
const onRefreshed = (token) => {
  refreshSubscribers.forEach(cb => cb(token));
  refreshSubscribers = [];
};

// 刷新Token
const refreshToken = async () => {
  try {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      return null;
    }
    
    const response = await axios.post(
      `${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/user/auth/sso-refresh`,
      { refresh_token: refreshToken },
      { headers: { 'Content-Type': 'application/json' }}
    );
    
    const data = response.data;
    localStorage.setItem('token', data.access_token);
    
    if (data.refresh_token) {
      localStorage.setItem('refresh_token', data.refresh_token);
    }
    
    return data.access_token;
  } catch (error) {
    console.error('刷新令牌失败,删除所有token', error);
    // 刷新失败，清除所有令牌
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('id_token');
    return null;
  }
};

// 请求拦截器
api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  response => {
    return response.data;
  },
  async error => {
    const originalRequest = error.config;
    
    // 如果状态码是401(未授权)
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      // 如果refresh_token存在且尚未开始刷新
      if (localStorage.getItem('refresh_token') && !isRefreshing) {
        originalRequest._retry = true;
        isRefreshing = true;
        
        const newToken = await refreshToken();
        isRefreshing = false;
        
        if (newToken) {
          // 通知所有请求继续执行
          onRefreshed(newToken);
          // 重试当前请求
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          return axios(originalRequest);
        }
      }
      
      // 如果已经在刷新，则将请求加入队列
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh(token => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            resolve(axios(originalRequest));
          });
        });
      }
      
      // 清除token并重定向到登录页
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('id_token');
      window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

// 用户相关接口
export const userApi = {
  login: (data) => {
    return api.post('/api/login', data);
  },
  register: (data) => {
    return api.post('/api/register', data);
  },
  getOtpQrcode: (username) => {
    return api.get(`/api/otp-qrcode?username=${username}`);
  }
};

// SSO相关接口
export const ssoApi = {
  // 获取SSO登录URL
  getSsoLoginUrl: () => {
    return api.get('/api/v1/user/auth/sso-login-url');
  },
  // 刷新SSO Token
  refreshSsoToken: (refreshToken) => {
    return api.post('/api/v1/user/auth/sso-refresh', { refresh_token: refreshToken });
  },
  // 获取SSO用户信息
  getSsoUserInfo: () => {
    return api.get('/api/v1/user/auth/sso-userinfo');
  }
};

// 评论相关接口
export const commentApi = {
  // 获取评论列表
  getCommentList: (params) => {
    return api.get('/api/v1/content/comments', { params });
  },
  // 获取评论统计
  getCommentsStats: () => {
    return api.get('/api/v1/content/comments/stats');
  },
  // 获取特定用户的评论
  getUserComments: (userId) => {
    return api.get(`/api/v1/content/comments/user/${userId}`);
  },
  // 获取单条评论详情
  getComment: (commentId) => {
    return api.get(`/api/v1/content/comments/${commentId}`);
  },
  // 删除评论
  deleteComment: (commentId) => {
    return api.delete(`/api/v1/content/comments/${commentId}`);
  },
  // 更新评论状态 (向后兼容，如果原有接口支持)
  updateCommentStatus: (commentId, status) => {
    return api.put(`/api/comments/${commentId}/status`, { status });
  },
  // 批量更新评论状态 (向后兼容，如果原有接口支持)
  batchUpdateStatus: (ids, status) => {
    return api.put('/api/comments/batch/status', { ids, status });
  },
  // 批量删除评论 (向后兼容，如果原有接口支持)
  batchDelete: (ids) => {
    return api.post('/api/comments/batch/delete', { ids });
  }
};

// 笔记相关接口
export const noteApi = {
  // 获取笔记列表
  getNoteList: (params) => {
    return api.get('/api/v1/content/notes', { params });
  },
  // 获取笔记统计
  getNotesStats: () => {
    return api.get('/api/v1/content/notes/stats');
  },
  // 获取单条笔记详情
  getNote: (noteId) => {
    return api.get(`/api/v1/content/notes/${noteId}`);
  },
  // 删除笔记
  deleteNote: (noteId) => {
    return api.delete(`/api/v1/content/notes/${noteId}`);
  }
};

// 用户管理接口
export const userManagementApi = {
  // 获取用户列表
  getUserList: (params) => {
    return api.get('/api/v1/user/profile', { params });
  },
  // 获取用户统计
  getUsersStats: () => {
    return api.get('/api/v1/user/profile/stats');
  },
  // 获取用户详情
  getUserDetail: (userId) => {
    return api.get(`/api/v1/user/profile/${userId}`);
  },
  // 获取当前用户信息
  getCurrentUser: () => {
    return api.get('/api/v1/user/auth/me');
  },
  // 禁言用户 (向后兼容，如果原有接口支持)
  muteUser: (userId, data) => {
    return api.post(`/api/users/${userId}/mute`, data);
  },
  // 解除禁言 (向后兼容，如果原有接口支持)
  unmuteUser: (userId) => {
    return api.post(`/api/users/${userId}/unmute`);
  },
  // 封禁用户 (向后兼容，如果原有接口支持)
  banUser: (userId, data) => {
    return api.post(`/api/users/${userId}/ban`, data);
  },
  // 解除封禁 (向后兼容，如果原有接口支持)
  unbanUser: (userId) => {
    return api.post(`/api/users/${userId}/unban`);
  }
};

// 通知相关接口
export const notificationApi = {
  // 获取通知列表
  getNotificationList: (params) => {
    return api.get('/api/v1/notification/notifications', { params });
  },
  // 获取通知统计
  getNotificationsStats: () => {
    return api.get('/api/v1/notification/notifications/stats');
  },
  // 获取通知类型
  getNotificationTypes: () => {
    return api.get('/api/v1/notification/notifications/types');
  },
  // 获取单条通知详情
  getNotification: (notificationId) => {
    return api.get(`/api/v1/notification/notifications/${notificationId}`);
  },
  // 删除通知
  deleteNotification: (notificationId) => {
    return api.delete(`/api/v1/notification/notifications/${notificationId}`);
  }
};

// 系统设置接口
export const systemApi = {
  // 获取系统设置 (向后兼容，如果原有接口支持)
  getSystemSettings: () => {
    return api.get('/api/system/settings');
  },
  // 更新系统设置 (向后兼容，如果原有接口支持)
  updateSystemSettings: (data) => {
    return api.put('/api/system/settings', data);
  },
  // 备份数据 (向后兼容，如果原有接口支持)
  backupData: () => {
    return api.post('/api/system/backup');
  },
  // 恢复数据 (向后兼容，如果原有接口支持)
  restoreData: (formData) => {
    return api.post('/api/system/restore', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },
  // 获取备份历史 (向后兼容，如果原有接口支持)
  getBackupHistory: () => {
    return api.get('/api/system/backup/history');
  },
  // 下载备份文件 (向后兼容，如果原有接口支持)
  downloadBackup: (filename) => {
    return api.get(`/api/system/backup/download/${filename}`, {
      responseType: 'blob'
    });
  },
  // 删除备份文件 (向后兼容，如果原有接口支持)
  deleteBackup: (filename) => {
    return api.delete(`/api/system/backup/${filename}`);
  },
  // 获取系统状态
  getSystemStatus: () => {
    return api.get('/api/v1/system/monitoring/status');
  },
  // 获取数据库统计
  getDatabaseStats: () => {
    return api.get('/api/v1/system/monitoring/database-stats');
  },
  // 获取版本信息
  getVersionInfo: () => {
    return api.get('/api/v1/system/monitoring/version');
  },
  // 健康检查
  healthCheck: () => {
    return api.get('/api/v1/system/monitoring/health');
  },
  // 获取系统度量指标
  getMetrics: () => {
    return api.get('/api/v1/system/monitoring/metrics');
  }
};

// 抓取规则管理接口
export const captureRuleApi = {
  // 获取所有抓取规则（管理员）
  getAllCaptureRules: () => {
    return api.get('/api/v1/system/capture-rules/all');
  },
  // 获取启用的抓取规则（插件用）
  getCaptureRules: () => {
    return api.get('/api/v1/system/capture-rules');
  },
  // 创建抓取规则
  createCaptureRule: (data) => {
    return api.post('/api/v1/system/capture-rules', data);
  },
  // 更新抓取规则
  updateCaptureRule: (ruleName, data) => {
    return api.put(`/api/v1/system/capture-rules/${ruleName}`, data);
  },
  // 删除抓取规则
  deleteCaptureRule: (ruleName) => {
    return api.delete(`/api/v1/system/capture-rules/${ruleName}`);
  }
};

// 网络数据监控接口
export const networkDataApi = {
  // 获取网络请求数据
  getNetworkData: (params) => {
    return api.get('/api/v1/system/network-data', { params });
  },
  // 获取网络数据统计
  getNetworkDataStats: () => {
    return api.get('/api/v1/system/network-data/stats');
  },
  // 批量处理网络数据
  batchProcessNetworkData: (data) => {
    return api.post('/api/v1/system/network-data/batch-process', data);
  },
  // 接收网络数据（供插件使用）
  receiveNetworkData: (data) => {
    return api.post('/api/v1/system/network-data', data);
  }
};

// 用户备注接口 (向后兼容)
export const userNoteApi = {
  // 添加用户备注
  addUserNote: (data) => {
    return api.post('/api/user-notes', data);
  },
  // 获取用户备注
  getUserNotes: (userId) => {
    return api.get(`/api/user-notes?user_id=${userId}`);
  },
  // 批量获取用户备注
  getUserNotesBatch: (userIds) => {
    return api.get(`/api/user-notes/batch?user_ids=${userIds.join(',')}`);
  }
};

// 获取用户列表（小红书用户）- 向后兼容
export const getUserList = async (page = 1, pageSize = 10) => {
  const response = await api.get('/api/users/info/list', {
    params: {
      page: page,
      page_size: pageSize
    }
  });
  return response; // 直接返回拦截器处理后的完整响应
};

// API迁移信息
export const migrationApi = {
  // 获取API迁移信息
  getMigrationInfo: () => {
    return api.get('/api/migrate-info');
  }
};

export default {
  userApi,
  commentApi,
  noteApi,
  userManagementApi,
  notificationApi,
  systemApi,
  userNoteApi,
  ssoApi,
  captureRuleApi,
  networkDataApi,
  migrationApi
}; 