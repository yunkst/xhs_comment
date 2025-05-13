<template>
  <div class="dashboard-container">
    <el-row :gutter="20">
      <el-col :span="6">
        <el-card class="box-card">
          <div class="card-header">
            <el-icon class="card-icon comment"><ChatDotRound /></el-icon>
            <div class="card-info">
              <div class="card-title">总评论数</div>
              <div class="card-value">{{ statistics.totalComments || 0 }}</div>
            </div>
          </div>
          <div class="card-footer">
            <span>较昨日 <span :class="statistics.commentsChange >= 0 ? 'up' : 'down'">{{ statistics.commentsChange >= 0 ? '+' : '' }}{{ statistics.commentsChange || 0 }}%</span></span>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="box-card">
          <div class="card-header">
            <el-icon class="card-icon user"><User /></el-icon>
            <div class="card-info">
              <div class="card-title">总用户数</div>
              <div class="card-value">{{ statistics.totalUsers || 0 }}</div>
            </div>
          </div>
          <div class="card-footer">
            <span>较昨日 <span :class="statistics.usersChange >= 0 ? 'up' : 'down'">{{ statistics.usersChange >= 0 ? '+' : '' }}{{ statistics.usersChange || 0 }}%</span></span>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="box-card">
          <div class="card-header">
            <el-icon class="card-icon pending"><Timer /></el-icon>
            <div class="card-info">
              <div class="card-title">待审核评论</div>
              <div class="card-value">{{ statistics.pendingComments || 0 }}</div>
            </div>
          </div>
          <div class="card-footer">
            <span>较昨日 <span :class="statistics.pendingChange >= 0 ? 'up' : 'down'">{{ statistics.pendingChange >= 0 ? '+' : '' }}{{ statistics.pendingChange || 0 }}%</span></span>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="box-card">
          <div class="card-header">
            <el-icon class="card-icon warning"><Warning /></el-icon>
            <div class="card-info">
              <div class="card-title">拦截评论</div>
              <div class="card-value">{{ statistics.blockedComments || 0 }}</div>
            </div>
          </div>
          <div class="card-footer">
            <span>较昨日 <span :class="statistics.blockedChange >= 0 ? 'up' : 'down'">{{ statistics.blockedChange >= 0 ? '+' : '' }}{{ statistics.blockedChange || 0 }}%</span></span>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="chart-row">
      <el-col :span="16">
        <el-card class="chart-card">
          <div class="chart-header">
            <h3>评论趋势</h3>
            <el-radio-group v-model="chartTimeRange" size="small" @change="fetchChartData">
              <el-radio-button label="week">近一周</el-radio-button>
              <el-radio-button label="month">近一月</el-radio-button>
              <el-radio-button label="year">近一年</el-radio-button>
            </el-radio-group>
          </div>
          <div class="chart-placeholder">
            <el-empty description="暂无图表数据" />
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="chart-card">
          <div class="chart-header">
            <h3>评论分类</h3>
          </div>
          <div class="chart-placeholder">
            <el-empty description="暂无图表数据" />
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="table-row">
      <el-col :span="24">
        <el-card class="table-card">
          <div class="table-header">
            <h3>最新评论</h3>
            <el-button type="primary" size="small" @click="fetchLatestComments">刷新</el-button>
          </div>
          <el-table :data="latestComments" style="width: 100%" v-loading="tableLoading">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="username" label="用户名" width="120" />
            <el-table-column prop="content" label="评论内容" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="scope">
                <el-tag :type="scope.row.status === '通过' ? 'success' : scope.row.status === '待审核' ? 'warning' : 'danger'">
                  {{ scope.row.status }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="createTime" label="创建时间" width="180" />
            <el-table-column label="操作" width="150">
              <template #default="scope">
                <el-button size="small" @click="handleView(scope.row)">查看</el-button>
                <el-button size="small" type="danger" @click="handleDelete(scope.row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { 
  ChatDotRound, 
  User, 
  Timer, 
  Warning
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { commentApi, userManagementApi, systemApi } from '../services/api'

const chartTimeRange = ref('week')
const tableLoading = ref(false)
const latestComments = ref([])

// 统计数据
const statistics = reactive({
  totalComments: 0,
  commentsChange: 0,
  totalUsers: 0,
  usersChange: 0,
  pendingComments: 0,
  pendingChange: 0,
  blockedComments: 0,
  blockedChange: 0
})

// 获取统计数据
const fetchStatistics = async () => {
  try {
    // 这里假设后端提供了获取统计数据的API
    // 如果没有，可以通过多个请求组合获取
    const response = await systemApi.getSystemSettings()
    if (response) {
      statistics.totalComments = response.totalComments || 0
      statistics.commentsChange = response.commentsChange || 0
      statistics.totalUsers = response.totalUsers || 0
      statistics.usersChange = response.usersChange || 0
      statistics.pendingComments = response.pendingComments || 0
      statistics.pendingChange = response.pendingChange || 0
      statistics.blockedComments = response.blockedComments || 0
      statistics.blockedChange = response.blockedChange || 0
    }
  } catch (error) {
    console.error('获取统计数据失败:', error)
  }
}

// 获取图表数据
const fetchChartData = async () => {
  try {
    // 根据选择的时间范围获取图表数据
    // 可根据后端API调整
    console.log(`获取${chartTimeRange.value}图表数据`)
  } catch (error) {
    console.error('获取图表数据失败:', error)
  }
}

// 获取最新评论
const fetchLatestComments = async () => {
  tableLoading.value = true
  try {
    const response = await commentApi.getCommentList({
      page: 1,
      pageSize: 5,
      sortBy: 'createTime',
      sortOrder: 'desc'
    })
    
    if (response && response.items) {
      latestComments.value = response.items
    } else {
      latestComments.value = []
    }
    
    ElMessage.success('刷新成功')
  } catch (error) {
    console.error('获取最新评论失败:', error)
    ElMessage.error('获取数据失败')
    latestComments.value = []
  } finally {
    tableLoading.value = false
  }
}

const handleView = (row) => {
  // 实现查看评论详情
  ElMessage.info(`查看评论：${row.id}`)
}

const handleDelete = (row) => {
  ElMessageBox.confirm(`确定要删除ID为 ${row.id} 的评论吗?`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    tableLoading.value = true
    try {
      await commentApi.deleteComment(row.id)
      ElMessage.success(`已删除评论: ${row.id}`)
      fetchLatestComments()
    } catch (error) {
      console.error('删除评论失败:', error)
      ElMessage.error('操作失败')
    } finally {
      tableLoading.value = false
    }
  }).catch(() => {})
}

