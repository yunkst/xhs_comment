import axios from 'axios';

// 创建axios实例
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

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
  error => {
    if (error.response && error.response.status === 401) {
      // 未授权，清除token并重定向到登录页
      localStorage.removeItem('token');
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

export default {
  userApi,
  commentApi,
  userManagementApi,
  systemApi,
  userNoteApi
}; 