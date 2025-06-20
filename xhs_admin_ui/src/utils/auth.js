/**
 * 认证相关工具函数
 */

// 存储Vue Router实例的引用
let routerInstance = null;
// 定期检查token的定时器
let tokenCheckInterval = null;

/**
 * 设置路由实例
 * @param {Router} router Vue Router实例
 */
export const setRouter = (router) => {
  routerInstance = router;
};

/**
 * 清除所有认证相关的token
 */
export const clearAuthTokens = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('id_token');
  
  // 停止定期检查
  if (tokenCheckInterval) {
    clearInterval(tokenCheckInterval);
    tokenCheckInterval = null;
  }
};

/**
 * 跳转到登录页面
 * 优先使用Vue Router，如果不可用则使用window.location
 */
export const navigateToLogin = () => {
  // 清除token
  clearAuthTokens();
  
  // 检查是否在浏览器环境中
  if (typeof window === 'undefined') {
    return;
  }
  
  // 检查是否已经在登录页
  if (window.location.hash.includes('#/login') || window.location.pathname.includes('/login')) {
    return;
  }
  
  try {
    // 优先使用Vue Router进行跳转
    if (routerInstance) {
      console.log('[Auth] 使用Vue Router跳转到登录页');
      routerInstance.push('/login');
      return;
    }
  } catch (error) {
    console.warn('[Auth] Vue Router跳转失败，使用传统方式:', error);
  }
  
  // 回退方案：使用window.location跳转
  const basePath = import.meta.env.BASE_URL || '/web/';
  const loginUrl = `${basePath}#/login`;
  console.log(`[Auth] 使用window.location跳转到登录页: ${loginUrl}`);
  window.location.href = loginUrl;
};

/**
 * 检查用户是否已登录
 * @returns {boolean}
 */
export const isAuthenticated = () => {
  return !!localStorage.getItem('token');
};

/**
 * 获取当前用户token
 * @returns {string|null}
 */
export const getAuthToken = () => {
  return localStorage.getItem('token');
};

/**
 * 设置认证token
 * @param {string} token 访问令牌
 * @param {string} refreshToken 刷新令牌
 * @param {string} idToken ID令牌
 */
export const setAuthTokens = (token, refreshToken = null, idToken = null) => {
  if (token) {
    localStorage.setItem('token', token);
  }
  if (refreshToken) {
    localStorage.setItem('refresh_token', refreshToken);
  }
  if (idToken) {
    localStorage.setItem('id_token', idToken);
  }
  
  // 设置token后，启动定期检查
  startTokenCheck();
};

/**
 * 验证token是否有效
 * @returns {Promise<boolean>}
 */
export const validateToken = async () => {
  const token = getAuthToken();
  if (!token) {
    console.log('[Auth] 没有token，用户未登录');
    return false;
  }
  
  try {
    // 动态导入userApi以避免循环依赖
    const { userApi } = await import('../services/api.js');
    
    console.log('[Auth] 验证token有效性...');
    const response = await userApi.checkLoginStatus();
    
    if (response && response.status === '已登录') {
      console.log('[Auth] Token有效，用户已登录');
      return true;
    } else {
      console.log('[Auth] Token无效或已过期');
      clearAuthTokens();
      return false;
    }
  } catch (error) {
    console.error('[Auth] Token验证失败:', error);
    
    // 如果是401错误，说明token确实过期了
    if (error.response && error.response.status === 401) {
      console.log('[Auth] Token已过期，清除本地token');
      clearAuthTokens();
    }
    
    return false;
  }
};

/**
 * 启动定期token检查
 * 每5分钟检查一次token状态
 */
export const startTokenCheck = () => {
  // 如果已经有定时器在运行，先清除
  if (tokenCheckInterval) {
    clearInterval(tokenCheckInterval);
  }
  
  // 只有在有token的情况下才启动检查
  if (!getAuthToken()) {
    return;
  }
  
  console.log('[Auth] 启动定期token检查（每5分钟一次）');
  
  tokenCheckInterval = setInterval(async () => {
    const token = getAuthToken();
    if (!token) {
      console.log('[Auth] 没有token，停止定期检查');
      clearInterval(tokenCheckInterval);
      tokenCheckInterval = null;
      return;
    }
    
    try {
      console.log('[Auth] 定期检查token状态...');
      const isValid = await validateToken();
      
      if (!isValid) {
        console.log('[Auth] 定期检查发现token无效，停止检查');
        clearInterval(tokenCheckInterval);
        tokenCheckInterval = null;
      }
    } catch (error) {
      console.error('[Auth] 定期token检查失败:', error);
    }
  }, 5 * 60 * 1000); // 5分钟
};

/**
 * 停止定期token检查
 */
export const stopTokenCheck = () => {
  if (tokenCheckInterval) {
    console.log('[Auth] 停止定期token检查');
    clearInterval(tokenCheckInterval);
    tokenCheckInterval = null;
  }
};

/**
 * 初始化认证状态检查
 * 在应用启动时调用，验证本地存储的token是否仍然有效
 */
export const initializeAuth = async () => {
  console.log('[Auth] 初始化认证状态检查...');
  
  const token = getAuthToken();
  if (!token) {
    console.log('[Auth] 没有本地token，跳过验证');
    return false;
  }
  
  const isValid = await validateToken();
  if (!isValid) {
    console.log('[Auth] 本地token无效，已清除');
  } else {
    // 如果token有效，启动定期检查
    startTokenCheck();
  }
  
  return isValid;
}; 