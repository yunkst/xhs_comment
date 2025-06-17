<template>
  <div class="xhs-user-list-container">
    <el-card class="search-card">
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="用户ID">
          <el-input v-model="searchForm.userId" placeholder="搜索用户ID" clearable />
        </el-form-item>
        <el-form-item label="用户名称">
          <el-input v-model="searchForm.name" placeholder="搜索用户名称" clearable />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="table-card">
      <div class="table-header">
        <h3>小红书用户列表</h3>
        <div class="table-operations">
          <el-button @click="fetchUsers">刷新</el-button>
        </div>
      </div>

      <el-table
        :data="userList"
        style="width: 100%"
        v-loading="loading"
      >
        <el-table-column prop="id" label="用户ID" width="200" />
        <el-table-column label="头像" width="80">
          <template #default="scope">
            <el-avatar 
              :src="scope.row.avatar" 
              :size="40"
              shape="circle"
            >
              <img src="https://cube.elemecdn.com/e/fd/0fc7d20532fdaf769a25683617711png.png" />
            </el-avatar>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="昵称" width="200" />
        <el-table-column prop="url" label="用户链接" min-width="300" show-overflow-tooltip />
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="scope">
            {{ formatDateTime(scope.row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="更新时间" width="180">
          <template #default="scope">
            {{ formatDateTime(scope.row.updatedAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="scope">
            <el-button size="small" type="info" @click="viewUserDetail(scope.row)">查看详情</el-button>
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

    <!-- 用户详情对话框 -->
    <el-dialog
      v-model="detailDialogVisible"
      title="用户详情"
      width="600px"
      destroy-on-close
    >
      <div v-if="selectedUser" class="user-detail">
        <div class="user-basic-info">
          <el-avatar 
            :src="selectedUser.avatar" 
            :size="80"
            shape="circle"
          >
            <img src="https://cube.elemecdn.com/e/fd/0fc7d20532fdaf769a25683617711png.png" />
          </el-avatar>
          <div class="user-info">
            <h3>{{ selectedUser.name }}</h3>
            <p>用户ID: {{ selectedUser.id }}</p>
            <p v-if="selectedUser.url">用户链接: {{ selectedUser.url }}</p>
          </div>
        </div>
        
        <el-descriptions title="详细信息" :column="2" border>
          <el-descriptions-item label="创建时间">
            {{ formatDateTime(selectedUser.createdAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="更新时间">
            {{ formatDateTime(selectedUser.updatedAt) }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { xhsUserApi } from '../../services/api' 

const searchForm = reactive({
  userId: '',
  name: ''
})

const loading = ref(false)
const userList = ref([])
const pagination = reactive({
  currentPage: 1,
  pageSize: 10,
  total: 0
})

const detailDialogVisible = ref(false)
const selectedUser = ref(null)

const fetchUsers = async () => {
  loading.value = true
  const params = {
    page: pagination.currentPage,
    page_size: pagination.pageSize
  }
  
  // 添加搜索条件
  if (searchForm.userId) {
    params.user_id = searchForm.userId
  }
  if (searchForm.name) {
    params.name = searchForm.name
  }
  
  try {
    const response = await xhsUserApi.getXhsUserList(params)
    if (response && response.data) {
      userList.value = response.data.items
      pagination.total = response.data.total
      ElMessage.success(`成功获取 ${response.data.items.length} 条小红书用户数据`)
    } else {
      ElMessage.error('获取小红书用户列表失败')
      userList.value = []
      pagination.total = 0
    }
  } catch (error) {
    console.error('获取小红书用户列表时出错:', error)
    ElMessage.error('获取小红书用户列表时出错，请查看控制台')
    userList.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

const formatDateTime = (dateTimeStr) => {
  if (!dateTimeStr) return ''
  const date = new Date(dateTimeStr)
  return date.toLocaleString()
}

const handleSearch = () => {
  pagination.currentPage = 1
  fetchUsers()
}

const resetSearch = () => {
  searchForm.userId = ''
  searchForm.name = ''
  pagination.currentPage = 1
  fetchUsers()
}

const handleSizeChange = (val) => {
  pagination.pageSize = val
  pagination.currentPage = 1
  fetchUsers()
}

const handleCurrentChange = (val) => {
  pagination.currentPage = val
  fetchUsers()
}

const viewUserDetail = (user) => {
  selectedUser.value = user
  detailDialogVisible.value = true
}

onMounted(() => {
  fetchUsers()
})
</script>

<style scoped>
.xhs-user-list-container {
  padding: 20px;
}

.search-card {
  margin-bottom: 20px;
}

.search-form .el-form-item {
  margin-bottom: 0;
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

.user-detail .user-basic-info {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}

.user-detail .user-info {
  margin-left: 20px;
}

.user-detail .user-info h3 {
  margin: 0 0 10px 0;
  font-size: 18px;
}

.user-detail .user-info p {
  margin: 5px 0;
  color: #666;
}
</style> 