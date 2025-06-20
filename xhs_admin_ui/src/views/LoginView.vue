<template>
  <div class="login-container">
    <div class="login-box">
      <div class="login-header">
        <h1>小红书评论维护系统</h1>
        <p>请登录以继续使用</p>
      </div>
      
      <el-tabs v-model="activeTab" @tab-change="handleTabChange" class="login-tabs">
        <!-- 登录标签页 -->
        <el-tab-pane label="登录" name="login">
          <el-form 
            ref="loginFormRef" 
            :model="loginForm" 
            :rules="loginRules" 
            label-width="80px"
            class="login-form"
          >
            <el-form-item label="用户名" prop="username">
              <el-input 
                v-model="loginForm.username" 
                placeholder="请输入用户名"
                @keyup.enter="handleLogin"
              />
            </el-form-item>
            
            <el-form-item label="密码" prop="password">
              <el-input 
                v-model="loginForm.password" 
                type="password" 
                placeholder="请输入密码"
                show-password
                @keyup.enter="handleLogin"
              />
            </el-form-item>
            
            <el-form-item 
              v-if="otpEnabled" 
              label="验证码" 
              prop="otp_code"
            >
              <div class="otp-input-group">
                <el-input 
                  v-model="loginForm.otp_code" 
                  placeholder="请输入6位动态验证码"
                  maxlength="6"
                  @keyup.enter="handleLogin"
                />
                <el-button 
                  type="text" 
                  @click="loadOtpQrcode"
                  class="qrcode-btn"
                >
                  获取二维码
                </el-button>
              </div>
            </el-form-item>
            
            <el-form-item>
              <el-button 
                type="primary" 
                :loading="loading" 
                @click="handleLogin"
                class="login-btn"
              >
                {{ loading ? '登录中...' : '登录' }}
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
        
        <!-- 注册标签页 -->
        <el-tab-pane v-if="allowRegister" label="注册" name="register">
          <el-form 
            ref="registerFormRef" 
            :model="registerForm" 
            :rules="registerRules" 
            label-width="80px"
            class="register-form"
          >
            <el-form-item label="用户名" prop="username">
              <el-input 
                v-model="registerForm.username" 
                placeholder="请输入用户名"
                @keyup.enter="handleRegister"
              />
            </el-form-item>
            
            <el-form-item label="密码" prop="password">
              <el-input 
                v-model="registerForm.password" 
                type="password" 
                placeholder="请输入密码"
                show-password
                @keyup.enter="handleRegister"
              />
            </el-form-item>
            
            <el-form-item label="确认密码" prop="confirmPassword">
              <el-input 
                v-model="registerForm.confirmPassword" 
                type="password" 
                placeholder="请再次输入密码"
                show-password
                @keyup.enter="handleRegister"
              />
            </el-form-item>
            
            <el-form-item>
              <el-button 
                type="primary" 
                :loading="registerLoading" 
                @click="handleRegister"
                class="register-btn"
              >
                {{ registerLoading ? '注册中...' : '注册' }}
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
      
      <!-- OTP二维码显示 -->
      <div v-if="otpQrcode" class="qrcode-display">
        <h3>动态验证码设置</h3>
        <div class="qrcode-container">
          <img :src="otpQrcode" alt="OTP QR Code" />
        </div>
        <p class="qrcode-tip">
          请使用Google Authenticator等OTP应用扫描二维码
        </p>
      </div>
    </div>
    
    <!-- OTP设置对话框 -->
    <el-dialog 
      v-model="qrcodeDialogVisible" 
      title="设置动态验证码" 
      width="400px"
      :close-on-click-modal="false"
    >
      <div class="qrcode-dialog-content">
        <p>请使用Google Authenticator等OTP应用扫描以下二维码：</p>
        <div class="qrcode-container" v-if="otpQrcode">
          <img :src="otpQrcode" alt="OTP QR Code" />
        </div>
        <p class="qrcode-tip">
          扫描完成后，请使用您的账号、密码和动态验证码登录
        </p>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button type="primary" @click="handleQrcodeComplete">
            我已完成设置
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { userApi } from '../services/api'
import { setAuthTokens } from '../utils/auth'

// 路由
const router = useRouter()

// 响应式数据
const activeTab = ref('login')
const loading = ref(false)
const registerLoading = ref(false)
const allowRegister = ref(false)
const otpEnabled = ref(true)
const otpQrcode = ref('')
const qrcodeDialogVisible = ref(false)

