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
import { ref, reactive } from 'vue'
import { User, Lock, Key } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { userApi } from '../services/api'

const router = useRouter()
const loginFormRef = ref(null)
const loading = ref(false)
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