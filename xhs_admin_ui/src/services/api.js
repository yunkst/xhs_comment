import axios from 'axios';
import { navigateToLogin } from '../utils/auth';
import { ElMessage } from 'element-plus';

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
// 是否已经显示过登录过期提示
let hasShownTokenExpiredMessage = false;

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
      console.log('[Auth] 没有refresh_token，无法刷新');
      return null;
    }
    
    console.log('[Auth] 尝试刷新token...');
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
    
    console.log('[Auth] Token刷新成功');
    // 重置过期提示标记
    hasShownTokenExpiredMessage = false;
    
    return data.access_token;
  } catch (error) {
    console.error('[Auth] 刷新令牌失败:', error);
    // 刷新失败，清除所有令牌
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('id_token');
    return null;
  }
};

// 处理认证失败
const handleAuthFailure = () => {
  console.log('[Auth] 处理认证失败，清除token并跳转登录页');
  
  // 清除所有token
  localStorage.removeItem('token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('id_token');
  
  // 只显示一次过期提示
  if (!hasShownTokenExpiredMessage) {
    hasShownTokenExpiredMessage = true;
    ElMessage.warning('登录已过期，请重新登录');
  }
  
  // 跳转到登录页
  navigateToLogin();
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
    
    console.log('[Auth] API请求失败:', {
      url: originalRequest?.url,
      status: error.response?.status,
      message: error.message
    });
    
    // 如果状态码是401(未授权)
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      console.log('[Auth] 收到401未授权响应，尝试刷新token');
      
      // 如果refresh_token存在且尚未开始刷新
      if (localStorage.getItem('refresh_token') && !isRefreshing) {
        originalRequest._retry = true;
        isRefreshing = true;
        
        try {
          const newToken = await refreshToken();
          isRefreshing = false;
          
          if (newToken) {
            console.log('[Auth] Token刷新成功，重试原始请求');
            // 通知所有请求继续执行
            onRefreshed(newToken);
            // 重试当前请求
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
            return api(originalRequest);
          } else {
            console.log('[Auth] Token刷新失败，跳转登录页');
            handleAuthFailure();
          }
        } catch (refreshError) {
          console.error('[Auth] Token刷新过程中出错:', refreshError);
          isRefreshing = false;
          handleAuthFailure();
        }
      }
      
      // 如果已经在刷新，则将请求加入队列
      if (isRefreshing) {
        console.log('[Auth] 正在刷新token，将请求加入队列');
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh(token => {
            if (token) {
              originalRequest.headers['Authorization'] = `Bearer ${token}`;
              resolve(api(originalRequest));
            } else {
              reject(new Error('Token刷新失败'));
            }
          });
        });
      }
      
      // Token刷新失败或没有refresh_token，跳转到登录页
      console.log('[Auth] 无法刷新token，跳转登录页');
      handleAuthFailure();
    }
    
    return Promise.reject(error);
  }
);

// ========================
// API接口定义
// ========================

// 用户认证接口
export const userApi = {
  login: (data) => {
    return api.post('/api/v1/user/auth/login', data);
  },
  register: (data) => {
    return api.post('/api/v1/user/auth/register', data);
  },
  getOtpQrcode: (username) => {
    return api.get(`/api/v1/user/auth/otp-qrcode?username=${username}`);
  },
  checkRegisterStatus: () => {
    return api.get('/api/v1/user/auth/register-status');
  },
  checkOtpStatus: () => {
    return api.get('/api/v1/user/auth/otp-status');
  },
  checkLoginStatus: () => {
    return api.get('/api/v1/user/auth/check-login-status');
  },
  getCurrentUser: () => {
    return api.get('/api/v1/user/auth/me');
  }
};

// SSO相关接口
export const ssoApi = {
  getSsoLoginUrl: () => {
    return api.get('/api/v1/user/auth/sso-login-url');
  },
  refreshSsoToken: (refreshToken) => {
    return api.post('/api/v1/user/auth/sso-refresh', { refresh_token: refreshToken });
  },
  getSsoUserInfo: () => {
    return api.get('/api/v1/user/auth/sso-userinfo');
  },
  createSsoSession: (clientType) => {
    return api.post('/api/v1/user/auth/sso-session', { client_type: clientType });
  },
  getSsoSessionStatus: (sessionId) => {
    return api.get(`/api/v1/user/auth/sso-session/${sessionId}`);
  },
  approveSsoSession: (sessionId) => {
    return api.post('/api/v1/user/auth/sso-approve-session', { session_id: sessionId });
  }
};

// 评论管理接口
export const commentApi = {
  getCommentList: (params) => {
    return api.get('/api/v1/content/comments', { params });
  },
  getCommentsStats: () => {
    return api.get('/api/v1/content/comments/stats');
  },
  getUserComments: (userId) => {
    return api.get(`/api/v1/content/comments/user/${userId}`);
  },
  deleteComment: (commentId) => {
    return api.delete(`/api/v1/content/comments/${commentId}`);
  },
  batchDelete: (ids) => {
    return api.post('/api/v1/content/comments/batch/delete', { ids });
  }
};

// 笔记管理接口
export const noteApi = {
  getNoteList: (params) => {
    return api.get('/api/v1/content/notes', { params });
  },
  getNotesStats: () => {
    return api.get('/api/v1/content/notes/stats');
  }
};

// 通知管理接口
export const notificationApi = {
  getNotificationList: (params) => {
    return api.get('/api/v1/notification/notifications', { params });
  },
  getNotificationsStats: () => {
    return api.get('/api/v1/notification/notifications/stats');
  },
  getNotificationTypes: () => {
    return api.get('/api/v1/notification/notifications/types');
  }
};

// 小红书用户管理接口
export const xhsUserApi = {
  getXhsUserList: (params) => {
    return api.get('/api/v1/user/profile/xhs/list', { params });
  }
};

// 用户备注接口
export const userNoteApi = {
  addUserNote: (data) => {
    return api.post('/api/v1/user/notes', data);
  },
  getUserNotesBatch: (userIds) => {
    // 使用POST请求避免URL过长问题
    return api.post('/api/v1/user/notes/batch', { user_ids: userIds });
  },
  getUserNotesBatchGet: (userIds) => {
    // 保留GET方法作为向后兼容，适用于少量用户ID的场景
    return api.get(`/api/v1/user/notes/batch?user_ids=${userIds.join(',')}`);
  }
};

export default {
  ...userApi,
  ...ssoApi,
  ...commentApi,
  ...noteApi,
  ...notificationApi,
  ...xhsUserApi,
  ...userNoteApi
}; 