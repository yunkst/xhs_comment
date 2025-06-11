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
          <el-form :model="securityForm" label-width="180px" v-loading="settingsLoading">
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
              <el-button type="primary" @click="saveSecuritySettings" :loading="saveLoading">保存设置</el-button>
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
              accept=".zip,.sql,.bak"
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
          
          <div class="backup-history" v-loading="historyLoading">
            <h4>备份历史</h4>
            <el-table :data="backupHistory" style="width: 100%" v-if="backupHistory.length > 0">
              <el-table-column prop="filename" label="文件名" />
              <el-table-column prop="size" label="大小" width="120" />
              <el-table-column prop="createTime" label="创建时间" width="180" />
              <el-table-column label="操作" width="180">
                <template #default="scope">
                  <el-button size="small" @click="downloadBackup(scope.row)" :loading="scope.row.downloading">下载</el-button>
                  <el-button size="small" type="danger" @click="deleteBackup(scope.row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
            <el-empty v-else description="暂无备份历史" />
          </div>
        </el-tab-pane>

        <el-tab-pane label="系统监控">
          <div class="system-monitoring" v-loading="monitoringLoading">
            <el-row :gutter="20">
              <el-col :span="8">
                <el-card>
                  <h4>系统状态</h4>
                  <div class="status-item">
                    <span>运行时间:</span>
                    <span>{{ systemStatus.uptime || '-' }}</span>
                  </div>
                  <div class="status-item">
                    <span>CPU使用率:</span>
                    <span>{{ systemStatus.cpu_usage || '-' }}</span>
                  </div>
                  <div class="status-item">
                    <span>内存使用率:</span>
                    <span>{{ systemStatus.memory_usage || '-' }}</span>
                  </div>
                </el-card>
              </el-col>
              <el-col :span="8">
                <el-card>
                  <h4>数据库统计</h4>
                  <div class="status-item">
                    <span>评论总数:</span>
                    <span>{{ databaseStats.comments_count || '-' }}</span>
                  </div>
                  <div class="status-item">
                    <span>用户总数:</span>
                    <span>{{ databaseStats.users_count || '-' }}</span>
                  </div>
                  <div class="status-item">
                    <span>数据库大小:</span>
                    <span>{{ databaseStats.database_size || '-' }}</span>
                  </div>
                </el-card>
              </el-col>
              <el-col :span="8">
                <el-card>
                  <h4>版本信息</h4>
                  <div class="status-item">
                    <span>系统版本:</span>
                    <span>{{ versionInfo.version || '-' }}</span>
                  </div>
                  <div class="status-item">
                    <span>构建时间:</span>
                    <span>{{ versionInfo.build_time || '-' }}</span>
                  </div>
                  <div class="status-item">
                    <span>Git提交:</span>
                    <span>{{ versionInfo.git_commit || '-' }}</span>
                  </div>
                </el-card>
              </el-col>
            </el-row>
            
            <el-button type="primary" @click="loadSystemInfo" style="margin-top: 20px">刷新系统信息</el-button>
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
import { systemApi } from '../../services/api'

// 加载状态
const settingsLoading = ref(false)
const saveLoading = ref(false)
const backupLoading = ref(false)
const restoreLoading = ref(false)
const historyLoading = ref(false)
const monitoringLoading = ref(false)

// 安全设置表单
const securityForm = reactive({
  passwordExpiration: 90,
  loginLockEnabled: true,
  loginLockThreshold: 5,
  loginLockTime: 30,
  sessionTimeout: 120
})

// 原始设置数据，用于重置
const originalSecurityForm = ref({})

// 备份相关数据
const restoreFiles = ref([])
const selectedRestoreFile = ref(null)
const backupHistory = ref([])

// 系统监控数据
const systemStatus = ref({})
const databaseStats = ref({})
const versionInfo = ref({})

// 加载系统设置
const loadSystemSettings = async () => {
  settingsLoading.value = true
  try {
    const response = await systemApi.getSystemSettings()
    if (response && response.data) {
      Object.assign(securityForm, response.data)
      originalSecurityForm.value = { ...response.data }
    }
  } catch (error) {
    console.error('加载系统设置失败:', error)
    ElMessage.error(error.response?.data?.detail || '加载系统设置失败')
  } finally {
    settingsLoading.value = false
  }
}

// 保存安全设置
const saveSecuritySettings = async () => {
  saveLoading.value = true
  try {
    await systemApi.updateSystemSettings(securityForm)
    originalSecurityForm.value = { ...securityForm }
  ElMessage.success('安全设置保存成功')
  } catch (error) {
    console.error('保存安全设置失败:', error)
    ElMessage.error(error.response?.data?.detail || '保存安全设置失败')
  } finally {
    saveLoading.value = false
  }
}

