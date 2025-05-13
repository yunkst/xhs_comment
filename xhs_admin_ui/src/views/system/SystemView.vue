<template>
  <div class="system-container">
    <el-card class="system-card">
      <template #header>
        <div class="card-header">
          <h3>系统设置</h3>
        </div>
      </template>

      <el-tabs type="border-card">
        <el-tab-pane label="安全设置">
          <el-form :model="securityForm" label-width="180px">
            <el-form-item label="登录密码有效期">
              <el-select v-model="securityForm.passwordExpiration">
                <el-option label="永不过期" :value="0" />
                <el-option label="30天" :value="30" />
                <el-option label="60天" :value="60" />
                <el-option label="90天" :value="90" />
              </el-select>
            </el-form-item>
            <el-form-item label="登录失败锁定">
              <el-switch v-model="securityForm.loginLockEnabled" />
            </el-form-item>
            <el-form-item label="失败次数锁定阈值" v-if="securityForm.loginLockEnabled">
              <el-input-number v-model="securityForm.loginLockThreshold" :min="1" :max="10" />
            </el-form-item>
            <el-form-item label="锁定时间(分钟)" v-if="securityForm.loginLockEnabled">
              <el-input-number v-model="securityForm.loginLockTime" :min="1" :max="1440" />
            </el-form-item>
            <el-form-item label="会话超时时间(分钟)">
              <el-input-number v-model="securityForm.sessionTimeout" :min="1" :max="1440" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveSecuritySettings">保存设置</el-button>
              <el-button @click="resetSecuritySettings">重置</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="备份恢复">
          <el-alert
            title="数据备份与恢复"
            type="info"
            :closable="false"
            description="您可以备份系统数据或恢复之前的备份，请谨慎操作以免数据丢失。"
            show-icon
            style="margin-bottom: 20px"
          />
          
          <div class="backup-actions">
            <el-button type="primary" @click="handleBackup" :loading="backupLoading">
              <el-icon><Download /></el-icon>
              备份数据
            </el-button>
            
            <el-upload
              class="upload-backup"
              action="#"
              :auto-upload="false"
              :on-change="handleRestoreFileChange"
              :file-list="restoreFiles"
            >
              <el-button type="warning">
                <el-icon><Upload /></el-icon>
                选择备份文件
              </el-button>
            </el-upload>
            
            <el-button 
              type="danger" 
              @click="handleRestore" 
              :disabled="!selectedRestoreFile"
              :loading="restoreLoading"
            >
              <el-icon><RefreshRight /></el-icon>
              恢复数据
            </el-button>
          </div>
          
          <div class="backup-history" v-if="backupHistory.length > 0">
            <h4>备份历史</h4>
            <el-table :data="backupHistory" style="width: 100%">
              <el-table-column prop="filename" label="文件名" />
              <el-table-column prop="size" label="大小" width="120" />
              <el-table-column prop="createTime" label="创建时间" width="180" />
              <el-table-column label="操作" width="180">
                <template #default="scope">
                  <el-button size="small" @click="downloadBackup(scope.row)">下载</el-button>
                  <el-button size="small" type="danger" @click="deleteBackup(scope.row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download, Upload, RefreshRight } from '@element-plus/icons-vue'

// 安全设置表单
const securityForm = reactive({
  passwordExpiration: 90,
  loginLockEnabled: true,
  loginLockThreshold: 5,
  loginLockTime: 30,
  sessionTimeout: 120
})

// 备份相关数据
const backupLoading = ref(false)
const restoreLoading = ref(false)
const restoreFiles = ref([])
const selectedRestoreFile = ref(null)
const backupHistory = ref([
  {
    filename: 'backup_20230615120000.zip',
    size: '5.2MB',
    createTime: '2023-06-15 12:00:00'
  },
  {
    filename: 'backup_20230610090000.zip',
    size: '5.1MB',
    createTime: '2023-06-10 09:00:00'
  },
  {
    filename: 'backup_20230601180000.zip',
    size: '4.9MB',
    createTime: '2023-06-01 18:00:00'
  }
])

// 安全设置相关方法
const saveSecuritySettings = () => {
  ElMessage.success('安全设置保存成功')
}

const resetSecuritySettings = () => {
  securityForm.passwordExpiration = 90
  securityForm.loginLockEnabled = true
  securityForm.loginLockThreshold = 5
  securityForm.loginLockTime = 30
  securityForm.sessionTimeout = 120
  ElMessage.info('安全设置已重置')
}

// 备份相关方法
const handleBackup = () => {
  backupLoading.value = true
  
  // 模拟备份过程
  setTimeout(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hour = String(now.getHours()).padStart(2, '0')
    const minute = String(now.getMinutes()).padStart(2, '0')
    const second = String(now.getSeconds()).padStart(2, '0')
    
    const filename = `backup_${year}${month}${day}${hour}${minute}${second}.zip`
    
    backupHistory.value.unshift({
      filename,
      size: '5.3MB',
      createTime: `${year}-${month}-${day} ${hour}:${minute}:${second}`
    })
    
    backupLoading.value = false
    ElMessage.success('数据备份成功')
  }, 2000)
}

const handleRestoreFileChange = (file) => {
  restoreFiles.value = [file]
  selectedRestoreFile.value = file
}

const handleRestore = () => {
  if (!selectedRestoreFile.value) {
    ElMessage.warning('请先选择备份文件')
    return
  }
  
  ElMessageBox.confirm('恢复操作将覆盖当前数据，是否继续?', '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    restoreLoading.value = true
    
    // 模拟恢复过程
    setTimeout(() => {
      restoreLoading.value = false
      restoreFiles.value = []
      selectedRestoreFile.value = null
      ElMessage.success('数据恢复成功')
    }, 2000)
  }).catch(() => {})
}

const downloadBackup = (backup) => {
  ElMessage.success(`正在下载备份文件: ${backup.filename}`)
}

const deleteBackup = (backup) => {
  ElMessageBox.confirm(`确定要删除备份文件 ${backup.filename} 吗?`, '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    backupHistory.value = backupHistory.value.filter(item => item.filename !== backup.filename)
    ElMessage.success('备份文件删除成功')
  }).catch(() => {})
}
</script>

<style scoped>
.system-container {
  width: 100%;
}

.system-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  align-items: center;
}

.card-header h3 {
  margin: 0;
  font-size: 18px;
}

.backup-actions {
  display: flex;
  gap: 20px;
  margin-bottom: 30px;
}

.upload-backup {
  margin-right: 10px;
}

.backup-history h4 {
  margin-top: 20px;
  margin-bottom: 15px;
  font-size: 16px;
  color: #606266;
}

:deep(.el-upload-list) {
  margin-top: 10px;
}
</style> 