// 初始加载数据
onMounted(() => {
  fetchStatistics()
  fetchChartData()
  fetchLatestComments()
})
</script>

<style scoped>
.dashboard-container {
  padding: 10px;
}

.box-card {
  height: 120px;
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  align-items: center;
}

.card-icon {
  font-size: 48px;
  margin-right: 20px;
  padding: 10px;
  border-radius: 8px;
}

.comment {
  background-color: rgba(64, 158, 255, 0.1);
  color: #409EFF;
}

.user {
  background-color: rgba(103, 194, 58, 0.1);
  color: #67C23A;
}

.pending {
  background-color: rgba(230, 162, 60, 0.1);
  color: #E6A23C;
}

.warning {
  background-color: rgba(245, 108, 108, 0.1);
  color: #F56C6C;
}

.card-info {
  flex: 1;
}

.card-title {
  font-size: 16px;
  color: #909399;
}

.card-value {
  font-size: 24px;
  font-weight: bold;
  margin-top: 5px;
}

.card-footer {
  margin-top: 20px;
  font-size: 14px;
  color: #909399;
}

.up {
  color: #67C23A;
}

.down {
  color: #F56C6C;
}

.chart-row, .table-row {
  margin-bottom: 20px;
}

.chart-card {
  min-height: 300px;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.chart-header h3 {
  margin: 0;
  font-size: 16px;
}

.chart-placeholder {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 250px;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.table-header h3 {
  margin: 0;
  font-size: 16px;
}
</style> 