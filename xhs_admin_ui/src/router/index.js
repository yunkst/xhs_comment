import { createRouter, createWebHistory } from 'vue-router'
import { ElMessage } from 'element-plus'
import LoginView from '../views/LoginView.vue'
import LayoutView from '../views/LayoutView.vue'
import DashboardView from '../views/DashboardView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
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

  // 验证是否需要登录权限
  if (to.meta.noAuth) {
    next()
  } else {
    const token = localStorage.getItem('token')
    if (!token) {
      ElMessage.warning('请先登录')
      next('/login')
    } else {
      next()
    }
  }
})

export default router
