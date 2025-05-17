<template>
  <div class="login-container">
    <el-card class="login-card">
      <div class="title">
        <h2>小红书评论维护系统</h2>
      </div>
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
    </el-card>

    <el-dialog v-model="qrcodeDialogVisible" title="OTP设置" width="350px">
      <div v-if="otpQrcode" class="qrcode-container">
        <p>请使用Google Authenticator或其他OTP应用扫描下方二维码</p>
        <img :src="otpQrcode" alt="OTP二维码" />
      </div>
      <div v-else class="qrcode-container">
        <el-alert type="info" :closable="false">正在加载OTP二维码...</el-alert>
      </div>
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
const loading = ref(false)
const ssoLoading = ref(false)
const qrcodeDialogVisible = ref(false)
const otpQrcode = ref('')

const loginForm = reactive({
  username: '',
  password: '',
  otp_code: ''
})

const loginRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  otp_code: [{ required: true, message: '请输入动态验证码', trigger: 'blur' }]
}

// 处理SSO登录
const handleSsoLogin = async () => {
  ssoLoading.value = true
  
  try {
    // 获取SSO登录URL
    const response = await ssoApi.getSsoLoginUrl()
    
    // 重定向到SSO登录页面
    window.location.href = response.auth_url
  } catch (error) {
    console.error('获取SSO登录URL失败:', error)
    
    if (error.response && error.response.data && error.response.data.detail) {
      ElMessage.error(`SSO登录失败: ${error.response.data.detail}`)
    } else {
      ElMessage.error('SSO登录失败，请稍后再试')
    }
    
    ssoLoading.value = false
  }
}

// 检查URL中是否有SSO回调参数
const checkSsoCallback = () => {
  const urlParams = new URLSearchParams(window.location.search)
  const accessToken = urlParams.get('access_token')
  const idToken = urlParams.get('id_token')
  const refreshToken = urlParams.get('refresh_token')
  const error = urlParams.get('error')
  
  // 清除URL参数，避免刷新页面时重复处理
  if (accessToken || error) {
    window.history.replaceState({}, document.title, window.location.pathname)
  }
  
  // 处理错误情况
  if (error) {
    const errorDescription = urlParams.get('error_description') || '未知错误'
    ElMessage.error(`SSO登录失败: ${errorDescription}`)
    return
  }
  
  // 处理成功情况
  if (accessToken) {
    localStorage.setItem('token', accessToken)
    
    // 可选：存储其他令牌
    if (idToken) localStorage.setItem('id_token', idToken)
    if (refreshToken) localStorage.setItem('refresh_token', refreshToken)
    
    ElMessage.success('SSO登录成功')
    router.push('/')
  }
}

const handleLogin = async () => {
  if (!loginFormRef.value) return
  
  await loginFormRef.value.validate(async (valid) => {
    if (!valid) return
    
    loading.value = true
    
    try {
      // 调用登录接口
      const response = await userApi.login({
        username: loginForm.username,
        password: loginForm.password,
        otp_code: loginForm.otp_code
      })
      
      localStorage.setItem('token', response.access_token)
      ElMessage.success('登录成功')
      router.push('/')
    } catch (error) {
      console.error('登录失败:', error)
      
      if (error.response && error.response.status === 401) {
        ElMessage.error('用户名、密码或动态验证码错误')
      } else if (error.response && error.response.status === 404) {
        // 可能是新用户，显示OTP二维码
        await loadOtpQrcode()
        qrcodeDialogVisible.value = true
      } else {
        ElMessage.error('登录失败，请稍后再试')
      }
    } finally {
      loading.value = false
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

// 页面加载时检查SSO回调参数
onMounted(() => {
  checkSsoCallback()
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
</style> 