// 表单引用
const loginFormRef = ref()
const registerFormRef = ref()

// 登录表单数据
const loginForm = reactive({
  username: '',
  password: '',
  otp_code: ''
})

// 注册表单数据
const registerForm = reactive({
  username: '',
  password: '',
  confirmPassword: ''
})

// 登录表单验证规则
const loginRules = reactive({
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' }
  ],
  otp_code: [
    { required: true, message: '请输入动态验证码', trigger: 'blur' }
  ]
})

// 注册表单验证规则
const registerRules = reactive({
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
        if (value !== registerForm.password) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
})

// 处理登录
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
      
      // 使用auth工具函数设置令牌，这会自动启动定期检查
      setAuthTokens(response.access_token, response.refresh_token)
      
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
      
      ElMessage.success(otpEnabled.value ? '注册成功！请设置OTP动态验证码' : '注册成功！')
      
      // 注册成功后，如果启用了OTP，显示OTP二维码
      if (otpEnabled.value) {
        otpQrcode.value = ''
        await loadOtpQrcodeForUser(registerForm.username)
        qrcodeDialogVisible.value = true
      } else {
        // 如果未启用OTP，直接切换到登录标签页
        activeTab.value = 'login'
        loginForm.username = registerForm.username
        // 清空注册表单
        registerForm.username = ''
        registerForm.password = ''
        registerForm.confirmPassword = ''
        ElMessage.info('请使用您的账号和密码登录')
      }
      
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

// 检查OTP状态
const checkOtpStatus = async () => {
  try {
    const response = await userApi.checkOtpStatus()
    otpEnabled.value = response.otp_enabled !== false // 默认启用
    
    // 动态更新OTP验证规则
    if (otpEnabled.value) {
      loginRules.otp_code = [{ required: true, message: '请输入动态验证码', trigger: 'blur' }]
    } else {
      loginRules.otp_code = []
    }
  } catch (error) {
    console.warn('检查OTP状态失败，默认启用OTP:', error)
    otpEnabled.value = true
    loginRules.otp_code = [{ required: true, message: '请输入动态验证码', trigger: 'blur' }]
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
    
  // 检查OTP功能是否开启
  userApi.checkOtpStatus()
    .then(response => {
      otpEnabled.value = response.otp_enabled !== false
      console.log('[SSO重构] LoginView - OTP功能状态:', otpEnabled.value)
      
      // 动态更新OTP验证规则
      if (otpEnabled.value) {
        loginRules.otp_code = [{ required: true, message: '请输入动态验证码', trigger: 'blur' }]
      } else {
        loginRules.otp_code = []
      }
    })
    .catch(error => {
      console.error('[SSO重构] LoginView - 获取OTP状态失败:', error)
      otpEnabled.value = true // 默认启用
      loginRules.otp_code = [{ required: true, message: '请输入动态验证码', trigger: 'blur' }]
    })
})
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-box {
  width: 400px;
  padding: 40px;
  background: white;
  border-radius: 10px;
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.1);
}

.login-header {
  text-align: center;
  margin-bottom: 30px;
}

.login-header h1 {
  color: #333;
  margin-bottom: 10px;
  font-size: 24px;
}

.login-header p {
  color: #666;
  font-size: 14px;
}

.login-tabs {
  margin-bottom: 20px;
}

.login-form,
.register-form {
  margin-top: 20px;
}

.login-btn,
.register-btn {
  width: 100%;
  height: 40px;
  font-size: 16px;
}

.otp-input-group {
  display: flex;
  gap: 10px;
}

.otp-input-group .el-input {
  flex: 1;
}

.qrcode-btn {
  white-space: nowrap;
}

.qrcode-display {
  margin-top: 20px;
  text-align: center;
  padding: 20px;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  background-color: #fafafa;
}

.qrcode-display h3 {
  margin-bottom: 15px;
  color: #333;
}

.qrcode-container {
  margin: 15px 0;
}

.qrcode-container img {
  max-width: 200px;
  height: auto;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.qrcode-tip {
  color: #666;
  font-size: 12px;
  margin-top: 10px;
}

.qrcode-dialog-content {
  text-align: center;
}

.qrcode-dialog-content .qrcode-container {
  margin: 20px 0;
}

.qrcode-dialog-content .qrcode-container img {
  max-width: 250px;
}
</style> 