<template>
  <div class="user-list-container">
    <el-card class="search-card">
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="用户ID/名称">
          <el-input v-model="searchForm.keyword" placeholder="搜索用户ID或名称" clearable />
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
            <el-avatar :size="40" :src="scope.row.avatar">
              <img src="https://cube.elemecdn.com/e/fd/0fc7d20532fdaf769a25683617711png.png"/>
            </el-avatar>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="用户名" width="180" />
        <el-table-column label="主页链接" width="250">
          <template #default="scope">
            <el-link :href="scope.row.url" target="_blank" type="primary">{{ scope.row.url }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="信息创建时间" width="200">
          <template #default="scope">
            {{ formatDateTime(scope.row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column prop="updatedAt" label="信息更新时间" width="200">
          <template #default="scope">
            {{ formatDateTime(scope.row.updatedAt) }}
          </template>
        </el-table-column>
        <!-- 暂时移除操作列，后续可根据需求添加 -->
        <!--
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="scope">
            <el-button size="small" @click="handleViewDetails(scope.row)">查看笔记/评论</el-button>
          </template>
        </el-table-column>
        -->
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

    <!-- 如果需要用户详情对话框，后续可以添加 -->
    <!-- 
    <el-dialog v-model="dialogVisible" title="用户详情" width="700px">
      <p>用户ID: {{ currentUser.id }}</p>
      <p>用户名: {{ currentUser.name }}</p>
    </el-dialog>
    -->
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getUserList as getXhsUserList } from '../../services/api' // 重命名导入以区分

// 搜索表单 - 简化为关键词搜索
const searchForm = reactive({
  keyword: '', 
})

// 表格数据
const loading = ref(false)
const userList = ref([])
const pagination = reactive({
  currentPage: 1,
  pageSize: 10,
  total: 0
})

// const dialogVisible = ref(false)
// const currentUser = ref({})

// 获取用户列表数据
const fetchUsers = async () => {
  loading.value = true
  try {
    // 注意：当前的 getUserList API 不支持后端关键词搜索，这里的搜索是前端示例
    // 如果需要后端搜索，API需要调整
    const response = await getXhsUserList(pagination.currentPage, pagination.pageSize)
    if (response.success && response.data) {
      userList.value = response.data.items || []
      pagination.total = response.data.total || 0
    } else {
      ElMessage.error(response.message || '获取用户列表失败')
      userList.value = []
      pagination.total = 0
    }
  } catch (error) {
    console.error('获取用户列表时出错:', error)
    ElMessage.error('获取用户列表时出错，请查看控制台')
    userList.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

// 格式化日期时间
const formatDateTime = (dateTimeStr) => {
  if (!dateTimeStr) return '';
  const date = new Date(dateTimeStr);
  return date.toLocaleString(); // 或者使用更复杂的日期格式化库如 date-fns or moment
}

// 搜索处理 - 目前为前端演示，如果后端支持，需要修改 fetchUsers
const handleSearch = () => {
  // 如果后端API支持关键词搜索，将 searchForm.keyword 作为参数传递
  // pagination.currentPage = 1 // 重置到第一页
  // fetchUsers() 
  ElMessage.info('当前为前端演示搜索，实际搜索需后端API支持并修改fetchUsers逻辑。')
  
  // 前端过滤示例 (如果数据量不大)
  if (searchForm.keyword) {
    const lowerKeyword = searchForm.keyword.toLowerCase();
    userList.value = userList.value.filter(user => 
      (user.id && user.id.toLowerCase().includes(lowerKeyword)) ||
      (user.name && user.name.toLowerCase().includes(lowerKeyword))
    );
    // 注意：前端过滤会丢失分页的总数信息，仅适用于当前页数据过滤
    // 实际应用中推荐后端搜索
  } else {
    fetchUsers(); // 关键词为空则重新加载
  }
}

const resetSearch = () => {
  searchForm.keyword = ''
  pagination.currentPage = 1 // 重置到第一页
  fetchUsers()
}

const handleSizeChange = (val) => {
  pagination.pageSize = val
  pagination.currentPage = 1 // 切换每页数量时，回到第一页
  fetchUsers()
}

const handleCurrentChange = (val) => {
  pagination.currentPage = val
  fetchUsers()
}

/*
// 查看详情 - 示例，后续可扩展
const handleViewDetails = (row) => {
  currentUser.value = row
  dialogVisible.value = true
}
*/

// 组件挂载时获取初始数据
onMounted(() => {
  fetchUsers()
})
</script>

<style scoped>
.user-list-container {
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