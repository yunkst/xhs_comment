import { createRouter, createWebHashHistory } from 'vue-router'
import { ElMessage } from 'element-plus'
import { setRouter } from '../utils/auth'
import LoginView from '../views/LoginView.vue'
import LayoutView from '../views/LayoutView.vue'
import DashboardView from '../views/DashboardView.vue'
import SsoInitiateView from '../views/SsoInitiateView.vue'

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
      path: '/sso-initiate',
      name: 'ssoInitiate',
      component: SsoInitiateView,
      meta: { title: 'SSO授权处理', noAuth: true }
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
          path: 'xiaohongshu/users',
          name: 'xhsUserList',
          component: () => import('../views/content/XhsUserListView.vue'),
          meta: { title: '小红书用户' }
        },
        {
          path: 'content/notes',
          name: 'ContentNotes',
          component: () => import('@/views/content/NotesView.vue'),
          meta: { title: '小红书笔记', icon: 'Document' }
        },
        {
          path: 'content/notifications',
          name: 'ContentNotifications',
          component: () => import('@/views/content/NotificationView.vue'),
          meta: { title: '小红书通知', icon: 'Bell' }
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

// 设置路由实例引用，供认证工具使用
setRouter(router);

// 路由守卫
router.beforeEach((to, from, next) => {
  // 设置页面标题
  document.title = to.meta.title ? `${to.meta.title} - 小红书评论维护系统` : '小红书评论维护系统'
  
  console.log('[SSO重构] 路由守卫触发:', {
    从: from.fullPath,
    到: to.fullPath,
    完整目标URL: to.fullPath,
  })

  // 获取token
  const token = localStorage.getItem('token')

  // 如果目标路由需要认证
  if (!to.meta.noAuth) {
    if (token) {
      // 用户已登录，允许访问
      console.log('[SSO重构] 用户已登录，允许访问受保护路由:', to.path)
      next()
    } else {
      // 用户未登录，重定向到登录页
      console.log('[SSO重构] 用户未登录，目标受保护路由:', to.path, '. 重定向到登录页.')
      ElMessage.warning('请先登录以访问此页面')
      // 将完整的原始目标路径作为回调参数，以便登录后能正确跳转
      next({ path: '/login', query: { redirect_after_login: to.fullPath } })
    }
  } else {
    // 目标路由不需要认证 (例如 /login, /sso-initiate, /404)
    console.log('[SSO重构] 访问无需认证的路由:', to.path)
    next()
  }
})

export default router
