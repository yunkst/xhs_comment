<template>
  <div class="user-list-container">
    <el-card class="search-card">
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="用户名/ID">
          <el-input v-model="searchForm.keyword" placeholder="用户名/ID" clearable />
        </el-form-item>
        <el-form-item label="用户状态">
          <el-select v-model="searchForm.status" placeholder="请选择状态" clearable>
            <el-option label="正常" value="正常" />
            <el-option label="已禁言" value="已禁言" />
            <el-option label="已封禁" value="已封禁" />
          </el-select>
        </el-form-item>
        <el-form-item label="注册时间">
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
        <h3>用户列表</h3>
        <div class="table-operations">
          <el-button @click="refreshTable">刷新</el-button>
        </div>
      </div>

      <el-table
        :data="userList"
        style="width: 100%"
        v-loading="loading"
      >
        <el-table-column prop="id" label="用户ID" width="100" />
        <el-table-column label="头像" width="80">
          <template #default="scope">
            <el-avatar :size="40" :src="scope.row.avatar"></el-avatar>
          </template>
        </el-table-column>
        <el-table-column prop="username" label="用户名" width="120" />
        <el-table-column prop="nickname" label="昵称" width="120" />
        <el-table-column prop="commentCount" label="评论数" width="100" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.status === '正常' ? 'success' : scope.row.status === '已禁言' ? 'warning' : 'danger'">
              {{ scope.row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="registerTime" label="注册时间" width="180" />
        <el-table-column prop="lastLoginTime" label="最近登录" width="180" />
        <el-table-column label="操作" width="300" fixed="right">
          <template #default="scope">
            <el-button size="small" @click="handleView(scope.row)">查看</el-button>
            <el-button
              size="small"
              :type="scope.row.status === '已禁言' ? 'success' : 'warning'"
              v-if="scope.row.status !== '已封禁'"
              @click="handleMute(scope.row)"
            >
              {{ scope.row.status === '已禁言' ? '解除禁言' : '禁言' }}
            </el-button>
            <el-button
              size="small"
              :type="scope.row.status === '已封禁' ? 'success' : 'danger'"
              @click="handleBan(scope.row)"
            >
              {{ scope.row.status === '已封禁' ? '解除封禁' : '封禁' }}
            </el-button>
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

    <!-- 用户详情对话框 -->
    <el-dialog v-model="dialogVisible" title="用户详情" width="700px">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="用户ID">{{ currentUser.id }}</el-descriptions-item>
        <el-descriptions-item label="用户名">{{ currentUser.username }}</el-descriptions-item>
        <el-descriptions-item label="昵称">{{ currentUser.nickname }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="currentUser.status === '正常' ? 'success' : currentUser.status === '已禁言' ? 'warning' : 'danger'">
            {{ currentUser.status }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="评论数量">{{ currentUser.commentCount }}</el-descriptions-item>
        <el-descriptions-item label="违规次数">{{ currentUser.violationCount }}</el-descriptions-item>
        <el-descriptions-item label="注册时间">{{ currentUser.registerTime }}</el-descriptions-item>
        <el-descriptions-item label="最近登录">{{ currentUser.lastLoginTime }}</el-descriptions-item>
        <el-descriptions-item label="手机号码" :span="2">{{ currentUser.phone }}</el-descriptions-item>
        <el-descriptions-item label="邮箱地址" :span="2">{{ currentUser.email }}</el-descriptions-item>
      </el-descriptions>

      <el-divider content-position="center">最近评论</el-divider>
      
      <el-table :data="currentUser.recentComments || []" style="width: 100%">
        <el-table-column prop="content" label="评论内容" min-width="300" show-overflow-tooltip />
        <el-table-column prop="articleTitle" label="文章标题" min-width="150" show-overflow-tooltip />
        <el-table-column prop="createTime" label="评论时间" width="180" />
      </el-table>
      
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false">关闭</el-button>
          <el-button
            type="warning"
            v-if="currentUser.status !== '已禁言' && currentUser.status !== '已封禁'"
            @click="handleMute(currentUser)"
          >
            禁言用户
          </el-button>
          <el-button
            type="danger"
            v-if="currentUser.status !== '已封禁'"
            @click="handleBan(currentUser)"
          >
            封禁用户
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 禁言/封禁对话框 -->
    <el-dialog v-model="actionDialog" :title="actionTitle" width="500px">
      <el-form :model="actionForm" label-width="100px">
        <el-form-item label="操作原因">
          <el-select v-model="actionForm.reason" placeholder="请选择操作原因" style="width: 100%">
            <el-option label="发布违规内容" value="发布违规内容" />
            <el-option label="发布广告信息" value="发布广告信息" />
            <el-option label="恶意攻击他人" value="恶意攻击他人" />
            <el-option label="多次违反社区规定" value="多次违反社区规定" />
            <el-option label="其他原因" value="其他原因" />
          </el-select>
        </el-form-item>
        <el-form-item label="详细说明" v-if="actionForm.reason === '其他原因'">
          <el-input 
            type="textarea" 
            v-model="actionForm.detail" 
            :rows="3"
            placeholder="请输入详细原因"
          />
        </el-form-item>
        <el-form-item label="操作时长" v-if="actionType === 'mute'">
          <el-select v-model="actionForm.duration" placeholder="请选择禁言时长" style="width: 100%">
            <el-option label="1天" value="1" />
            <el-option label="3天" value="3" />
            <el-option label="7天" value="7" />
            <el-option label="15天" value="15" />
            <el-option label="30天" value="30" />
            <el-option label="永久" value="-1" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="actionDialog = false">取消</el-button>
          <el-button type="primary" @click="confirmAction">确认</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { userManagementApi } from '../../services/api'

// 搜索表单
const searchForm = reactive({
  keyword: '',
  status: '',
  dateRange: []
})

// 表格数据
const loading = ref(false)
const userList = ref([])
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)

// 当前用户详情
const dialogVisible = ref(false)
const currentUser = ref({})

// 操作对话框
const actionDialog = ref(false)
const actionTitle = ref('')
const actionType = ref('')
const actionForm = reactive({
  reason: '发布违规内容',
  detail: '',
  duration: '7'
})

// 获取用户列表数据
const getUserList = async () => {
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
    const response = await userManagementApi.getUserList(params)
    
    userList.value = response.items || []
    total.value = response.total || 0
  } catch (error) {
    console.error('获取用户列表失败:', error)
    ElMessage.error('获取用户列表失败')
    
    // 发生错误时显示空数据
    userList.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

// 搜索
const handleSearch = () => {
  currentPage.value = 1
  getUserList()
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
  getUserList()
}

// 查看用户详情
const handleView = async (row) => {
  try {
    loading.value = true
    // 获取用户详情
    const userDetail = await userManagementApi.getUserDetail(row.id)
    currentUser.value = userDetail
    dialogVisible.value = true
  } catch (error) {
    console.error('获取用户详情失败:', error)
    ElMessage.error('获取用户详情失败')
  } finally {
    loading.value = false
  }
}

// 处理禁言
const handleMute = async (row) => {
  if (row.status === '已禁言') {
    // 解除禁言
    ElMessageBox.confirm(`确定要解除对用户 ${row.nickname || row.username}(${row.id}) 的禁言吗?`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(async () => {
      try {
        await userManagementApi.unmuteUser(row.id)
        ElMessage.success(`已解除对用户 ${row.nickname || row.username} 的禁言`)
        row.status = '正常'
        if (currentUser.value.id === row.id) {
          currentUser.value.status = '正常'
        }
      } catch (error) {
        console.error('解除禁言失败:', error)
        ElMessage.error('操作失败')
      }
    }).catch(() => {})
  } else {
    // 禁言
    actionType.value = 'mute'
    actionTitle.value = `禁言用户: ${row.nickname || row.username}`
    actionForm.reason = '发布违规内容'
    actionForm.detail = ''
    actionForm.duration = '7'
    actionDialog.value = true
    currentUser.value = row
  }
}

// 处理封禁
const handleBan = async (row) => {
  if (row.status === '已封禁') {
    // 解除封禁
    ElMessageBox.confirm(`确定要解除对用户 ${row.nickname || row.username}(${row.id}) 的封禁吗?`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }).then(async () => {
      try {
        await userManagementApi.unbanUser(row.id)
        ElMessage.success(`已解除对用户 ${row.nickname || row.username} 的封禁`)
        row.status = '正常'
        if (currentUser.value.id === row.id) {
          currentUser.value.status = '正常'
        }
      } catch (error) {
        console.error('解除封禁失败:', error)
        ElMessage.error('操作失败')
      }
    }).catch(() => {})
  } else {
    // 封禁
    actionType.value = 'ban'
    actionTitle.value = `封禁用户: ${row.nickname || row.username}`
    actionForm.reason = '多次违反社区规定'
    actionForm.detail = ''
    actionDialog.value = true
    currentUser.value = row
  }
}

// 确认操作
const confirmAction = async () => {
  const reason = actionForm.reason === '其他原因' ? actionForm.detail : actionForm.reason
  const duration = actionType.value === 'mute' ? (actionForm.duration === '-1' ? '永久' : `${actionForm.duration}天`) : '永久'
  
  try {
    if (actionType.value === 'mute') {
      // 禁言
      await userManagementApi.muteUser(currentUser.value.id, {
        reason: reason,
        duration: actionForm.duration
      })
      ElMessage.success(`已对用户 ${currentUser.value.nickname || currentUser.value.username} 禁言 ${duration}，原因: ${reason}`)
      currentUser.value.status = '已禁言'
    } else {
      // 封禁
      await userManagementApi.banUser(currentUser.value.id, {
        reason: reason
      })
      ElMessage.success(`已封禁用户 ${currentUser.value.nickname || currentUser.value.username}，原因: ${reason}`)
      currentUser.value.status = '已封禁'
    }
  } catch (error) {
    console.error('操作失败:', error)
    ElMessage.error('操作失败')
  }
  
  actionDialog.value = false
  getUserList()
}

// 处理页码变化
const handleCurrentChange = (val) => {
  currentPage.value = val
  getUserList()
}

// 处理每页显示条数变化
const handleSizeChange = (val) => {
  pageSize.value = val
  currentPage.value = 1
  getUserList()
}

// 初始加载
onMounted(() => {
  getUserList()
})
</script>

<style scoped>
.user-list-container {
  padding: 10px;
}

.search-card,
.table-card {
  margin-bottom: 20px;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
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