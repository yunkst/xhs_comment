<template>
  <div class="notes-view">
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stats-card">
          <div class="stats-content">
            <div class="stats-icon notes">
              <el-icon><Document /></el-icon>
            </div>
            <div class="stats-info">
              <div class="stats-title">总笔记数</div>
              <div class="stats-value">{{ statistics.totalNotes || 0 }}</div>
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
              <div class="stats-value">{{ statistics.todayNotes || 0 }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stats-card">
          <div class="stats-content">
            <div class="stats-icon likes">
              <el-icon><Star /></el-icon>
            </div>
            <div class="stats-info">
              <div class="stats-title">总点赞数</div>
              <div class="stats-value">{{ statistics.totalLikes || 0 }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stats-card">
          <div class="stats-content">
            <div class="stats-icon comments">
              <el-icon><ChatDotRound /></el-icon>
            </div>
            <div class="stats-info">
              <div class="stats-title">总评论数</div>
              <div class="stats-value">{{ statistics.totalComments || 0 }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 主要内容 -->
    <el-card class="main-card">
      <template #header>
        <div class="card-header">
          <span>小红书笔记管理</span>
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
        <el-form-item label="笔记ID">
          <el-input 
            v-model="searchParams.noteId" 
            placeholder="输入笔记ID"
            clearable
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item label="作者">
          <el-input 
            v-model="searchParams.author" 
            placeholder="输入作者昵称"
            clearable
            style="width: 150px"
          />
        </el-form-item>
        <el-form-item label="关键词">
          <el-input 
            v-model="searchParams.keyword" 
            placeholder="标题或内容关键词"
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

      <!-- 笔记表格 -->
      <el-table 
        :data="notes" 
        stripe 
        style="width: 100%" 
        v-loading="loading"
        row-key="_id"
        @row-click="handleRowClick"
      >
        <el-table-column prop="noteId" label="笔记ID" width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <el-link 
              :href="getNoteUrl(row.noteId)" 
              type="primary" 
              target="_blank"
              @click.stop
            >
              {{ row.noteId }}
            </el-link>
          </template>
        </el-table-column>
        
        <el-table-column prop="title" label="标题/内容" min-width="250" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="note-title">
              {{ row.title || row.noteContent || '无内容' }}
            </div>
          </template>
        </el-table-column>
        
        <el-table-column label="作者ID" width="180">
          <template #default="{ row }">
            <div class="author-info">
              <el-icon style="margin-right: 8px"><User /></el-icon>
              <span>{{ row.authorId || '未知作者' }}</span>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="publishTime" label="发布时间" width="160">
          <template #default="{ row }">
            {{ formatDateTime(row.publishTime) }}
          </template>
        </el-table-column>
        
        <el-table-column prop="noteLike" label="点赞数" width="100" sortable>
          <template #default="{ row }">
            <el-tag type="success" size="small">
              {{ formatNumber(row.noteLike) }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="noteCommitCount" label="评论数" width="100" sortable>
          <template #default="{ row }">
            <el-tag type="info" size="small">
              {{ formatNumber(row.noteCommitCount) }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="fetchTimestamp" label="抓取时间" width="160">
          <template #default="{ row }">
            {{ formatDateTime(row.fetchTimestamp) }}
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button 
              type="primary" 
              size="small" 
              @click.stop="handleViewDetails(row)"
            >
              查看详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <el-pagination
        style="margin-top: 20px; display: flex; justify-content: center;"
        background
        layout="total, sizes, prev, pager, next, jumper"
        :total="pagination.total"
        :page-size="pagination.pageSize"
        :current-page="pagination.currentPage"
        :page-sizes="[10, 20, 50, 100]"
        @size-change="handleSizeChange"
        @current-change="handlePageChange"
      />
    </el-card>

    <!-- 笔记详情对话框 -->
    <el-dialog 
      v-model="detailDialogVisible" 
      title="笔记详情" 
      width="800px"
      :close-on-click-modal="false"
    >
      <div v-if="currentNote" class="note-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="笔记ID" :span="2">
            <el-link 
              :href="getNoteUrl(currentNote.noteId)" 
              type="primary" 
              target="_blank"
            >
              {{ currentNote.noteId }}
            </el-link>
          </el-descriptions-item>
          
          <el-descriptions-item label="内容" :span="2">
            {{ currentNote.noteContent || currentNote.title || '无内容' }}
          </el-descriptions-item>
          
          <el-descriptions-item label="作者ID">
            {{ currentNote.authorId || '未知' }}
          </el-descriptions-item>
          
          <el-descriptions-item label="发布时间">
            {{ formatDateTime(currentNote.publishTime) }}
          </el-descriptions-item>
          
          <el-descriptions-item label="抓取时间">
            {{ formatDateTime(currentNote.fetchTimestamp) }}
          </el-descriptions-item>
          
          <el-descriptions-item label="点赞数">
            <el-tag type="success">{{ formatNumber(currentNote.noteLike) }}</el-tag>
          </el-descriptions-item>
          
          <el-descriptions-item label="评论数">
            <el-tag type="info">{{ formatNumber(currentNote.noteCommitCount) }}</el-tag>
          </el-descriptions-item>
          
          <el-descriptions-item label="数据库ID">
            <el-tag type="primary">{{ currentNote._id }}</el-tag>
          </el-descriptions-item>
        </el-descriptions>
        
        <!-- 违规信息 -->
        <div class="note-illegal-section" v-if="currentNote.illegal_info && (currentNote.illegal_info.illegal_type || currentNote.illegal_info.illegal_text)">
          <h4>违规信息</h4>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="违规类型" v-if="currentNote.illegal_info.illegal_type">
              <el-tag type="danger">{{ currentNote.illegal_info.illegal_type }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="违规文本" v-if="currentNote.illegal_info.illegal_text">
              {{ currentNote.illegal_info.illegal_text }}
            </el-descriptions-item>
          </el-descriptions>
        </div>
      </div>
      
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { 
  Document, 
  Calendar, 
  Star, 
  ChatDotRound, 
  Refresh, 
  Search, 
  RefreshLeft,
  User
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { noteApi } from '../../services/api'

// 响应式数据
const loading = ref(false)
const notes = ref([])
const dateRange = ref([])
const detailDialogVisible = ref(false)
const currentNote = ref(null)

// 统计信息
const statistics = reactive({
  totalNotes: 0,
  todayNotes: 0,
  totalLikes: 0,
  totalComments: 0
})

// 搜索参数
const searchParams = reactive({
  noteId: '',
  author: '',
  keyword: ''
})

// 分页信息
const pagination = reactive({
  currentPage: 1,
  pageSize: 20,
  total: 0
})

// 获取笔记列表
const fetchNotes = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.currentPage,
      page_size: pagination.pageSize
    }
    
    // 添加搜索条件
    if (searchParams.noteId) {
      params.noteId = searchParams.noteId
    }
    if (searchParams.author) {
      params.authorName = searchParams.author
    }
    if (searchParams.keyword) {
      params.keyword = searchParams.keyword
    }
    
    // 添加日期范围
    if (dateRange.value && dateRange.value.length === 2) {
      params.startDate = dateRange.value[0]
      params.endDate = dateRange.value[1]
    }
    
    const response = await noteApi.getNoteList(params)
    
    if (response.success) {
      notes.value = response.data || []
      pagination.total = response.total || 0
    } else if (response.items) {
      // 兼容不同的响应格式
      notes.value = response.items || []
      pagination.total = response.total || 0
    } else {
      notes.value = []
      pagination.total = 0
      ElMessage.warning(response.message || '获取笔记列表失败')
    }
  } catch (error) {
    console.error('获取笔记列表失败:', error)
    ElMessage.error(error.response?.data?.detail || error.message || '获取笔记列表失败')
    notes.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

// 获取统计信息
const fetchStatistics = async () => {
  try {
    const response = await noteApi.getNotesStats()
    
    if (response.success && response.stats) {
      statistics.totalNotes = response.stats.total?.notes || 0
      statistics.todayNotes = response.stats.period?.today || 0
      statistics.totalLikes = response.stats.engagement?.total_liked || 0
      statistics.totalComments = response.stats.engagement?.total_collected || 0
    }
  } catch (error) {
    console.error('获取统计信息失败:', error)
    // 不显示错误消息，避免影响用户体验
  }
}

// 搜索
const handleSearch = () => {
  pagination.currentPage = 1
  fetchNotes()
}

// 重置搜索
const resetSearch = () => {
  searchParams.noteId = ''
  searchParams.author = ''
  searchParams.keyword = ''
  dateRange.value = []
  pagination.currentPage = 1
  fetchNotes()
}

// 刷新数据
const refreshData = async () => {
  await Promise.all([
    fetchNotes(),
    fetchStatistics()
  ])
  ElMessage.success('数据已刷新')
}

// 分页处理
const handlePageChange = (page) => {
  pagination.currentPage = page
  fetchNotes()
}

const handleSizeChange = (size) => {
  pagination.pageSize = size
  pagination.currentPage = 1
  fetchNotes()
}

// 查看详情
const handleViewDetails = (row) => {
  currentNote.value = row
  detailDialogVisible.value = true
}

// 行点击
const handleRowClick = (row) => {
  handleViewDetails(row)
}

// 工具函数
const formatDateTime = (dateTimeStr) => {
  if (!dateTimeStr) return '-'
  try {
    const date = new Date(dateTimeStr)
    if (isNaN(date.getTime())) return dateTimeStr
    return date.toLocaleString('zh-CN', { 
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch (e) {
    return dateTimeStr
  }
}

const formatNumber = (num) => {
  if (num === null || num === undefined) return '0'
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + 'w'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k'
  }
  return num.toString()
}

const getNoteUrl = (noteId) => {
  return `https://www.xiaohongshu.com/explore/${noteId}`
}

// 组件挂载
onMounted(() => {
  fetchNotes()
  fetchStatistics()
})
</script>

<style scoped>
.notes-view {
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
  font-size: 36px;
  margin-right: 15px;
  padding: 10px;
  border-radius: 8px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
}

.stats-icon.notes {
  background-color: #409EFF;
}

.stats-icon.today {
  background-color: #67C23A;
}

.stats-icon.likes {
  background-color: #E6A23C;
}

.stats-icon.comments {
  background-color: #F56C6C;
}

.stats-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.stats-title {
  font-size: 14px;
  color: #909399;
  margin-bottom: 5px;
}

.stats-value {
  font-size: 24px;
  font-weight: bold;
  color: #303133;
}

.main-card {
  margin-top: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.search-form {
  margin-bottom: 20px;
  padding: 20px;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.note-title {
  font-weight: 500;
  color: #303133;
}

.author-info {
  display: flex;
  align-items: center;
}

.note-detail {
  max-height: 600px;
  overflow-y: auto;
}

.note-illegal-section {
  margin-top: 20px;
}

.note-illegal-section h4 {
  margin-bottom: 10px;
  color: #303133;
  font-size: 16px;
}

/* 表格行悬停效果 */
:deep(.el-table__row) {
  cursor: pointer;
}

:deep(.el-table__row:hover) {
  background-color: #f5f7fa;
}
</style> 