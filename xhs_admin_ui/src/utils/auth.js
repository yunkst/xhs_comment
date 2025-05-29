/**
 * 认证相关工具函数
 */

// 存储Vue Router实例的引用
let routerInstance = null;

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
      console.log('使用Vue Router跳转到登录页');
      routerInstance.push('/login');
      return;
    }
  } catch (error) {
    console.warn('Vue Router跳转失败，使用传统方式:', error);
  }
  
  // 回退方案：使用window.location跳转
  const basePath = import.meta.env.BASE_URL || '/web/';
  const loginUrl = `${basePath}#/login`;
  console.log(`使用window.location跳转到登录页: ${loginUrl}`);
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
}; 