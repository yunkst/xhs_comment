<template>
  <div class="not-found">
    <img src="https://cdn.element-plus.org/error-page/images/404.png" alt="404" />
    <div class="text">
      <h2>404</h2>
      <p>抱歉，您访问的页面不存在</p>
      <el-button type="primary" @click="goHome">返回首页</el-button>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const goHome = () => {
  router.push('/')
}
</script>

<style scoped>
.not-found {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: #f5f7f9;
}

.not-found img {
  max-width: 400px;
  margin-bottom: 30px;
}

.text {
  text-align: center;
}

.text h2 {
  font-size: 32px;
  color: #409EFF;
  margin-bottom: 10px;
}

.text p {
  font-size: 18px;
  color: #666;
  margin-bottom: 20px;
}
</style> 