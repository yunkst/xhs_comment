<template>
  <div class="comment-list-container">
    <el-card class="search-card">
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="关键词">
          <el-input v-model="searchForm.keyword" placeholder="评论内容/作者名/作者ID/笔记ID" clearable />
        </el-form-item>
        <!-- <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择状态" clearable>
            <el-option label="通过" value="通过" />
            <el-option label="待审核" value="待审核" />
            <el-option label="拦截" value="拦截" />
          </el-select>
        </el-form-item> -->
        <el-form-item label="评论时间范围">
          <el-date-picker
            v-model="searchForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            :picker-options="pickerOptions"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="table-card">
      <div class="table-header">
        <h3>评论列表</h3>
        <div class="table-operations">
          <!-- <el-button type="primary" @click="handleBatchApprove" :disabled="selectedComments.length === 0">
            批量通过
          </el-button>
          <el-button type="danger" @click="handleBatchDelete" :disabled="selectedComments.length === 0">
            批量删除
          </el-button> -->
          <el-button @click="refreshTable">刷新</el-button>
        </div>
      </div>

      <el-table
        :data="commentList"
        style="width: 100%"
        v-loading="loading"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <!-- <el-table-column prop="commentId" label="评论ID" width="220" /> -->
        <el-table-column prop="authorId" label="作者ID" width="220" />
        <el-table-column label="作者头像" width="100">
          <template #default="scope">
            <el-avatar :size="40" :src="scope.row.authorAvatar">
              <img src="https://cube.elemecdn.com/e/fd/0fc7d20532fdaf769a25683617711png.png"/>
            </el-avatar>
          </template>
        </el-table-column>
        <el-table-column prop="authorName" label="作者名称" width="150" />
        <el-table-column prop="content" label="评论内容" min-width="250" show-overflow-tooltip />
        <el-table-column prop="noteId" label="笔记ID" width="220" />
        <!-- <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.status === '通过' ? 'success' : scope.row.status === '待审核' ? 'warning' : 'danger'">
              {{ scope.row.status }}
            </el-tag>
          </template>
        </el-table-column> -->
        <el-table-column prop="timestamp" label="评论时间" width="180">
            <template #default="scope">
                {{ formatDateTime(scope.row.timestamp) }}
            </template>
        </el-table-column>
        <el-table-column prop="fetchTimestamp" label="获取时间" width="180">
            <template #default="scope">
                {{ formatDateTime(scope.row.fetchTimestamp) }}
            </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="scope">
            <el-button size="small" @click="handleViewComment(scope.row)">查看</el-button>
            <!-- <el-button
              size="small"
              type="success"
              v-if="scope.row.status !== '通过'"
              @click="handleApprove(scope.row)"
            >
              通过
            </el-button>
            <el-button size="small" type="danger" @click="handleDelete(scope.row)">删除</el-button> -->
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-container">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next, jumper"
          :current-page="pagination.currentPage"
          :page-sizes="[10, 20, 50, 100]"
          :page-size="pagination.pageSize"
          :total="pagination.total"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>

    <!-- 评论详情对话框 -->
    <el-dialog v-model="dialogVisible" title="评论详情" width="600px">
      <el-descriptions :column="1" border v-if="currentComment && Object.keys(currentComment).length > 0">
        <el-descriptions-item label="评论ID">{{ currentComment.commentId }}</el-descriptions-item>
        <el-descriptions-item label="作者ID">{{ currentComment.authorId }}</el-descriptions-item>
        <el-descriptions-item label="作者名称">{{ currentComment.authorName }}</el-descriptions-item>
        <el-descriptions-item label="作者头像">
          <el-avatar :size="60" :src="currentComment.authorAvatar">
            <img src="https://cube.elemecdn.com/e/fd/0fc7d20532fdaf769a25683617711png.png"/>
          </el-avatar>
        </el-descriptions-item>
        <el-descriptions-item label="笔记ID">{{ currentComment.noteId }}</el-descriptions-item>
        <el-descriptions-item label="评论内容">
          <div style="white-space: pre-wrap;">{{ currentComment.content }}</div>
        </el-descriptions-item>
        <el-descriptions-item label="评论时间">{{ formatDateTime(currentComment.timestamp) }}</el-descriptions-item>
        <el-descriptions-item label="获取时间">{{ formatDateTime(currentComment.fetchTimestamp) }}</el-descriptions-item>
        <el-descriptions-item label="回复评论ID" v-if="currentComment.repliedId">{{ currentComment.repliedId }}</el-descriptions-item>
      </el-descriptions>
      <div v-else>
        <p>暂无评论详情</p>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false">关闭</el-button>
          <!-- <el-button type="primary" @click="handleSaveComment">保存状态</el-button> -->
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { commentApi } from '../../services/api'

// 搜索表单
const searchForm = reactive({
  keyword: '',
  // status: '', // 暂时移除status，因为后端数据中不包含此字段
  dateRange: []
})

