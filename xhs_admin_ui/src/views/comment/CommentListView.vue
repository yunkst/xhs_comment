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
        <el-table-column prop="commentId" label="评论ID" width="200" />
        <el-table-column prop="content" label="评论内容" width="300">
          <template #default="scope">
            <div class="comment-content">
              {{ scope.row.content }}
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="userId" label="用户ID" width="150" />
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="scope">
            {{ formatDateTime(scope.row.createdAt) }}
            </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
            <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)">
              {{ scope.row.status || '待审核' }}
            </el-tag>
            </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="scope">
            <el-button size="small" @click="handleViewComment(scope.row)">查看</el-button>
            <el-button size="small" type="success" @click="handleApprove(scope.row)" v-if="scope.row.status !== '通过'">通过</el-button>
            <el-button size="small" type="danger" @click="handleDelete(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <div class="batch-actions">
          <el-button 
            type="success" 
            @click="handleBatchApprove" 
            :disabled="selectedComments.length === 0"
          >
            批量通过 ({{ selectedComments.length }})
          </el-button>
          <el-button 
            type="danger" 
            @click="handleBatchDelete" 
            :disabled="selectedComments.length === 0"
          >
            批量删除 ({{ selectedComments.length }})
          </el-button>
        </div>
      </div>

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
      <div v-if="currentComment" class="comment-detail">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="评论ID">
            {{ currentComment.commentId || currentComment.id }}
          </el-descriptions-item>
          <el-descriptions-item label="用户ID">
            {{ currentComment.userId || currentComment.authorId }}
          </el-descriptions-item>
          <el-descriptions-item label="用户名称">
            {{ currentComment.userName || currentComment.authorName || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="评论内容">
            <div class="comment-content-detail">
              {{ currentComment.content }}
            </div>
          </el-descriptions-item>
          <el-descriptions-item label="笔记ID">
            {{ currentComment.noteId || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ formatDateTime(currentComment.createdAt || currentComment.timestamp) }}
          </el-descriptions-item>
          <el-descriptions-item label="获取时间">
            {{ formatDateTime(currentComment.fetchTimestamp || currentComment.updatedAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="当前状态">
            <el-select v-model="currentComment.status" placeholder="选择状态">
              <el-option label="待审核" value="待审核" />
              <el-option label="通过" value="通过" />
              <el-option label="拦截" value="拦截" />
            </el-select>
        </el-descriptions-item>
      </el-descriptions>
      </div>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSaveComment">保存状态</el-button>
        </span>
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

// 获取状态类型
const getStatusType = (status) => {
  switch (status) {
    case '通过': return 'success'
    case '拦截': return 'danger'
    case '待审核': return 'warning'
    default: return 'info'
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

// 处理批量通过
const handleBatchApprove = async () => {
  if (selectedComments.value.length === 0) {
    ElMessage.warning('请先选择要操作的评论')
    return
  }
  
  const commentIds = selectedComments.value.map(item => item.commentId || item.id)
  
  try {
    await ElMessageBox.confirm(`确定要批量通过这 ${selectedComments.value.length} 条评论吗?`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    await commentApi.batchUpdateStatus(commentIds, '通过')
    ElMessage.success('批量通过成功')
    getCommentList()
    
  } catch (error) {
    if (error !== 'cancel') {
      console.error('批量通过失败:', error)
      ElMessage.error(error.response?.data?.detail || '批量通过失败')
    }
  }
}

// 处理批量删除
const handleBatchDelete = async () => {
  if (selectedComments.value.length === 0) {
    ElMessage.warning('请先选择要删除的评论')
    return
  }
  
  const commentIds = selectedComments.value.map(item => item.commentId || item.id)
  
  try {
    await ElMessageBox.confirm(`确定要批量删除这 ${selectedComments.value.length} 条评论吗？此操作不可恢复。`, '警告', {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    await commentApi.batchDelete(commentIds)
    ElMessage.success('批量删除成功')
    getCommentList()
    
  } catch (error) {
    if (error !== 'cancel') {
      console.error('批量删除失败:', error)
      ElMessage.error(error.response?.data?.detail || '批量删除失败')
    }
  }
}

// 单条通过
const handleApprove = async (row) => {
  const commentId = row.commentId || row.id
  
  try {
    await commentApi.updateCommentStatus(commentId, '通过')
    ElMessage.success('评论通过成功')
    getCommentList()
  } catch (error) {
    console.error('评论通过失败:', error)
    ElMessage.error(error.response?.data?.detail || '评论通过失败')
  }
}

// 单条删除
const handleDelete = async (row) => {
  const commentId = row.commentId || row.id
  
  try {
    await ElMessageBox.confirm('确定要删除这条评论吗？此操作不可恢复。', '警告', {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    await commentApi.deleteComment(commentId)
    ElMessage.success('评论删除成功')
    getCommentList()
    
  } catch (error) {
    if (error !== 'cancel') {
      console.error('评论删除失败:', error)
      ElMessage.error(error.response?.data?.detail || '评论删除失败')
    }
  }
}

// 保存评论状态 (对话框中)
const handleSaveComment = async () => {
  if (!currentComment.value || !(currentComment.value.commentId || currentComment.value.id)) {
    ElMessage.error('评论信息无效')
    return
  }
  
  const commentId = currentComment.value.commentId || currentComment.value.id
  
  try {
    await commentApi.updateCommentStatus(commentId, currentComment.value.status)
    ElMessage.success('评论状态更新成功')
  dialogVisible.value = false
  getCommentList()
  } catch (error) {
    console.error('评论状态更新失败:', error)
    ElMessage.error(error.response?.data?.detail || '评论状态更新失败')
  }
}

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

.table-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 15px;
}

.batch-actions {
  display: flex;
  gap: 10px;
}

.comment-content {
  max-width: 300px;
  word-break: break-word;
  line-height: 1.4;
  max-height: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.comment-content-detail {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
  max-height: 200px;
  overflow-y: auto;
  padding: 10px;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.comment-detail {
  max-height: 60vh;
  overflow-y: auto;
}
</style> 