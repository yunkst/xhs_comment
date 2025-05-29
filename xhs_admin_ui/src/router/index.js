import { createRouter, createWebHashHistory } from 'vue-router'
import { ElMessage } from 'element-plus'
import LoginView from '../views/LoginView.vue'
import LayoutView from '../views/LayoutView.vue'
import DashboardView from '../views/DashboardView.vue'

// 从URL查询参数中提取并存储token
const processTokenFromUrl = () => {
  const urlParams = new URLSearchParams(window.location.search)
  const accessToken = urlParams.get('access_token')
  const refreshToken = urlParams.get('refresh_token')
  const idToken = urlParams.get('id_token')
  
  if (accessToken) {
    // 保存token到localStorage
    console.log('保存token')
    localStorage.setItem('token', accessToken)
    if (refreshToken) localStorage.setItem('refresh_token', refreshToken)
    if (idToken) localStorage.setItem('id_token', idToken)
    
    // 清除URL参数，避免token暴露在地址栏
    window.history.replaceState({}, document.title, window.location.pathname)
    return true
  }
  return false
}

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { title: '登录', noAuth: true }
    },
    {
      path: '/',
      component: LayoutView,
      redirect: '/dashboard',
      children: [
        {
          path: 'dashboard',
          name: 'dashboard',
          component: DashboardView,
          meta: { title: '首页' }
        },
        {
          path: 'comment/list',
          name: 'commentList',
          component: () => import('../views/comment/CommentListView.vue'),
          meta: { title: '评论列表' }
        },
        {
          path: 'user/list',
          name: 'userList',
          component: () => import('../views/user/UserListView.vue'),
          meta: { title: '用户列表' }
        },
        {
          path: 'system',
          name: 'system',
          component: () => import('../views/system/SystemView.vue'),
          meta: { title: '系统设置' }
        },
        {
          path: 'system/capture-rules',
          name: 'captureRules',
          component: () => import('../views/system/CaptureRuleView.vue'),
          meta: { title: '抓取规则管理' }
        },
        {
          path: 'system/network-data',
          name: 'networkData',
          component: () => import('../views/system/NetworkDataView.vue'),
          meta: { title: '网络数据监控' }
        }
      ]
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/404'
    },
    {
      path: '/404',
      name: '404',
      component: () => import('../views/404.vue'),
      meta: { title: '404', noAuth: true }
    }
  ]
})

// 路由守卫
router.beforeEach((to, from, next) => {
  // 设置页面标题
  document.title = to.meta.title ? `${to.meta.title} - 小红书评论维护系统` : '小红书评论维护系统'

  // 处理URL中的token参数（SSO登录后的重定向）
  const hasProcessedToken = processTokenFromUrl()
  if (hasProcessedToken) {
    // 如果处理了token，重定向到主页
    next({ path: '/', replace: true })
    return
  }

  // 验证是否需要登录权限
  if (to.meta.noAuth) {
    next()
  } else {
    const token = localStorage.getItem('token')
    console.log('有token')
    if (!token) {
      ElMessage.warning('请先登录')
      next('/login')
    } else {
      next()
    }
  }
})

export default router