// 重置安全设置
const resetSecuritySettings = () => {
  Object.assign(securityForm, originalSecurityForm.value)
  ElMessage.info('安全设置已重置')
}

// 加载备份历史
const loadBackupHistory = async () => {
  historyLoading.value = true
  try {
    const response = await systemApi.getBackupHistory()
    if (response && response.data) {
      backupHistory.value = response.data.map(item => ({
        ...item,
        downloading: false
      }))
    }
  } catch (error) {
    console.error('加载备份历史失败:', error)
    ElMessage.error(error.response?.data?.detail || '加载备份历史失败')
    backupHistory.value = []
  } finally {
    historyLoading.value = false
  }
}

// 备份数据
const handleBackup = async () => {
  backupLoading.value = true
  try {
    const response = await systemApi.backupData()
    ElMessage.success('数据备份成功')
    // 重新加载备份历史
    await loadBackupHistory()
  } catch (error) {
    console.error('数据备份失败:', error)
    ElMessage.error(error.response?.data?.detail || '数据备份失败')
  } finally {
    backupLoading.value = false
  }
}

// 处理恢复文件选择
const handleRestoreFileChange = (file) => {
  restoreFiles.value = [file]
  selectedRestoreFile.value = file
}

// 恢复数据
const handleRestore = async () => {
  if (!selectedRestoreFile.value) {
    ElMessage.warning('请先选择备份文件')
    return
  }
  
  try {
    await ElMessageBox.confirm('恢复操作将覆盖当前数据，是否继续?', '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
    })
    
    restoreLoading.value = true
    
    // 创建FormData对象
    const formData = new FormData()
    formData.append('file', selectedRestoreFile.value.raw)
    
    await systemApi.restoreData(formData)
    
      restoreFiles.value = []
      selectedRestoreFile.value = null
      ElMessage.success('数据恢复成功')
    
    // 重新加载系统信息
    await loadSystemInfo()
    
  } catch (error) {
    if (error !== 'cancel') {  // 用户取消操作
      console.error('数据恢复失败:', error)
      ElMessage.error(error.response?.data?.detail || '数据恢复失败')
}
  } finally {
    restoreLoading.value = false
  }
}

// 下载备份
const downloadBackup = async (backup) => {
  backup.downloading = true
  try {
    const response = await systemApi.downloadBackup(backup.filename)
    
    // 创建下载链接
    const blob = new Blob([response], { type: 'application/octet-stream' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = backup.filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    
    ElMessage.success(`备份文件 ${backup.filename} 下载成功`)
  } catch (error) {
    console.error('下载备份文件失败:', error)
    ElMessage.error(error.response?.data?.detail || '下载备份文件失败')
  } finally {
    backup.downloading = false
  }
}

// 删除备份
const deleteBackup = async (backup) => {
  try {
    await ElMessageBox.confirm(`确定要删除备份文件 ${backup.filename} 吗?`, '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
    })
    
    await systemApi.deleteBackup(backup.filename)
    
    // 从列表中移除
    backupHistory.value = backupHistory.value.filter(item => item.filename !== backup.filename)
    ElMessage.success('备份文件删除成功')
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除备份文件失败:', error)
      ElMessage.error(error.response?.data?.detail || '删除备份文件失败')
    }
  }
}

// 加载系统信息
const loadSystemInfo = async () => {
  monitoringLoading.value = true
  try {
    const [statusResponse, dbStatsResponse, versionResponse] = await Promise.all([
      systemApi.getSystemStatus(),
      systemApi.getDatabaseStats(),
      systemApi.getVersionInfo()
    ])
    
    systemStatus.value = statusResponse?.data || {}
    databaseStats.value = dbStatsResponse?.data || {}
    versionInfo.value = versionResponse?.data || {}
    
  } catch (error) {
    console.error('加载系统信息失败:', error)
    ElMessage.error(error.response?.data?.detail || '加载系统信息失败')
  } finally {
    monitoringLoading.value = false
  }
}

// 组件挂载时加载所有数据
onMounted(async () => {
  await Promise.all([
    loadSystemSettings(),
    loadBackupHistory(),
    loadSystemInfo()
  ])
})
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

.system-monitoring .status-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  padding: 5px 0;
  border-bottom: 1px solid #f0f0f0;
}

.system-monitoring .status-item:last-child {
  border-bottom: none;
}

:deep(.el-upload-list) {
  margin-top: 10px;
}

:deep(.el-card) {
  margin-bottom: 20px;
}

:deep(.el-card .el-card__body h4) {
  margin-top: 0;
  margin-bottom: 15px;
  color: #409eff;
}
</style> 