<template>
  <div class="notification-view">
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stats-card">
          <div class="stats-content">
            <div class="stats-icon notifications">
              <el-icon><Bell /></el-icon>
            </div>
            <div class="stats-info">
              <div class="stats-title">总通知数</div>
              <div class="stats-value">{{ statistics.totalNotifications || 0 }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stats-card">
          <div class="stats-content">
            <div class="stats-icon today">
              <el-icon><Calendar /></el-icon>
            </div>
            <div class="stats-info">
              <div class="stats-title">今日新增</div>
              <div class="stats-value">{{ statistics.todayNotifications || 0 }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stats-card">
          <div class="stats-content">
            <div class="stats-icon types">
              <el-icon><Grid /></el-icon>
            </div>
            <div class="stats-info">
              <div class="stats-title">通知类型</div>
              <div class="stats-value">{{ statistics.notificationTypes || 0 }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stats-card">
          <div class="stats-content">
            <div class="stats-icon users">
              <el-icon><User /></el-icon>
            </div>
            <div class="stats-info">
              <div class="stats-title">活跃用户</div>
              <div class="stats-value">{{ statistics.activeUsers || 0 }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 主要内容 -->
    <el-card class="main-card">
      <template #header>
        <div class="card-header">
          <span>小红书通知管理</span>
          <div class="header-actions">
            <el-button type="primary" @click="refreshData" :loading="loading">
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
          </div>
        </div>
      </template>
      
      <!-- 搜索和过滤 -->
      <el-form :inline="true" :model="searchParams" class="search-form">
        <el-form-item label="用户ID">
          <el-input 
            v-model="searchParams.userId" 
            placeholder="输入用户ID"
            clearable
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item label="通知类型">
          <el-select 
            v-model="searchParams.type" 
            placeholder="选择通知类型"
            clearable
            style="width: 150px"
          >
            <el-option 
              v-for="type in notificationTypes" 
              :key="type.type" 
              :label="type.type" 
              :value="type.type"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input 
            v-model="searchParams.keyword" 
            placeholder="通知内容关键词"
            clearable
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item label="日期范围">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 240px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch" :loading="loading">
            <el-icon><Search /></el-icon>
            查询
          </el-button>
          <el-button @click="resetSearch">
            <el-icon><RefreshLeft /></el-icon>
            重置
          </el-button>
        </el-form-item>
      </el-form>

      <!-- 通知表格 -->
      <el-table 
        :data="notifications" 
        stripe 
        style="width: 100%" 
        v-loading="loading"
        row-key="_id"
        @row-click="handleRowClick"
      >
        <el-table-column prop="userId" label="用户ID" width="180" show-overflow-tooltip />
        
        <el-table-column prop="type" label="通知类型" width="120">
          <template #default="{ row }">
            <el-tag :type="getTypeTagType(row.type)">
              {{ row.type || '未知' }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="content" label="通知内容" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="notification-content">
              {{ row.content || row.title || '无内容' }}
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="username" label="用户名" width="120" show-overflow-tooltip />
        
        <el-table-column label="备注" width="250">
          <template #default="{ row }">
            <div class="note-input-container">
              <el-input
                v-model="row.userNote"
                type="textarea"
                :rows="2"
                placeholder="添加备注..."
                class="note-input"
                @blur="handleNoteSave(row)"
                @keydown.enter.ctrl="handleNoteSave(row)"
                size="small"
              />
              <div class="note-actions" v-if="row.userNote && row.userNote.trim()">
                <el-button 
                  type="success" 
                  size="small" 
                  @click="handleNoteSave(row)"
                  :loading="row.noteSaving"
                >
                  保存
                </el-button>
                <el-button 
                  type="danger" 
                  size="small" 
                  @click="handleNoteClear(row)"
                >
                  清除
                </el-button>
              </div>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="timestamp" label="时间" width="160">
          <template #default="{ row }">
            {{ formatDateTime(row.timestamp) }}
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button 
              type="primary" 
              size="small" 
              @click.stop="handleRowClick(row)"
            >
              详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.currentPage"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>

    <!-- 通知详情对话框 -->
    <el-dialog
      v-model="dialogVisible"
      title="通知详情"
      width="60%"
      :before-close="handleDialogClose"
    >
      <div v-if="currentNotification" class="notification-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="通知ID" :span="2">
            {{ currentNotification._id }}
          </el-descriptions-item>
          
          <el-descriptions-item label="用户ID">
            {{ currentNotification.userId || '未知' }}
          </el-descriptions-item>
          
          <el-descriptions-item label="用户名">
            {{ currentNotification.username || '未知' }}
          </el-descriptions-item>
          
          <el-descriptions-item label="通知类型">
            <el-tag :type="getTypeTagType(currentNotification.type)">
              {{ currentNotification.type || '未知' }}
            </el-tag>
          </el-descriptions-item>
          
          <el-descriptions-item label="时间">
            {{ formatDateTime(currentNotification.timestamp) }}
          </el-descriptions-item>
          
          <el-descriptions-item label="通知内容" :span="2">
            {{ currentNotification.content || currentNotification.title || '无内容' }}
          </el-descriptions-item>
          
          <el-descriptions-item label="用户备注" :span="2">
            <el-input
              v-model="currentNotification.userNote"
              type="textarea"
              :rows="3"
              placeholder="添加或编辑备注..."
              @blur="handleNoteSave(currentNotification)"
            />
            <div class="note-actions" style="margin-top: 10px;">
              <el-button 
                type="success" 
                size="small" 
                @click="handleNoteSave(currentNotification)"
                :loading="currentNotification.noteSaving"
              >
                保存备注
              </el-button>
              <el-button 
                type="danger" 
                size="small" 
                @click="handleNoteClear(currentNotification)"
              >
                清除备注
              </el-button>
            </div>
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  Bell, Calendar, Grid, User, Refresh, Search, RefreshLeft
} from '@element-plus/icons-vue'
import { notificationApi, userNoteApi } from '@/services/api'

// 响应式数据
const loading = ref(false)
const notifications = ref([])
const notificationTypes = ref([])
const userNotes = ref({}) // 存储用户备注数据
const dialogVisible = ref(false)
const currentNotification = ref(null)

// 统计数据
const statistics = reactive({
  totalNotifications: 0,
  todayNotifications: 0,
  notificationTypes: 0,
  activeUsers: 0
})

// 搜索参数
const searchParams = reactive({
  userId: '',
  type: '',
  keyword: ''
})

const dateRange = ref([])

// 分页
const pagination = reactive({
  currentPage: 1,
  pageSize: 20,
  total: 0
})

// 计算属性
const formatDateTime = (timestamp) => {
  if (!timestamp) return '未知时间'
  try {
    const date = new Date(timestamp)
    return date.toLocaleString('zh-CN')
  } catch (e) {
    return '时间格式错误'
  }
}

const getTypeTagType = (type) => {
  const typeMap = {
    '评论': 'primary',
    '点赞': 'success',
    '关注': 'warning',
    '@': 'info'
  }
  return typeMap[type] || 'default'
}

// 生成通知哈希值（参考Chrome插件实现）
const generateNotificationHash = (notification) => {
  if (!notification || !notification.userId) return ''
  
  const userId = notification.userId || ''
  const contentPreview = (notification.content || notification.title || '').substring(0, 20).replace(/\s+/g, '')
  const notificationType = notification.type || ''
  
  return `${userId}_${contentPreview}_${notificationType}`
}

// 方法
const fetchNotifications = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.currentPage,
      page_size: pagination.pageSize
    }
    
    // 添加搜索条件
    if (searchParams.userId) {
      params.userId = searchParams.userId
    }
    if (searchParams.type) {
      params.type = searchParams.type
    }
    if (searchParams.keyword) {
      params.keyword = searchParams.keyword
    }
    
    // 添加日期范围
    if (dateRange.value && dateRange.value.length === 2) {
      params.startDate = dateRange.value[0]
      params.endDate = dateRange.value[1]
    }
    
    const response = await notificationApi.getNotificationList(params)
    
    if (response.success) {
      notifications.value = response.data || []
      pagination.total = response.total || 0
      
      // 初始化用户备注
      await initializeUserNotes()
    } else if (response.items) {
      // 兼容不同的响应格式
      notifications.value = response.items || []
      pagination.total = response.total || 0
      
      await initializeUserNotes()
    } else {
      notifications.value = []
      pagination.total = 0
    }
  } catch (error) {
    console.error('获取通知列表失败:', error)
    ElMessage.error('获取通知列表失败: ' + error.message)
    notifications.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

const fetchStatistics = async () => {
  try {
    const response = await notificationApi.getNotificationsStats()
    if (response.success && response.stats) {
      statistics.totalNotifications = response.stats.total?.notifications || 0
      statistics.todayNotifications = response.stats.period?.today || 0
      statistics.notificationTypes = Object.keys(response.stats.by_type || {}).length
      statistics.activeUsers = response.stats.top_users?.length || 0
    }
  } catch (error) {
    console.error('获取通知统计失败:', error)
  }
}

const fetchNotificationTypes = async () => {
  try {
    const response = await notificationApi.getNotificationTypes()
    if (response.success) {
      notificationTypes.value = response.types || []
    }
  } catch (error) {
    console.error('获取通知类型失败:', error)
  }
}

// 初始化用户备注
const initializeUserNotes = async () => {
  try {
    // 提取所有用户ID
    const userIds = [...new Set(notifications.value.map(n => n.userId).filter(Boolean))]
    
    if (userIds.length === 0) {
      return
    }
    
    // 批量获取用户备注
    const response = await userNoteApi.getUserNotesBatch(userIds)
    
    if (response.success && response.data) {
      userNotes.value = response.data
      
      // 将备注数据映射到通知对象
      notifications.value.forEach(notification => {
        const notificationHash = generateNotificationHash(notification)
        notification.userNote = userNotes.value[notificationHash] || ''
        notification.noteSaving = false
      })
    }
  } catch (error) {
    console.error('初始化用户备注失败:', error)
  }
}

// 保存备注
const handleNoteSave = async (notification) => {
  if (!notification || !notification.userId) {
    ElMessage.warning('无效的通知数据')
    return
  }
  
  const notificationHash = generateNotificationHash(notification)
  const noteContent = notification.userNote || ''
  
  notification.noteSaving = true
  
  try {
    const response = await userNoteApi.addUserNote({
      userId: notification.userId,
      notificationHash: notificationHash,
      noteContent: noteContent,
      content: notification.content || notification.title || ''
    })
    
    if (response.success) {
      userNotes.value[notificationHash] = noteContent
      ElMessage.success('备注保存成功')
    } else {
      throw new Error(response.message || '保存失败')
    }
  } catch (error) {
    console.error('保存备注失败:', error)
    ElMessage.error('保存备注失败: ' + error.message)
  } finally {
    notification.noteSaving = false
  }
}

// 清除备注
const handleNoteClear = async (notification) => {
  try {
    await ElMessageBox.confirm('确定要清除这条备注吗？', '确认清除', {
      type: 'warning'
    })
    
    notification.userNote = ''
    await handleNoteSave(notification)
  } catch (error) {
    // 用户取消操作
  }
}

const handleSearch = () => {
  pagination.currentPage = 1
  fetchNotifications()
}

const resetSearch = () => {
  Object.assign(searchParams, {
    userId: '',
    type: '',
    keyword: ''
  })
  dateRange.value = []
  pagination.currentPage = 1
  fetchNotifications()
}

const handleSizeChange = (val) => {
  pagination.pageSize = val
  pagination.currentPage = 1
  fetchNotifications()
}

const handleCurrentChange = (val) => {
  pagination.currentPage = val
  fetchNotifications()
}

const handleRowClick = (row) => {
  currentNotification.value = { ...row }
  dialogVisible.value = true
}

const handleDialogClose = (done) => {
  currentNotification.value = null
  done()
}

const refreshData = () => {
  fetchNotifications()
  fetchStatistics()
  fetchNotificationTypes()
}

// 组件挂载
onMounted(() => {
  fetchNotifications()
  fetchStatistics()
  fetchNotificationTypes()
})
</script>

<style scoped>
.notification-view {
  padding: 20px;
}

.stats-row {
  margin-bottom: 20px;
}

.stats-card {
  height: 100px;
}

.stats-content {
  display: flex;
  align-items: center;
  height: 100%;
}

.stats-icon {
  width: 50px;
  height: 50px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 15px;
  font-size: 24px;
  color: white;
}

.stats-icon.notifications {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.stats-icon.today {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.stats-icon.types {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.stats-icon.users {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
}

.stats-info {
  flex: 1;
}

.stats-title {
  font-size: 14px;
  color: #999;
  margin-bottom: 5px;
}

.stats-value {
  font-size: 24px;
  font-weight: bold;
  color: #333;
}

.main-card {
  margin-top: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.search-form {
  margin-bottom: 20px;
  padding: 20px;
  background-color: #f8f9fa;
  border-radius: 8px;
}

.notification-content {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.note-input-container {
  position: relative;
}

.note-input {
  width: 100%;
}

.note-actions {
  display: flex;
  gap: 5px;
  margin-top: 5px;
  justify-content: flex-end;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}

.notification-detail {
  max-height: 600px;
  overflow-y: auto;
}

/* 表格行悬停效果 */
:deep(.el-table__row) {
  cursor: pointer;
}

:deep(.el-table__row:hover) {
  background-color: #f5f7fa;
}
</style> 