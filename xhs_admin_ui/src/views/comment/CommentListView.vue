<template>
  <div class="comment-list-container">
    <el-card class="search-card">
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="关键词">
          <el-input v-model="searchForm.keyword" placeholder="评论内容/用户名" clearable />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择状态" clearable>
            <el-option label="通过" value="通过" />
            <el-option label="待审核" value="待审核" />
            <el-option label="拦截" value="拦截" />
          </el-select>
        </el-form-item>
        <el-form-item label="时间范围">
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
          <el-button type="primary" @click="handleBatchApprove" :disabled="selectedComments.length === 0">
            批量通过
          </el-button>
          <el-button type="danger" @click="handleBatchDelete" :disabled="selectedComments.length === 0">
            批量删除
          </el-button>
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
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="username" label="用户名" width="120" />
        <el-table-column prop="content" label="评论内容" min-width="300" show-overflow-tooltip />
        <el-table-column prop="articleTitle" label="文章标题" min-width="200" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.status === '通过' ? 'success' : scope.row.status === '待审核' ? 'warning' : 'danger'">
              {{ scope.row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="180" />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="scope">
            <el-button size="small" @click="handleEdit(scope.row)">查看</el-button>
            <el-button
              size="small"
              type="success"
              v-if="scope.row.status !== '通过'"
              @click="handleApprove(scope.row)"
            >
              通过
            </el-button>
            <el-button size="small" type="danger" @click="handleDelete(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-container">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next, jumper"
          :current-page="currentPage"
          :page-sizes="[10, 20, 50, 100]"
          :page-size="pageSize"
          :total="total"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>

    <!-- 评论详情对话框 -->
    <el-dialog v-model="dialogVisible" title="评论详情" width="600px">
      <el-form label-width="100px" :model="currentComment">
        <el-form-item label="用户名">
          <span>{{ currentComment.username }}</span>
        </el-form-item>
        <el-form-item label="文章标题">
          <span>{{ currentComment.articleTitle }}</span>
        </el-form-item>
        <el-form-item label="评论内容">
          <el-input
            type="textarea"
            v-model="currentComment.content"
            :rows="4"
            readonly
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="currentComment.status">
            <el-option label="通过" value="通过" />
            <el-option label="待审核" value="待审核" />
            <el-option label="拦截" value="拦截" />
          </el-select>
        </el-form-item>
        <el-form-item label="创建时间">
          <span>{{ currentComment.createTime }}</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSaveComment">保存</el-button>
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
  status: '',
  dateRange: []
})

// 表格数据
const loading = ref(false)
const commentList = ref([])
const selectedComments = ref([])
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)

// 当前编辑的评论
const dialogVisible = ref(false)
const currentComment = ref({})

// 获取评论列表数据
const getCommentList = async () => {
  loading.value = true
  
  try {
    // 构建查询参数
    const params = {
      page: currentPage.value,
      pageSize: pageSize.value,
    }
    
    if (searchForm.keyword) {
      params.keyword = searchForm.keyword
    }
    
    if (searchForm.status) {
      params.status = searchForm.status
    }
    
    if (searchForm.dateRange && searchForm.dateRange.length === 2) {
      params.startDate = searchForm.dateRange[0]
      params.endDate = searchForm.dateRange[1]
    }
    
    // 调用API获取数据
    const response = await commentApi.getCommentList(params)
    
    commentList.value = response.items || []
    total.value = response.total || 0
  } catch (error) {
    console.error('获取评论列表失败:', error)
    ElMessage.error('获取评论列表失败')
    
    // 发生错误时显示空数据
    commentList.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

// 搜索
const handleSearch = () => {
  currentPage.value = 1
  getCommentList()
}

// 重置搜索条件
const resetSearch = () => {
  searchForm.keyword = ''
  searchForm.status = ''
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

// 处理批量通过
const handleBatchApprove = () => {
  const commentIds = selectedComments.value.map(item => item.id)
  
  ElMessageBox.confirm(`确定要批量通过这 ${selectedComments.value.length} 条评论吗?`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    loading.value = true
    try {
      await commentApi.batchUpdateStatus(commentIds, '通过')
      ElMessage.success(`已批量通过 ${selectedComments.value.length} 条评论`)
      getCommentList()
    } catch (error) {
      console.error('批量通过评论失败:', error)
      ElMessage.error('批量操作失败')
    } finally {
      loading.value = false
    }
  }).catch(() => {})
}

// 处理批量删除
const handleBatchDelete = () => {
  const commentIds = selectedComments.value.map(item => item.id)
  
  ElMessageBox.confirm(`确定要批量删除这 ${selectedComments.value.length} 条评论吗?`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    loading.value = true
    try {
      await commentApi.batchDelete(commentIds)
      ElMessage.success(`已批量删除 ${selectedComments.value.length} 条评论`)
      getCommentList()
    } catch (error) {
      console.error('批量删除评论失败:', error)
      ElMessage.error('批量操作失败')
    } finally {
      loading.value = false
    }
  }).catch(() => {})
}

// 处理单条通过
const handleApprove = (row) => {
  ElMessageBox.confirm(`确定要通过ID为 ${row.id} 的评论吗?`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    loading.value = true
    try {
      await commentApi.updateCommentStatus(row.id, '通过')
      ElMessage.success(`已通过评论: ${row.id}`)
      row.status = '通过'
    } catch (error) {
      console.error('通过评论失败:', error)
      ElMessage.error('操作失败')
    } finally {
      loading.value = false
    }
  }).catch(() => {})
}

// 处理单条删除
const handleDelete = (row) => {
  ElMessageBox.confirm(`确定要删除ID为 ${row.id} 的评论吗?`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    loading.value = true
    try {
      await commentApi.deleteComment(row.id)
      ElMessage.success(`已删除评论: ${row.id}`)
      getCommentList()
    } catch (error) {
      console.error('删除评论失败:', error)
      ElMessage.error('操作失败')
    } finally {
      loading.value = false
    }
  }).catch(() => {})
}

// 处理编辑
const handleEdit = (row) => {
  currentComment.value = { ...row }
  dialogVisible.value = true
}

// 保存评论修改
const handleSaveComment = async () => {
  loading.value = true
  try {
    await commentApi.updateCommentStatus(currentComment.value.id, currentComment.value.status)
    ElMessage.success(`保存成功: ${currentComment.value.id}`)
    dialogVisible.value = false
    getCommentList()
  } catch (error) {
    console.error('保存评论失败:', error)
    ElMessage.error('保存失败')
  } finally {
    loading.value = false
  }
}

// 处理页码变化
const handleCurrentChange = (val) => {
  currentPage.value = val
  getCommentList()
}

// 处理每页显示条数变化
const handleSizeChange = (val) => {
  pageSize.value = val
  currentPage.value = 1
  getCommentList()
}

// 初始加载
onMounted(() => {
  getCommentList()
})
</script>

<style scoped>
.comment-list-container {
  padding: 10px;
  width: 100%;
}

.search-card,
.table-card {
  margin-bottom: 20px;
  width: 100%;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  width: 100%;
}

.table-header h3 {
  margin: 0;
  font-size: 18px;
}

.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style> 