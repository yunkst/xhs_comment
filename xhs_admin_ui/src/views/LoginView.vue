<template>
  <div class="login-container">
    <el-card class="login-card">
      <div class="title">
        <h2>小红书评论维护系统</h2>
      </div>
      
      <!-- 登录/注册切换标签 -->
      <el-tabs v-model="activeTab" class="login-tabs" @tab-change="handleTabChange">
        <el-tab-pane label="登录" name="login">
      <el-form :model="loginForm" :rules="loginRules" ref="loginFormRef" label-width="0" class="login-form">
        <el-form-item prop="username">
          <el-input v-model="loginForm.username" prefix-icon="el-icon-user" placeholder="用户名">
            <template #prefix>
              <el-icon><User /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="loginForm.password" prefix-icon="el-icon-lock" type="password" placeholder="密码" @keyup.enter="handleLogin">
            <template #prefix>
              <el-icon><Lock /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item prop="otp_code">
          <el-input v-model="loginForm.otp_code" prefix-icon="el-icon-key" placeholder="动态验证码" @keyup.enter="handleLogin">
            <template #prefix>
              <el-icon><Key /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" class="login-button" @click="handleLogin">登录</el-button>
        </el-form-item>
        
        <div class="divider">
          <span>或</span>
        </div>
        
        <el-form-item>
          <el-button type="success" :loading="ssoLoading" class="login-button sso-button" @click="handleSsoLogin">
            <el-icon class="sso-icon"><Connection /></el-icon>
            单点登录 (SSO)
          </el-button>
        </el-form-item>
      </el-form>
        </el-tab-pane>
        
        <!-- 注册标签页 -->
        <el-tab-pane label="注册" name="register" v-if="allowRegister">
          <el-form :model="registerForm" :rules="registerRules" ref="registerFormRef" label-width="0" class="login-form">
            <el-form-item prop="username">
              <el-input v-model="registerForm.username" placeholder="用户名">
                <template #prefix>
                  <el-icon><User /></el-icon>
                </template>
              </el-input>
            </el-form-item>
            <el-form-item prop="password">
              <el-input v-model="registerForm.password" type="password" placeholder="密码">
                <template #prefix>
                  <el-icon><Lock /></el-icon>
                </template>
              </el-input>
            </el-form-item>
            <el-form-item prop="confirmPassword">
              <el-input v-model="registerForm.confirmPassword" type="password" placeholder="确认密码" @keyup.enter="handleRegister">
                <template #prefix>
                  <el-icon><Lock /></el-icon>
                </template>
              </el-input>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="registerLoading" class="login-button" @click="handleRegister">注册</el-button>
            </el-form-item>
            
            <div class="register-notice">
              <el-alert
                title="注册须知"
                type="info"
                :closable="false"
                description="注册成功后，系统将生成OTP二维码供您设置动态验证码，请妥善保管。"
                show-icon
              />
            </div>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- OTP设置对话框 -->
    <el-dialog v-model="qrcodeDialogVisible" title="OTP设置" width="350px">
      <div v-if="otpQrcode" class="qrcode-container">
        <p>请使用Google Authenticator或其他OTP应用扫描下方二维码</p>
        <img :src="otpQrcode" alt="OTP二维码" />
        <div style="margin-top: 15px;">
          <el-alert
            title="设置完成后请返回登录页面使用您的账号和动态验证码登录"
            type="success"
            :closable="false"
            show-icon
          />
        </div>
      </div>
      <div v-else class="qrcode-container">
        <el-alert type="info" :closable="false">正在加载OTP二维码...</el-alert>
      </div>
      <template #footer>
        <el-button @click="qrcodeDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="handleQrcodeComplete">设置完成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { User, Lock, Key, Connection } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { userApi, ssoApi } from '../services/api'

const router = useRouter()
const loginFormRef = ref(null)
const registerFormRef = ref(null)
const loading = ref(false)
const registerLoading = ref(false)
const ssoLoading = ref(false)
const qrcodeDialogVisible = ref(false)
const otpQrcode = ref('')
const activeTab = ref('login')
const allowRegister = ref(true)

const loginForm = reactive({
  username: '',
  password: '',
  otp_code: ''
})

const registerForm = reactive({
  username: '',
  password: '',
  confirmPassword: ''
})

const loginRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  otp_code: [{ required: true, message: '请输入动态验证码', trigger: 'blur' }]
}

const registerRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度在 3 到 20 个字符', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 50, message: '密码长度在 6 到 50 个字符', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value === '') {
          callback(new Error('请再次输入密码'))
        } else if (value !== registerForm.password) {
          callback(new Error('两次输入密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

// 辅助函数: 从当前URL获取参数，支持不同路由模式
const getUrlParams = () => {
  const result = {}
  
  // 尝试从常规search参数获取
  const searchParams = new URLSearchParams(window.location.search)
  for (const [key, value] of searchParams.entries()) {
    result[key] = value
  }
  
  // 尝试从hash部分获取
  try {
    // 检查是否有?标记查询参数
    const hashParts = window.location.hash.split('?')
    if (hashParts.length > 1) {
      // 提取查询参数部分
      const hashSearchPart = hashParts[1]
      const hashParams = new URLSearchParams(hashSearchPart)
      for (const [key, value] of hashParams.entries()) {
        // 如果常规search没有此参数，才从hash中添加
        if (!result[key]) {
          result[key] = value
        }
      }
    }
  } catch (e) {
    console.error('[SSO调试] 解析hash参数错误:', e)
  }
  
  // 检查vue-router params中是否有sso_callback参数
  try {
    const routeQuery = router.currentRoute.value.query
    if (routeQuery && routeQuery.sso_callback && !result.sso_callback) {
      result.sso_callback = routeQuery.sso_callback
      console.log('[SSO调试] 从路由query中获取到sso_callback:', routeQuery.sso_callback)
    }
  } catch (e) {
    console.error('[SSO调试] 获取路由参数错误:', e)
  }
  
  console.log('[SSO调试] 合并后的URL参数:', result)
  return result
}

// 处理SSO登录
const handleSsoLogin = async () => {
  ssoLoading.value = true;
  ElMessage.info('SSO 功能已更新。请通过插件发起登录。');
  // try {
  //   // 获取SSO登录URL
  //   const response = await ssoApi.getSsoLoginUrl() // 这个后端接口可能在新流程中已移除或改变
  //   // 重定向到SSO登录页面
  //   window.location.href = response.auth_url
  // } catch (error) {
  //   console.error('获取SSO登录URL失败:', error)
  //   if (error.response && error.response.data && error.response.data.detail) {
  //     ElMessage.error(`SSO登录失败: ${error.response.data.detail}`)
  //   } else {
  //     ElMessage.error('SSO登录失败，请稍后再试')
  //   }
  // }
  ssoLoading.value = false;
}

const handleLogin = async () => {
  if (!loginFormRef.value) return
  
  await loginFormRef.value.validate(async (valid) => {
    if (!valid) return
    
    loading.value = true
    
    try {
      console.log('[SSO重构] LoginView - 尝试登录:', loginForm.username)
      // 调用登录接口
      const response = await userApi.login({
        username: loginForm.username,
        password: loginForm.password,
        otp_code: loginForm.otp_code
      })
      
      // 存储令牌
      localStorage.setItem('token', response.access_token)
      if (response.refresh_token) {
        localStorage.setItem('refresh_token', response.refresh_token)
      }
      
      console.log('[SSO重构] LoginView - 登录成功')
      loading.value = false
      ElMessage.success('登录成功')
      
      // 检查是否有登录后重定向地址
      const redirectTarget = sessionStorage.getItem('redirect_after_login')
      console.log('[SSO重构] LoginView - 检查存储的 redirect_after_login:', redirectTarget || '无')
      
      if (redirectTarget) {
        sessionStorage.removeItem('redirect_after_login')
        console.log('[SSO重构] LoginView - 登录成功，重定向到:', redirectTarget)
        // 使用 router.push 进行SPA内部跳转，如果 redirectTarget 是外部URL，则需要 window.location.href
        // 假设 redirectTarget 总是应用内的路径，如 /sso-initiate?session_id=xxx
        router.push(redirectTarget)
      } else {
        // 常规登录，跳转到首页
        console.log('[SSO重构] LoginView - 常规登录，跳转到首页')
        router.push('/')
      }
    } catch (error) {
      loading.value = false
      console.error('[SSO重构] LoginView - 登录失败:', error)
      
      if (error.response && error.response.data && error.response.data.detail) {
        ElMessage.error(`登录失败: ${error.response.data.detail}`)
      } else {
        ElMessage.error('登录失败，请检查用户名、密码和验证码')
      }
    }
  })
}

const loadOtpQrcode = async () => {
  if (!loginForm.username) {
    ElMessage.warning('请先输入用户名')
    return
  }
  
  try {
    otpQrcode.value = ''
    const response = await userApi.getOtpQrcode(loginForm.username)
    otpQrcode.value = response.qrcode_url
  } catch (error) {
    console.error('获取OTP二维码失败:', error)
    ElMessage.error('获取OTP二维码失败')
  }
}

const handleRegister = async () => {
  if (!registerFormRef.value) return
  
  await registerFormRef.value.validate(async (valid) => {
    if (!valid) return
    
    registerLoading.value = true
    
    try {
      // 调用注册接口
      const response = await userApi.register({
        username: registerForm.username,
        password: registerForm.password
      })
      
      ElMessage.success('注册成功！请设置OTP动态验证码')
      
      // 注册成功后，显示OTP二维码
      otpQrcode.value = ''
      await loadOtpQrcodeForUser(registerForm.username)
      qrcodeDialogVisible.value = true
      
    } catch (error) {
      console.error('注册失败:', error)
      
      if (error.response && error.response.status === 400) {
        ElMessage.error('用户名已存在，请更换用户名')
      } else if (error.response && error.response.status === 403) {
        ElMessage.error('注册功能已关闭')
      } else {
        ElMessage.error('注册失败，请稍后再试')
      }
    } finally {
      registerLoading.value = false
    }
  })
}

const handleTabChange = () => {
  // 清空表单错误信息
  if (activeTab.value === 'login' && loginFormRef.value) {
    loginFormRef.value.clearValidate()
  } else if (activeTab.value === 'register' && registerFormRef.value) {
    registerFormRef.value.clearValidate()
  }
}

const handleQrcodeComplete = () => {
  qrcodeDialogVisible.value = false
  // 切换到登录标签页
  activeTab.value = 'login'
  // 将注册的用户名复制到登录表单
  loginForm.username = registerForm.username
  // 清空注册表单
  registerForm.username = ''
  registerForm.password = ''
  registerForm.confirmPassword = ''
  ElMessage.info('请使用您的账号和动态验证码登录')
}

// 加载指定用户的OTP二维码
const loadOtpQrcodeForUser = async (username) => {
  try {
    const response = await userApi.getOtpQrcode(username)
    otpQrcode.value = response.qrcode_url
  } catch (error) {
    console.error('获取OTP二维码失败:', error)
    ElMessage.error('获取OTP二维码失败')
  }
}

// 检查注册状态
const checkRegisterStatus = async () => {
  try {
    const response = await userApi.checkRegisterStatus()
    allowRegister.value = response.allow_register || false
  } catch (error) {
    console.warn('检查注册状态失败，默认关闭注册功能:', error)
    allowRegister.value = false
  }
}

// 页面加载时检查SSO回调参数和注册状态
onMounted(() => {
  console.log('[SSO重构] LoginView - 组件挂载')
  
  // 检查是否有 redirect_after_login 参数
  const route = router.currentRoute.value // 或者 useRoute()
  const redirectAfterLogin = route.query.redirect_after_login
  
  if (redirectAfterLogin) {
    console.log('[SSO重构] LoginView - 检测到 redirect_after_login 参数:', redirectAfterLogin)
    sessionStorage.setItem('redirect_after_login', redirectAfterLogin)
    // 清理URL中的参数，避免用户刷新时重复处理或显示不必要的参数
    const newQuery = { ...route.query };
    delete newQuery.redirect_after_login;
    router.replace({ query: newQuery }); 
  }
  
  // 检查注册功能是否开启
  userApi.checkRegisterStatus()
    .then(response => {
      allowRegister.value = response.allow_register || false
      console.log('[SSO重构] LoginView - 注册功能状态:', allowRegister.value)
    })
    .catch(error => {
      console.error('[SSO重构] LoginView - 获取注册状态失败:', error)
      allowRegister.value = false
    })
})
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  width: 100vw;
  background-color: #f5f7f9;
  overflow: hidden;
}

.login-card {
  width: 400px;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.title {
  text-align: center;
  margin-bottom: 30px;
  color: #409EFF;
}

.login-form {
  padding: 0 20px;
}

.login-button {
  width: 100%;
}

.divider {
  display: flex;
  align-items: center;
  text-align: center;
  margin: 15px 0;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid #dcdfe6;
}

.divider span {
  padding: 0 10px;
  color: #909399;
  font-size: 14px;
}

.sso-button {
  display: flex;
  justify-content: center;
  align-items: center;
}

.sso-icon {
  margin-right: 5px;
}

.qrcode-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.qrcode-container img {
  margin-top: 15px;
  max-width: 200px;
}

.login-tabs {
  margin-bottom: 20px;
}

.login-tabs .el-tabs__header {
  margin: 0 0 15px 0;
}

.register-notice {
  margin-top: 15px;
}

.register-notice .el-alert {
  margin-bottom: 0;
}
</style> 