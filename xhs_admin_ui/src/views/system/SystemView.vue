<template>
  <div class="system-container">
    <el-card class="system-card">
      <template #header>
        <div class="card-header">
          <h3>系统设置</h3>
        </div>
      </template>

      <el-tabs type="border-card">
        <el-tab-pane label="基本设置">
          <el-form :model="basicForm" label-width="140px">
            <el-form-item label="系统名称">
              <el-input v-model="basicForm.systemName" />
            </el-form-item>
            <el-form-item label="系统描述">
              <el-input v-model="basicForm.systemDesc" type="textarea" :rows="3" />
            </el-form-item>
            <el-form-item label="管理员联系邮箱">
              <el-input v-model="basicForm.adminEmail" />
            </el-form-item>
            <el-form-item label="每页显示记录数">
              <el-select v-model="basicForm.pageSize">
                <el-option label="10条/页" :value="10" />
                <el-option label="20条/页" :value="20" />
                <el-option label="50条/页" :value="50" />
                <el-option label="100条/页" :value="100" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveBasicSettings">保存设置</el-button>
              <el-button @click="resetBasicSettings">重置</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="评论设置">
          <el-form :model="commentForm" label-width="180px">
            <el-form-item label="评论是否需要审核">
              <el-switch v-model="commentForm.needAudit" />
            </el-form-item>
            <el-form-item label="评论敏感词过滤">
              <el-switch v-model="commentForm.sensitiveFilter" />
            </el-form-item>
            <el-form-item label="自动拦截含敏感词评论">
              <el-switch v-model="commentForm.autoBlock" />
            </el-form-item>
            <el-form-item label="敏感词列表">
              <el-input
                type="textarea"
                v-model="commentForm.sensitiveWords"
                :rows="5"
                placeholder="每行一个敏感词"
              />
            </el-form-item>
            <el-form-item label="评论最大长度">
              <el-input-number v-model="commentForm.maxLength" :min="1" :max="1000" />
            </el-form-item>
            <el-form-item label="评论提交频率限制">
              <el-select v-model="commentForm.submitLimit">
                <el-option label="无限制" :value="0" />
                <el-option label="10秒/条" :value="10" />
                <el-option label="30秒/条" :value="30" />
                <el-option label="60秒/条" :value="60" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="saveCommentSettings">保存设置</el-button>
              <el-button @click="resetCommentSettings">重置</el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

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

// 基本设置表单
const basicForm = reactive({
  systemName: '小红书评论维护系统',
  systemDesc: '用于管理小红书平台用户评论的后台管理系统',
  adminEmail: 'admin@example.com',
  pageSize: 20
})

// 评论设置表单
const commentForm = reactive({
  needAudit: true,
  sensitiveFilter: true,
  autoBlock: true,
  sensitiveWords: '垃圾\n广告\n智商税\n骗子\n传销\n假货',
  maxLength: 200,
  submitLimit: 10
})

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

// 基本设置相关方法
const saveBasicSettings = () => {
  ElMessage.success('基本设置保存成功')
}

const resetBasicSettings = () => {
  basicForm.systemName = '小红书评论维护系统'
  basicForm.systemDesc = '用于管理小红书平台用户评论的后台管理系统'
  basicForm.adminEmail = 'admin@example.com'
  basicForm.pageSize = 20
  ElMessage.info('基本设置已重置')
}

// 评论设置相关方法
const saveCommentSettings = () => {
  ElMessage.success('评论设置保存成功')
}

const resetCommentSettings = () => {
  commentForm.needAudit = true
  commentForm.sensitiveFilter = true
  commentForm.autoBlock = true
  commentForm.sensitiveWords = '垃圾\n广告\n智商税\n骗子\n传销\n假货'
  commentForm.maxLength = 200
  commentForm.submitLimit = 10
  ElMessage.info('评论设置已重置')
}

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
  padding: 10px;
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