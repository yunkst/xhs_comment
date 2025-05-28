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
      `${import.meta.env.VITE_API_BASE_URL || ''}/api/auth/sso-refresh`,
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
    return api.get('/api/auth/sso-login-url');
  },
  // 刷新SSO Token
  refreshSsoToken: (refreshToken) => {
    return api.post('/api/auth/sso-refresh', { refresh_token: refreshToken });
  },
  // 获取SSO用户信息
  getSsoUserInfo: () => {
    return api.get('/api/auth/sso-userinfo');
  }
};

// 评论相关接口
export const commentApi = {
  // 获取评论列表
  getCommentList: (params) => {
    return api.get('/api/comments', { params });
  },
  // 获取特定用户的评论
  getUserComments: (userId) => {
    return api.get(`/api/comments/user/${userId}`);
  },
  // 更新评论状态
  updateCommentStatus: (commentId, status) => {
    return api.put(`/api/comments/${commentId}/status`, { status });
  },
  // 删除评论
  deleteComment: (commentId) => {
    return api.delete(`/api/comments/${commentId}`);
  },
  // 批量更新评论状态
  batchUpdateStatus: (ids, status) => {
    return api.put('/api/comments/batch/status', { ids, status });
  },
  // 批量删除评论
  batchDelete: (ids) => {
    return api.post('/api/comments/batch/delete', { ids });
  }
};

// 用户管理接口
export const userManagementApi = {
  // 获取用户列表
  getUserList: (params) => {
    return api.get('/api/users', { params });
  },
  // 获取用户详情
  getUserDetail: (userId) => {
    return api.get(`/api/users/${userId}`);
  },
  // 禁言用户
  muteUser: (userId, data) => {
    return api.post(`/api/users/${userId}/mute`, data);
  },
  // 解除禁言
  unmuteUser: (userId) => {
    return api.post(`/api/users/${userId}/unmute`);
  },
  // 封禁用户
  banUser: (userId, data) => {
    return api.post(`/api/users/${userId}/ban`, data);
  },
  // 解除封禁
  unbanUser: (userId) => {
    return api.post(`/api/users/${userId}/unban`);
  }
};

// 系统设置接口
export const systemApi = {
  // 获取系统设置
  getSystemSettings: () => {
    return api.get('/api/system/settings');
  },
  // 更新系统设置
  updateSystemSettings: (data) => {
    return api.put('/api/system/settings', data);
  },
  // 备份数据
  backupData: () => {
    return api.post('/api/system/backup');
  },
  // 恢复数据
  restoreData: (formData) => {
    return api.post('/api/system/restore', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },
  // 获取备份历史
  getBackupHistory: () => {
    return api.get('/api/system/backup/history');
  },
  // 下载备份文件
  downloadBackup: (filename) => {
    return api.get(`/api/system/backup/download/${filename}`, {
      responseType: 'blob'
    });
  },
  // 删除备份文件
  deleteBackup: (filename) => {
    return api.delete(`/api/system/backup/${filename}`);
  },
  // 获取系统状态
  getSystemStatus: () => {
    return api.get('/api/system/status');
  },
  // 获取数据库统计
  getDatabaseStats: () => {
    return api.get('/api/system/database-stats');
  },
  // 获取版本信息
  getVersionInfo: () => {
    return api.get('/api/system/version');
  },
  // 健康检查
  healthCheck: () => {
    return api.get('/api/system/health');
  }
};

// 抓取规则管理接口
export const captureRuleApi = {
  // 获取所有抓取规则（管理员）
  getAllCaptureRules: () => {
    return api.get('/api/system/capture-rules/all');
  },
  // 获取启用的抓取规则（插件用）
  getCaptureRules: () => {
    return api.get('/api/system/capture-rules');
  },
  // 创建抓取规则
  createCaptureRule: (data) => {
    return api.post('/api/system/capture-rules', data);
  },
  // 更新抓取规则
  updateCaptureRule: (ruleName, data) => {
    return api.put(`/api/system/capture-rules/${ruleName}`, data);
  },
  // 删除抓取规则
  deleteCaptureRule: (ruleName) => {
    return api.delete(`/api/system/capture-rules/${ruleName}`);
  }
};

// 用户备注接口
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

// 获取用户列表（小红书用户）
export const getUserList = async (page = 1, pageSize = 10) => {
  const response = await api.get('/api/users/info/list', {
    params: {
      page: page,
      page_size: pageSize
    }
  });
  return response; // 直接返回拦截器处理后的完整响应
};

// 网络数据监控接口
export const networkDataApi = {
  // 获取网络请求数据
  getNetworkData: (params) => {
    return api.get('/api/network-data', { params });
  },
  // 接收网络数据
  receiveNetworkData: (data) => {
    return api.post('/api/system/network-data', data);
  }
};

export default {
  userApi,
  commentApi,
  userManagementApi,
  systemApi,
  userNoteApi,
  ssoApi,
  captureRuleApi,
  networkDataApi
}; 