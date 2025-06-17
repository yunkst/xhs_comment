<template>
  <div class="comment-list-container">
    <el-card class="search-card">
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="关键词">
          <el-input v-model="searchForm.keyword" placeholder="评论内容/作者名/作者ID/笔记ID" clearable />
        </el-form-item>
        <el-form-item label="评论时间范围">
          <el-date-picker
            v-model="searchForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
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
          <el-button 
            type="danger" 
            @click="handleBatchDelete" 
            :disabled="selectedComments.length === 0"
          >
            批量删除 ({{ selectedComments.length }})
          </el-button>
        </div>
      </div>

      <el-table
        :data="commentList"
        style="width: 100%"
        v-loading="loading"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="authorAvatar" label="作者" width="120">
          <template #default="scope">
            <div class="author-info">
              <el-avatar :src="scope.row.authorAvatar" size="small"></el-avatar>
              <span style="margin-left: 10px">{{ scope.row.authorName }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="content" label="评论内容" min-width="300">
          <template #default="scope">
            <div class="comment-content">
              {{ scope.row.content }}
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="timestamp" label="评论时间" width="180">
          <template #default="scope">
            {{ formatDateTime(scope.row.timestamp) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="scope">
            <el-button size="small" @click="handleViewComment(scope.row)">查看详情</el-button>
            <el-button size="small" type="danger" @click="handleDelete(scope.row)">删除</el-button>
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
      <div v-if="currentComment" class="comment-detail">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="评论ID">
            {{ currentComment.id }}
          </el-descriptions-item>
          <el-descriptions-item label="作者ID">
            {{ currentComment.authorId }}
          </el-descriptions-item>
          <el-descriptions-item label="作者名称">
            {{ currentComment.authorName || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="评论内容">
            <div class="comment-content-detail">
              {{ currentComment.content }}
            </div>
          </el-descriptions-item>
          <el-descriptions-item label="所属笔记ID">
            {{ currentComment.noteId || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="评论时间">
            {{ formatDateTime(currentComment.timestamp) }}
          </el-descriptions-item>
          <el-descriptions-item label="数据获取时间">
            {{ formatDateTime(currentComment.fetchTimestamp) }}
          </el-descriptions-item>
          <el-descriptions-item label="被回复的评论" v-if="currentComment.target_comment">
             <pre>{{ JSON.stringify(currentComment.target_comment, null, 2) }}</pre>
          </el-descriptions-item>
        </el-descriptions>
      </div>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">关闭</el-button>
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
  dateRange: []
})

// 表格数据
const loading = ref(false)
const commentList = ref([])
const selectedComments = ref([])
const pagination = reactive({
    currentPage: 1,
    pageSize: 10,
    total: 0
})

// 当前查看的评论
const dialogVisible = ref(false)
const currentComment = ref(null)

// 获取评论列表数据
const getCommentList = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.currentPage,
      page_size: pagination.pageSize,
      keyword: searchForm.keyword || undefined,
    }
    if (searchForm.dateRange && searchForm.dateRange.length === 2) {
      params.startDate = searchForm.dateRange[0]
      params.endDate = searchForm.dateRange[1]
    }
    
    const response = await commentApi.getCommentList(params)
    if (response && response.items) { 
      commentList.value = response.items
      pagination.total = response.total
      ElMessage.success(`成功获取 ${response.items.length} 条评论数据。`);
    } else {
      ElMessage.error(response.message || '获取评论列表失败，数据格式不正确');
      commentList.value = []
      pagination.total = 0
    }
  } catch (error) {
    console.error('获取评论列表失败:', error)
    const message = error?.response?.data?.detail || error.message || '获取评论列表失败'
    ElMessage.error(message)
    commentList.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

// 格式化日期时间
const formatDateTime = (dateTimeStr) => {
  if (!dateTimeStr) return 'N/A';
  const date = new Date(dateTimeStr);
  if (isNaN(date.getTime())) return 'Invalid Date';
  return date.toLocaleString();
}

// 搜索
const handleSearch = () => {
  pagination.currentPage = 1;
  getCommentList();
}

// 重置搜索
const resetSearch = () => {
  searchForm.keyword = ''
  searchForm.dateRange = []
  handleSearch()
}

// 刷新
const refreshTable = () => {
  getCommentList()
}

// 表格选择
const handleSelectionChange = (val) => {
  selectedComments.value = val
}

// 查看详情
const handleViewComment = (comment) => {
  currentComment.value = comment
  dialogVisible.value = true
}

// 删除评论
const handleDelete = async (comment) => {
  await ElMessageBox.confirm('确定要删除这条评论吗?', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })
  try {
    await commentApi.deleteComment(comment._id)
    ElMessage.success('删除成功')
    getCommentList()
  } catch (error) {
    const message = error?.response?.data?.detail || '删除失败'
    ElMessage.error(message)
  }
}

// 批量删除
const handleBatchDelete = async () => {
  if (selectedComments.value.length === 0) {
    ElMessage.warning('请先选择要删除的评论')
    return
  }
  await ElMessageBox.confirm(`确定要删除选中的 ${selectedComments.value.length} 条评论吗?`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })
  try {
    const ids = selectedComments.value.map(item => item._id)
    await commentApi.batchDelete(ids)
    ElMessage.success('批量删除成功')
    getCommentList()
  } catch (error) {
    const message = error?.response?.data?.detail || '批量删除失败'
    ElMessage.error(message)
  }
}

// 分页处理
const handleSizeChange = (size) => {
  pagination.pageSize = size
  getCommentList()
}
const handleCurrentChange = (page) => {
  pagination.currentPage = page
  getCommentList()
}

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
.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
.author-info {
  display: flex;
  align-items: center;
}
.comment-content-detail {
  white-space: pre-wrap;
  word-break: break-all;
}
</style> 