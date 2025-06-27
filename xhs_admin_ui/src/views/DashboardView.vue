<template>
  <div class="dashboard-container">
    <el-row :gutter="20">
      <el-col :span="8">
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
      <el-col :span="8">
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
      <el-col :span="8">
        <el-card class="box-card">
          <div class="card-header">
            <el-icon class="card-icon reply"><Bell /></el-icon>
            <div class="card-info">
              <div class="card-title">待回复评论</div>
              <div class="card-value">{{ statistics.pendingReplyComments || 0 }}</div>
            </div>
          </div>
          <div class="card-footer">
            <span>较昨日 <span :class="statistics.pendingReplyChange >= 0 ? 'up' : 'down'">{{ statistics.pendingReplyChange >= 0 ? '+' : '' }}{{ statistics.pendingReplyChange || 0 }}%</span></span>
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
            <el-table-column prop="commentId" label="评论ID" width="200" />
            <el-table-column label="作者" width="180">
              <template #default="scope">
                <div style="display: flex; align-items: center;">
                  <el-avatar :size="30" :src="scope.row.authorAvatar" style="margin-right: 8px;">
                    <img src="https://cube.elemecdn.com/e/fd/0fc7d20532fdaf769a25683617711png.png"/>
                  </el-avatar>
                  <span>{{ scope.row.authorName }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="content" label="评论内容" min-width="250" show-overflow-tooltip/>
            <el-table-column prop="noteId" label="笔记ID" width="200" />
            <el-table-column prop="timestamp" label="评论时间" width="180">
              <template #default="scope">
                {{ formatDateTime(scope.row.timestamp) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="scope">
                <el-button size="small" @click="handleViewCommentDetails(scope.row)">查看</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <!-- 评论详情对话框 (可以复用 CommentListView 的或新建一个简化的) -->
    <el-dialog v-model="commentDialogVisible" title="评论详情" width="600px">
      <el-descriptions :column="1" border v-if="currentDetailComment && Object.keys(currentDetailComment).length > 0">
        <el-descriptions-item label="评论ID">{{ currentDetailComment.commentId }}</el-descriptions-item>
        <el-descriptions-item label="作者ID">{{ currentDetailComment.authorId }}</el-descriptions-item>
        <el-descriptions-item label="作者名称">{{ currentDetailComment.authorName }}</el-descriptions-item>
        <el-descriptions-item label="笔记ID">{{ currentDetailComment.noteId }}</el-descriptions-item>
        <el-descriptions-item label="评论内容">
          <div style="white-space: pre-wrap;">{{ currentDetailComment.content }}</div>
        </el-descriptions-item>
        <el-descriptions-item label="评论时间">{{ formatDateTime(currentDetailComment.timestamp) }}</el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="commentDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { 
  ChatDotRound, 
  User, 
  Bell
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { commentApi } from '../services/api'

const chartTimeRange = ref('week')
const tableLoading = ref(false)
const latestComments = ref([])
const commentDialogVisible = ref(false)
const currentDetailComment = ref({})

const statistics = reactive({
  totalComments: 0,
  commentsChange: 0,
  totalUsers: 0,
  usersChange: 0,
  pendingReplyComments: 0,
  pendingReplyChange: 0
})

const fetchStatistics = async () => {
  try {
    // 只使用评论统计接口
    const commentsStats = await commentApi.getCommentsStats()
    
    if (commentsStats) {
      statistics.totalComments = commentsStats.stats?.total?.comments || 0
      statistics.commentsChange = commentsStats.stats?.period?.today || 0
      statistics.pendingReplyComments = commentsStats.stats?.period?.week || 0
      statistics.pendingReplyChange = commentsStats.stats?.period?.yesterday || 0
      // 暂时用评论数据模拟用户数据
      statistics.totalUsers = Math.floor((commentsStats.stats?.total?.comments || 0) / 10)
      statistics.usersChange = Math.floor((commentsStats.stats?.period?.today || 0) / 5)
    }
  } catch (error) {
    console.error('获取统计数据失败:', error)
    ElMessage.error(error.response?.data?.detail || error.message || '获取统计数据失败');
  }
}

const fetchChartData = async () => {
  console.log(`获取${chartTimeRange.value}图表数据`)
}

const fetchLatestComments = async () => {
  tableLoading.value = true
  try {
    const response = await commentApi.getCommentList({
      page: 1,
      page_size: 5,
    })
    
    if (response && response.items) {
      latestComments.value = response.items
    } else {
      latestComments.value = []
    }
  } catch (error) {
    console.error('获取最新评论失败:', error)
    ElMessage.error(error.response?.data?.detail || error.message || '获取最新评论失败')
    latestComments.value = []
  } finally {
    tableLoading.value = false
  }
}

const formatDateTime = (dateTimeStr) => {
  if (!dateTimeStr) return '-';
  try {
    const date = new Date(dateTimeStr);
    if (isNaN(date.getTime())) return dateTimeStr;
    return date.toLocaleString('zh-CN', { hour12: false });
  } catch (e) {
    return dateTimeStr;
  }
}

const handleViewCommentDetails = (row) => {
  currentDetailComment.value = { ...row };
  commentDialogVisible.value = true;
}

onMounted(() => {
  fetchStatistics()
  fetchChartData()
  fetchLatestComments()
})
</script>

<style scoped>
.dashboard-container {
  width: 100%;
}

.box-card {
  height: 120px;
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  height: 60px;
}

.card-icon {
  font-size: 36px;
  margin-right: 15px;
  padding: 10px;
  border-radius: 8px;
  color: #fff;
}

.comment {
  background-color: #67C23A;
}

.user {
  background-color: #409EFF;
}

.reply {
  background-color: #E6A23C;
}

.card-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.card-title {
  font-size: 14px;
  color: #909399;
  margin-bottom: 5px;
}

.card-value {
  font-size: 24px;
  font-weight: bold;
  color: #303133;
}

.card-footer {
  margin-top: 10px;
  font-size: 12px;
  color: #C0C4CC;
  border-top: 1px solid #EBEEF5;
  padding-top: 10px;
  text-align: center;
}

.card-footer .up {
  color: #F56C6C;
}

.card-footer .down {
  color: #67C23A;
}

.chart-row, .table-row {
  margin-top: 20px;
}

.chart-card, .table-card {
}

.chart-card .chart-header, .table-card .table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 15px;
  margin-bottom: 15px;
  border-bottom: 1px solid #EBEEF5;
}

.chart-card .chart-header h3, .table-card .table-header h3 {
  margin: 0;
  font-size: 16px;
}

.chart-placeholder {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 300px;
  color: #909399;
}
</style> 