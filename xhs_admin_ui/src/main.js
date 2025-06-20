import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'

import App from './App.vue'
import router from './router'
import { setRouter, initializeAuth } from './utils/auth'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(ElementPlus, {
  locale: zhCn,
  size: 'default'
})

// 设置路由器实例到auth工具中，用于token过期时的跳转
setRouter(router)

// 应用启动后初始化认证状态
router.isReady().then(async () => {
  console.log('[App] 路由器就绪，开始初始化认证状态')
  
  try {
    await initializeAuth()
    console.log('[App] 认证状态初始化完成')
  } catch (error) {
    console.error('[App] 认证状态初始化失败:', error)
  }
  
  app.mount('#app')
})
