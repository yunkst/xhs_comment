<template>
  <div class="network-data-view">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2>网络数据监控</h2>
      <p class="page-description">监控插件抓取到的网络请求数据，实时查看数据采集情况</p>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-grid">
      <el-card class="stats-card">
        <div class="stats-content">
          <div class="stats-number">{{ totalRequests }}</div>
          <div class="stats-label">总请求数</div>
        </div>
        <el-icon class="stats-icon primary"><DataBoard /></el-icon>
      </el-card>
      
      <el-card class="stats-card">
        <div class="stats-content">
          <div class="stats-number">{{ todayRequests }}</div>
          <div class="stats-label">今日请求数</div>
        </div>
        <el-icon class="stats-icon success"><TrendCharts /></el-icon>
      </el-card>
      
      <el-card class="stats-card">
        <div class="stats-content">
          <div class="stats-number">{{ activeRules }}</div>
          <div class="stats-label">活跃规则数</div>
        </div>
        <el-icon class="stats-icon info"><Setting /></el-icon>
      </el-card>
      
      <el-card class="stats-card">
        <div class="stats-content">
          <div class="stats-number">{{ recentHourRequests }}</div>
          <div class="stats-label">近1小时请求</div>
        </div>
        <el-icon class="stats-icon warning"><Clock /></el-icon>
      </el-card>
    </div>

    <!-- 过滤工具栏 -->
    <div class="filter-toolbar">
      <div class="filter-left">
        <el-select 
          v-model="filters.rule_name" 
          placeholder="选择规则" 
          clearable
          style="width: 200px"
          @change="loadData"
        >
          <el-option 
            v-for="rule in availableRules" 
            :key="rule" 
            :label="rule" 
            :value="rule"
          />
        </el-select>
        
        <el-select 
          v-model="filters.data_type" 
          placeholder="数据类型" 
          clearable
          style="width: 150px"
          @change="loadData"
        >
          <el-option label="评论" value="comment" />
          <el-option label="通知" value="notification" />
          <el-option label="用户" value="user" />
          <el-option label="笔记" value="note" />
          <el-option label="搜索" value="search" />
          <el-option label="推荐" value="recommendation" />
        </el-select>
        
        <el-date-picker
          v-model="filters.date_range"
          type="datetimerange"
          range-separator="至"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
          format="YYYY-MM-DD HH:mm:ss"
          value-format="YYYY-MM-DD HH:mm:ss"
          @change="loadData"
          style="width: 350px"
        />
      </div>
      
      <div class="filter-right">
        <el-button icon="Refresh" @click="loadData">刷新</el-button>
        <el-button 
          icon="Download" 
          @click="exportData"
          :loading="exporting"
        >
          导出
        </el-button>
      </div>
    </div>

    <!-- 数据表格 -->
    <div class="table-container">
      <el-table 
        :data="networkDataList" 
        v-loading="loading"
        stripe
        border
        style="width: 100%"
        :height="500"
      >
        <el-table-column prop="rule_name" label="规则名称" width="120">
          <template #default="{ row }">
            <el-tag size="small">{{ row.rule_name }}</el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="url" label="请求URL" min-width="250">
          <template #default="{ row }">
            <el-text class="url-text" :title="row.url">
              {{ truncateUrl(row.url) }}
            </el-text>
          </template>
        </el-table-column>
        
        <el-table-column prop="method" label="方法" width="80" align="center">
          <template #default="{ row }">
            <el-tag 
              :type="getMethodColor(row.method)" 
              size="small"
            >
              {{ row.method }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="status_code" label="状态码" width="100" align="center">
          <template #default="{ row }">
            <el-tag 
              :type="getStatusColor(row.status_code)" 
              size="small"
            >
              {{ row.status_code }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="data_size" label="数据大小" width="100" align="center">
          <template #default="{ row }">
            <el-text>{{ formatBytes(row.data_size) }}</el-text>
          </template>
        </el-table-column>
        
        <el-table-column prop="received_at" label="接收时间" width="160">
          <template #default="{ row }">
            <el-text>{{ formatDateTime(row.received_at) }}</el-text>
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button 
              type="primary" 
              text 
              size="small" 
              @click="viewDetails(row)"
            >
              查看详情
            </el-button>
            <el-button 
              type="info" 
              text 
              size="small" 
              @click="viewResponse(row)"
            >
              查看响应
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      
      <!-- 分页 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadData"
          @current-change="loadData"
        />
      </div>
    </div>

    <!-- 详情对话框 -->
    <el-dialog 
      title="网络请求详情" 
      v-model="detailDialogVisible" 
      width="800px"
      :close-on-click-modal="false"
    >
      <div v-if="selectedItem" class="detail-content">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="规则名称">
            <el-tag>{{ selectedItem.rule_name }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="数据类型">
            <el-tag type="info">{{ selectedItem.data_type }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="请求方法">
            <el-tag :type="getMethodColor(selectedItem.method)">
              {{ selectedItem.method }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="状态码">
            <el-tag :type="getStatusColor(selectedItem.status_code)">
              {{ selectedItem.status_code }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="数据大小">
            {{ formatBytes(selectedItem.data_size) }}
          </el-descriptions-item>
          <el-descriptions-item label="接收时间">
            {{ formatDateTime(selectedItem.received_at) }}
          </el-descriptions-item>
          <el-descriptions-item label="请求URL" :span="2">
            <el-text class="url-full">{{ selectedItem.url }}</el-text>
          </el-descriptions-item>
        </el-descriptions>
        
        <div class="detail-section">
          <h4>请求头</h4>
          <el-input
            v-model="selectedItem.headers"
            type="textarea"
            :rows="6"
            readonly
            placeholder="无请求头数据"
          />
        </div>
        
        <div class="detail-section">
          <h4>响应数据</h4>
          <el-input
            v-model="formatJsonData(selectedItem.response_data)"
            type="textarea"
            :rows="10"
            readonly
            placeholder="无响应数据"
          />
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
import { ElMessage } from 'element-plus'
import { 
  DataBoard, 
  TrendCharts, 
  Setting, 
  Clock 
} from '@element-plus/icons-vue'
import { networkDataApi } from '../../services/api'

// 响应式数据
const loading = ref(false)
const exporting = ref(false)
const networkDataList = ref([])
const detailDialogVisible = ref(false)
const selectedItem = ref(null)
const availableRules = ref([])

// 统计数据
const totalRequests = ref(0)
const todayRequests = ref(0)
const activeRules = ref(0)
const recentHourRequests = ref(0)

// 过滤条件
const filters = reactive({
  rule_name: '',
  data_type: '',
  date_range: []
})

// 分页参数
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

// 截断URL显示
const truncateUrl = (url) => {
  if (!url) return ''
  return url.length > 60 ? url.substring(0, 57) + '...' : url
}

// 获取HTTP方法颜色
const getMethodColor = (method) => {
  const colorMap = {
    GET: 'success',
    POST: 'primary',
    PUT: 'warning',
    DELETE: 'danger',
    PATCH: 'info'
  }
  return colorMap[method] || ''
}

// 获取状态码颜色
const getStatusColor = (statusCode) => {
  if (statusCode >= 200 && statusCode < 300) return 'success'
  if (statusCode >= 300 && statusCode < 400) return 'info'
  if (statusCode >= 400 && statusCode < 500) return 'warning'
  if (statusCode >= 500) return 'danger'
  return ''
}

// 格式化字节大小
const formatBytes = (bytes) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 格式化日期时间
const formatDateTime = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleString('zh-CN')
}

// 格式化JSON数据
const formatJsonData = (data) => {
  if (!data) return ''
  try {
    if (typeof data === 'string') {
      return JSON.stringify(JSON.parse(data), null, 2)
    }
    return JSON.stringify(data, null, 2)
  } catch (e) {
    return data
  }
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      page_size: pagination.pageSize,
      ...filters
    }
    
    // 处理日期范围
    if (filters.date_range && filters.date_range.length === 2) {
      params.start_time = filters.date_range[0]
      params.end_time = filters.date_range[1]
    }
    
    const response = await networkDataApi.getNetworkData(params)
    
    if (response.success) {
      networkDataList.value = response.data || []
      pagination.total = response.total || 0
      
      // 更新统计数据
      totalRequests.value = response.stats?.total || 0
      todayRequests.value = response.stats?.today || 0
      activeRules.value = response.stats?.active_rules || 0
      recentHourRequests.value = response.stats?.recent_hour || 0
      
      // 更新可用规则列表
      if (response.available_rules) {
        availableRules.value = response.available_rules
      }
    }
  } catch (error) {
    ElMessage.error('获取网络数据失败：' + (error.message || error))
  } finally {
    loading.value = false
  }
}

// 查看详情
const viewDetails = (item) => {
  selectedItem.value = item
  detailDialogVisible.value = true
}

// 查看响应数据
const viewResponse = (item) => {
  selectedItem.value = item
  detailDialogVisible.value = true
}

// 导出数据
const exportData = async () => {
  exporting.value = true
  try {
    const params = { ...filters, export: true }
    
    if (filters.date_range && filters.date_range.length === 2) {
      params.start_time = filters.date_range[0]
      params.end_time = filters.date_range[1]
    }
    
    // 这里可以实现导出功能
    ElMessage.success('导出功能开发中...')
  } catch (error) {
    ElMessage.error('导出失败：' + error.message)
  } finally {
    exporting.value = false
  }
}

// 组件挂载时加载数据
onMounted(() => {
  loadData()
})
</script>

<style scoped>
.network-data-view {
  padding: 20px;
}

.page-header {
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0 0 8px 0;
  color: #303133;
}

.page-description {
  margin: 0;
  color: #606266;
  font-size: 14px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.stats-card {
  border-radius: 8px;
}

.stats-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.stats-number {
  font-size: 24px;
  font-weight: bold;
  color: #303133;
  margin-bottom: 4px;
}

.stats-label {
  font-size: 14px;
  color: #606266;
}

.stats-icon {
  position: absolute;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 24px;
}

.stats-icon.primary {
  color: #409eff;
}

.stats-icon.success {
  color: #67c23a;
}

.stats-icon.info {
  color: #909399;
}

.stats-icon.warning {
  color: #e6a23c;
}

.filter-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 16px 20px;
  background: #f8f9fa;
  border-radius: 8px;
}

.filter-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.filter-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.table-container {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.url-text {
  font-family: Monaco, 'Courier New', monospace;
  font-size: 12px;
  color: #409eff;
}

.url-full {
  font-family: Monaco, 'Courier New', monospace;
  font-size: 12px;
  color: #409eff;
  word-break: break-all;
}

.pagination-container {
  padding: 20px;
  display: flex;
  justify-content: center;
}

.detail-content {
  max-height: 600px;
  overflow-y: auto;
}

.detail-section {
  margin-top: 20px;
}

.detail-section h4 {
  margin: 0 0 10px 0;
  color: #303133;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .network-data-view {
    padding: 12px;
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  
  .filter-toolbar {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .filter-left,
  .filter-right {
    justify-content: center;
  }
}
</style> 