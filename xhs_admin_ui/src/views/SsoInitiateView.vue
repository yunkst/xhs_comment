<template>
  <div class="sso-initiate-container">
    <el-card class="sso-initiate-card">
      <div v-if="isLoading" class="loading-state">
        <el-icon class="is-loading" :size="30"><Loading /></el-icon>
        <p>{{ loadingMessage }}</p>
      </div>
      <div v-else-if="errorMessage" class="error-state">
        <el-icon :size="30" color="#F56C6C"><CircleCloseFilled /></el-icon>
        <p class="error-text">SSO授权处理失败</p>
        <p class="error-detail">{{ errorMessage }}</p>
        <el-button type="primary" @click="retryOrGoHome">重试或返回首页</el-button>
      </div>
      <div v-else-if="successMessage" class="success-state">
        <el-icon :size="30" color="#67C23A"><SuccessFilled /></el-icon>
        <p class="success-text">{{ successMessage }}</p>
        <p class="small-text">此页面将在 {{ countdown }} 秒后自动关闭...</p>
        <el-button @click="closeWindow">立即关闭</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElIcon } from 'element-plus';
import { Loading, CircleCloseFilled, SuccessFilled } from '@element-plus/icons-vue';
import { ssoApi } from '../services/api'; // 假设 ssoApi 在这里定义

const route = useRoute();
const router = useRouter();

const isLoading = ref(true);
const loadingMessage = ref('正在处理SSO授权请求...');
const errorMessage = ref(null);
const successMessage = ref(null);
const countdown = ref(5);
let countdownInterval = null;

const sessionId = ref(null);

onMounted(async () => {
  sessionId.value = route.query.session_id;
  console.log('[SSO Initiate] 组件已挂载, session_id:', sessionId.value);

  if (!sessionId.value) {
    errorMessage.value = '无效的请求：缺少 session_id 参数。';
    isLoading.value = false;
    return;
  }

  const adminToken = localStorage.getItem('token');

  if (adminToken) {
    console.log('[SSO Initiate] 用户已登录 (Admin UI)，准备调用 approve_sso_session');
    loadingMessage.value = '用户已登录，正在为您批准插件授权...';
    try {
      // 确保 ssoApi.approveSsoSession 方法存在且能正确发送带有Authorization头的请求
      if (typeof ssoApi.approveSsoSession !== 'function') {
          throw new Error ('ssoApi.approveSsoSession 方法未定义，请检查 services/api.js');
      }
      const response = await ssoApi.approveSsoSession(sessionId.value); // token 会由axios拦截器自动添加
      console.log('[SSO Initiate] approve_sso_session 响应:', response);
      
      if (response && (response.status === 'success' || response.data?.status === 'success')) { // 兼容不同响应结构
        successMessage.value = '插件授权成功！';
        isLoading.value = false;
        startCloseCountdown();
      } else {
        throw new Error(response?.message || response?.data?.message || response?.detail || '批准会话失败，但未返回明确错误信息。');
      }
    } catch (error) {
      console.error('[SSO Initiate] 调用 approve_sso_session 失败:', error);
      errorMessage.value = `批准插件授权失败: ${error.response?.data?.detail || error.message || '未知错误'}`;
      isLoading.value = false;
    }
  } else {
    console.log('[SSO Initiate] 用户未登录 (Admin UI)，重定向到登录页面');
    loadingMessage.value = '用户未登录，正在跳转到登录页面...';
    // 构建回调URL，确保session_id被正确传递
    const redirectPath = `/sso-initiate?session_id=${sessionId.value}`;
    router.push({ path: '/login', query: { redirect_after_login: redirectPath } });
    // isLoading 会保持 true，因为页面会跳转
  }
});

onUnmounted(() => {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
});

function startCloseCountdown() {
  countdownInterval = setInterval(() => {
    countdown.value -= 1;
    if (countdown.value <= 0) {
      clearInterval(countdownInterval);
      closeWindow();
    }
  }, 1000);
}

function closeWindow() {
  window.close();
  // 如果 window.close() 由于浏览器限制没有生效，可以给用户一个提示
  if (!window.closed) {
    successMessage.value = '授权成功！请手动关闭此标签页。';
    // 停止倒计时以防万一
    if (countdownInterval) clearInterval(countdownInterval);
    countdown.value = 0; // 清除倒计时显示
  }
}

function retryOrGoHome() {
  if (sessionId.value && localStorage.getItem('token')) {
    // 如果有session_id且用户已登录，尝试重新处理
    isLoading.value = true;
    errorMessage.value = null;
    loadingMessage.value = '正在重试授权...';
    onMounted(); // 重新执行挂载逻辑
  } else {
    router.push('/'); // 否则返回首页
  }
}

</script>

<style scoped>
.sso-initiate-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: #f0f2f5;
}

.sso-initiate-card {
  width: 450px;
  padding: 30px;
  text-align: center;
}

.loading-state,
.error-state,
.success-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

.loading-state p {
  font-size: 16px;
  color: #606266;
}

.error-text {
  font-size: 18px;
  color: #F56C6C;
  font-weight: bold;
}

.error-detail {
  font-size: 14px;
  color: #909399;
  word-break: break-all;
}

.success-text {
  font-size: 18px;
  color: #67C23A;
  font-weight: bold;
}

.small-text {
  font-size: 12px;
  color: #909399;
}

.el-icon.is-loading {
  animation: rotating 2s linear infinite;
}
</style> 