const pickerOptions = {
  shortcuts: [{
    text: '最近一周',
    onClick(picker) {
      const end = new Date();
      const start = new Date();
      start.setTime(start.getTime() - 3600 * 1000 * 24 * 7);
      picker.$emit('pick', [start, end]);
    }
  }, {
    text: '最近一个月',
    onClick(picker) {
      const end = new Date();
      const start = new Date();
      start.setTime(start.getTime() - 3600 * 1000 * 24 * 30);
      picker.$emit('pick', [start, end]);
    }
  }, {
    text: '最近三个月',
    onClick(picker) {
      const end = new Date();
      const start = new Date();
      start.setTime(start.getTime() - 3600 * 1000 * 24 * 90);
      picker.$emit('pick', [start, end]);
    }
  }]
}

// 表格数据
const loading = ref(false)
const commentList = ref([])
const selectedComments = ref([]) // 即使移除了批量操作，保留以防未来使用
const pagination = reactive({
    currentPage: 1,
    pageSize: 10,
    total: 0
})

// 当前查看的评论
const dialogVisible = ref(false)
const currentComment = ref({})

// 获取评论列表数据
const getCommentList = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.currentPage,
      page_size: pagination.pageSize, // 确保参数名与后端一致
      keyword: searchForm.keyword || undefined,
      // status: searchForm.status || undefined, // 暂时移除
    }
    if (searchForm.dateRange && searchForm.dateRange.length === 2) {
      params.startDate = searchForm.dateRange[0]
      params.endDate = searchForm.dateRange[1]
    }
    
    const response = await commentApi.getCommentList(params)
    // 注意：api.js中的响应拦截器已返回 response.data，所以这里response就是后端返回的完整对象
    if (response && response.items) { 
      commentList.value = response.items
      pagination.total = response.total
    } else {
      ElMessage.error(response.message || '获取评论列表失败，数据格式不正确');
      commentList.value = []
      pagination.total = 0
    }
  } catch (error) {
    console.error('获取评论列表失败:', error)
    const message = error.response?.data?.detail || error.message || '获取评论列表失败'
    ElMessage.error(message)
    commentList.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

// 格式化日期时间
const formatDateTime = (dateTimeStr) => {
  if (!dateTimeStr) return '-';
  try {
    const date = new Date(dateTimeStr);
    if (isNaN(date.getTime())) {
        return dateTimeStr; // 如果解析无效，返回原始字符串
    }
    return date.toLocaleString('zh-CN', { hour12: false });
  } catch (e) {
    return dateTimeStr; // 解析出错则返回原始值
  }
}

// 搜索
const handleSearch = () => {
  pagination.currentPage = 1
  getCommentList()
}

// 重置搜索条件
const resetSearch = () => {
  searchForm.keyword = ''
  // searchForm.status = ''
  searchForm.dateRange = []
  handleSearch()
}

// 刷新表格
const refreshTable = () => {
  getCommentList()
}

// 处理批量选择变化
const handleSelectionChange = (selection) => {
  selectedComments.value = selection
}

// 查看评论详情
const handleViewComment = (row) => {
  currentComment.value = { ...row }
  dialogVisible.value = true
}

/* // 暂时注释掉状态管理和删除逻辑，因为后端数据结构不包含status，且删除/更新状态API需确认
// 处理批量通过
const handleBatchApprove = () => {
  const commentIds = selectedComments.value.map(item => item.commentId) // 使用 commentId
  ElMessageBox.confirm(`确定要批量通过这 ${selectedComments.value.length} 条评论吗?`, '提示', {
    // ... 省略 ...
  }).then(async () => {
    // await commentApi.batchUpdateStatus(commentIds, '通过') // 假设后端有此接口
    // ... 省略 ...
  }).catch(() => {})
}

// 处理批量删除
const handleBatchDelete = () => {
  const commentIds = selectedComments.value.map(item => item.commentId) // 使用 commentId
  ElMessageBox.confirm(`确定要批量删除这 ${selectedComments.value.length} 条评论吗?`, '提示', {
    // ... 省略 ...
  }).then(async () => {
    // await commentApi.batchDelete(commentIds)
    // ... 省略 ...
  }).catch(() => {})
}

// 单条通过
const handleApprove = async (row) => {
    // await commentApi.updateCommentStatus(row.commentId, '通过') // 假设后端有此接口
    // ... 省略 ...
}

// 单条删除
const handleDelete = async (row) => {
    // await commentApi.deleteComment(row.commentId)
    // ... 省略 ...
}

// 保存评论状态 (对话框中)
const handleSaveComment = async () => {
  if (!currentComment.value || !currentComment.value.commentId) return;
  // await commentApi.updateCommentStatus(currentComment.value.commentId, currentComment.value.status)
  // ... 省略 ...
  dialogVisible.value = false
  getCommentList()
}
*/

// 分页处理
const handleSizeChange = (val) => {
  pagination.pageSize = val
  pagination.currentPage = 1
  getCommentList()
}

const handleCurrentChange = (val) => {
  pagination.currentPage = val
  getCommentList()
}

// 组件挂载时获取初始数据
onMounted(() => {
  getCommentList()
})
</script>

<style scoped>
.comment-list-container {
  padding: 20px;
}

.search-card {
  margin-bottom: 20px;
}

.search-form .el-form-item {
  margin-bottom: 0; /* 减少搜索表单项的底部间距 */
}

.table-card .table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.table-card .table-header h3 {
  margin: 0;
  font-size: 18px;
}

.pagination-container {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}
</style> 