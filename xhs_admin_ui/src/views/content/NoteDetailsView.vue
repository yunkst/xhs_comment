<template>
  <div class="note-details-view">
    <el-card class="filter-card">
      <template #header>
        <div class="card-header">
          <h2>笔记详情数据管理</h2>
          <p class="subtitle">查看和管理从插件获取的完整笔记详情数据</p>
        </div>
      </template>

      <!-- 搜索过滤区域 -->
      <div class="filter-section">
        <el-row :gutter="20">
          <el-col :span="6">
            <el-input
              v-model="searchForm.keyword"
              placeholder="搜索标题、描述或作者"
              clearable
              @clear="handleSearch"
              @keyup.enter="handleSearch"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
          </el-col>
          <el-col :span="4">
            <el-input
              v-model="searchForm.author"
              placeholder="作者昵称"
              clearable
              @clear="handleSearch"
              @keyup.enter="handleSearch"
            />
          </el-col>
          <el-col :span="4">
            <el-select
              v-model="searchForm.note_type"
              placeholder="笔记类型"
              clearable
              @change="handleSearch"
            >
              <el-option label="全部" value="" />
              <el-option label="图文笔记" value="normal" />
              <el-option label="视频笔记" value="video" />
            </el-select>
          </el-col>
          <el-col :span="6">
            <el-date-picker
              v-model="dateRange"
              type="daterange"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              @change="handleSearch"
            />
          </el-col>
          <el-col :span="4">
            <el-button type="primary" @click="handleSearch" :loading="loading">
              <el-icon><Search /></el-icon>
              搜索
            </el-button>
          </el-col>
        </el-row>
      </div>
    </el-card>

    <!-- 数据表格 -->
    <el-card class="table-card">
      <el-table
        v-loading="loading"
        :data="noteList"
        stripe
        style="width: 100%"
        @sort-change="handleSortChange"
      >
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="expand-content">
              <el-row :gutter="20">
                <el-col :span="12">
                  <h4>基本信息</h4>
                  <p><strong>笔记ID:</strong> {{ row.noteId }}</p>
                  <p><strong>类型:</strong> 
                    <el-tag :type="row.type === 'video' ? 'danger' : 'primary'" size="small">
                      {{ row.type === 'video' ? '视频笔记' : '图文笔记' }}
                    </el-tag>
                  </p>
                  <p><strong>发布时间:</strong> {{ formatTime(row.publishTime) }}</p>
                  <p><strong>发布地点:</strong> {{ row.ipLocation || '未知' }}</p>
                  <p><strong>获取时间:</strong> {{ formatTime(row.fetchTimestamp) }}</p>
                </el-col>
                <el-col :span="12">
                  <h4>互动数据</h4>
                  <p><strong>点赞数:</strong> {{ row.interactInfo?.likedCount || '0' }}</p>
                  <p><strong>收藏数:</strong> {{ row.interactInfo?.collectedCount || '0' }}</p>
                  <p><strong>评论数:</strong> {{ row.interactInfo?.commentCount || '0' }}</p>
                  <p><strong>分享数:</strong> {{ row.interactInfo?.shareCount || '0' }}</p>
                </el-col>
              </el-row>
              
              <div v-if="row.tagList && row.tagList.length > 0" style="margin-top: 15px;">
                <h4>话题标签</h4>
                <el-tag
                  v-for="tag in row.tagList"
                  :key="tag.id"
                  size="small"
                  style="margin-right: 8px; margin-bottom: 5px;"
                >
                  {{ tag.name }}
                </el-tag>
              </div>
              
              <div style="margin-top: 15px;">
                <el-button size="small" @click="viewFullDetails(row)">
                  查看完整详情
                </el-button>
              </div>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="title-cell">
              <span class="title-text">{{ row.title || '无标题' }}</span>
              <el-tag
                v-if="row.type"
                :type="row.type === 'video' ? 'danger' : 'primary'"
                size="small"
                style="margin-left: 8px;"
              >
                {{ row.type === 'video' ? '视频' : '图文' }}
              </el-tag>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="desc" label="描述" min-width="300" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="desc-cell">
              {{ truncateText(row.desc, 100) }}
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="user.nickname" label="作者" width="150" show-overflow-tooltip />

        <el-table-column label="媒体内容" width="120" align="center">
          <template #default="{ row }">
            <div class="media-info">
              <div v-if="row.type === 'video'">
                <el-icon style="color: #e74c3c;"><VideoPlay /></el-icon>
                <span style="margin-left: 4px;">视频</span>
              </div>
              <div v-else-if="row.imageList && row.imageList.length > 0">
                <el-icon style="color: #3498db;"><Picture /></el-icon>
                <span style="margin-left: 4px;">{{ row.imageList.length }}图</span>
              </div>
              <div v-else>
                <span style="color: #7f8c8d;">无媒体</span>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="互动数据" width="150" align="center">
          <template #default="{ row }">
            <div class="interaction-info">
              <div><el-icon><Star /></el-icon> {{ row.interactInfo?.likedCount || '0' }}</div>
              <div><el-icon><ChatLineRound /></el-icon> {{ row.interactInfo?.commentCount || '0' }}</div>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="publishTime" label="发布时间" width="180" sortable="custom">
          <template #default="{ row }">
            {{ formatTime(row.publishTime) }}
          </template>
        </el-table-column>

        <el-table-column prop="fetchTimestamp" label="采集时间" width="180" sortable="custom">
          <template #default="{ row }">
            {{ formatTime(row.fetchTimestamp) }}
          </template>
        </el-table-column>

        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              type="primary"
              @click="viewFullDetails(row)"
            >
              详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.page_size"
          :page-sizes="[10, 20, 50, 100]"
          :small="false"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>

    <!-- 详情对话框 -->
    <el-dialog
      v-model="detailDialog.visible"
      :title="`笔记详情 - ${detailDialog.data.title || '无标题'}`"
      width="80%"
      :before-close="handleCloseDetail"
    >
      <div v-if="detailDialog.data" class="detail-content">
        <el-tabs v-model="activeTab">
          <el-tab-pane label="基本信息" name="basic">
            <div class="basic-info">
              <el-descriptions :column="2" border>
                <el-descriptions-item label="笔记ID">{{ detailDialog.data.noteId }}</el-descriptions-item>
                <el-descriptions-item label="类型">
                  <el-tag :type="detailDialog.data.type === 'video' ? 'danger' : 'primary'">
                    {{ detailDialog.data.type === 'video' ? '视频笔记' : '图文笔记' }}
                  </el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="标题">{{ detailDialog.data.title || '无标题' }}</el-descriptions-item>
                <el-descriptions-item label="作者">{{ detailDialog.data.user?.nickname || '未知' }}</el-descriptions-item>
                <el-descriptions-item label="发布时间">{{ formatTime(detailDialog.data.publishTime) }}</el-descriptions-item>
                <el-descriptions-item label="发布地点">{{ detailDialog.data.ipLocation || '未知' }}</el-descriptions-item>
                <el-descriptions-item label="采集时间">{{ formatTime(detailDialog.data.fetchTimestamp) }}</el-descriptions-item>
                <el-descriptions-item label="更新时间">{{ formatTime(detailDialog.data.lastUpdateTime) }}</el-descriptions-item>
              </el-descriptions>
              
              <div style="margin-top: 20px;">
                <h4>描述内容</h4>
                <el-input
                  v-model="detailDialog.data.desc"
                  type="textarea"
                  :rows="4"
                  readonly
                  style="margin-top: 10px;"
                />
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="互动数据" name="interaction">
            <div class="interaction-data">
              <el-row :gutter="20">
                <el-col :span="6">
                  <el-statistic title="点赞数" :value="parseInt(detailDialog.data.interactInfo?.likedCount || '0')" />
                </el-col>
                <el-col :span="6">
                  <el-statistic title="收藏数" :value="parseInt(detailDialog.data.interactInfo?.collectedCount || '0')" />
                </el-col>
                <el-col :span="6">
                  <el-statistic title="评论数" :value="parseInt(detailDialog.data.interactInfo?.commentCount || '0')" />
                </el-col>
                <el-col :span="6">
                  <el-statistic title="分享数" :value="parseInt(detailDialog.data.interactInfo?.shareCount || '0')" />
                </el-col>
              </el-row>
            </div>
          </el-tab-pane>

          <el-tab-pane label="评论数据" name="comments">
            <div class="comments-data">
              <el-alert
                v-if="!detailDialog.data.comments?.list || detailDialog.data.comments.list.length === 0"
                title="暂无评论数据"
                type="info"
                show-icon
                :closable="false"
              />
              <div v-else>
                <h4>评论列表 ({{ detailDialog.data.comments.list.length }} 条)</h4>
                <div
                  v-for="comment in detailDialog.data.comments.list.slice(0, 10)"
                  :key="comment.id"
                  class="comment-item"
                >
                  <div class="comment-header">
                    <strong>{{ comment.userInfo?.nickname || '匿名用户' }}</strong>
                    <el-tag size="small" style="margin-left: 8px;">{{ comment.ipLocation || '未知' }}</el-tag>
                    <span class="comment-time">{{ formatTime(comment.createTimeISO || comment.createTime) }}</span>
                  </div>
                  <div class="comment-content">{{ comment.content }}</div>
                  <div class="comment-stats">
                    <span><el-icon><Star /></el-icon> {{ comment.likeCount || '0' }}</span>
                    <span v-if="comment.subComments && comment.subComments.length > 0">
                      <el-icon><ChatLineRound /></el-icon> {{ comment.subComments.length }} 条回复
                    </span>
                  </div>
                </div>
                <div v-if="detailDialog.data.comments.list.length > 10" style="text-align: center; margin-top: 15px;">
                  <el-text type="info">仅显示前10条评论，完整数据请使用API获取</el-text>
                </div>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="话题标签" name="tags">
            <div class="tags-data">
              <el-alert
                v-if="!detailDialog.data.tagList || detailDialog.data.tagList.length === 0"
                title="暂无话题标签"
                type="info"
                show-icon
                :closable="false"
              />
              <div v-else>
                <el-tag
                  v-for="tag in detailDialog.data.tagList"
                  :key="tag.id"
                  size="large"
                  style="margin-right: 10px; margin-bottom: 10px;"
                >
                  {{ tag.name }}
                </el-tag>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="原始数据" name="raw">
            <div class="raw-data">
              <el-input
                :model-value="JSON.stringify(detailDialog.data, null, 2)"
                type="textarea"
                :rows="20"
                readonly
                style="font-family: monospace;"
              />
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Star, ChatLineRound, VideoPlay, Picture } from '@element-plus/icons-vue'
import api from '../../services/api'

// 响应式数据
const loading = ref(false)
const noteList = ref([])
const dateRange = ref([])
const activeTab = ref('basic')

const searchForm = reactive({
  keyword: '',
  author: '',
  note_type: ''
})

const pagination = reactive({
  page: 1,
  page_size: 20,
  total: 0,
  total_pages: 0
})

const detailDialog = reactive({
  visible: false,
  data: {}
})

// 工具函数
const formatTime = (time) => {
  if (!time) return '-'
  const date = new Date(time)
  if (isNaN(date.getTime())) return '-'
  return date.toLocaleString('zh-CN')
}

const truncateText = (text, maxLength) => {
  if (!text) return '-'
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

// 获取笔记详情列表
const fetchNoteDetails = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      page_size: pagination.page_size,
      ...searchForm
    }

    if (dateRange.value && dateRange.value.length === 2) {
      params.start_date = dateRange.value[0]
      params.end_date = dateRange.value[1]
    }

    const response = await api.get('/api/v1/content/notes/details/list', { params })
    
    if (response.data.success) {
      noteList.value = response.data.data
      pagination.total = response.data.total
      pagination.total_pages = response.data.total_pages
    } else {
      ElMessage.error(response.data.message || '获取数据失败')
    }
  } catch (error) {
    console.error('获取笔记详情列表失败:', error)
    ElMessage.error('获取数据失败: ' + (error.response?.data?.detail || error.message))
  } finally {
    loading.value = false
  }
}

// 搜索处理
const handleSearch = () => {
  pagination.page = 1
  fetchNoteDetails()
}

// 分页处理
const handleSizeChange = (val) => {
  pagination.page_size = val
  pagination.page = 1
  fetchNoteDetails()
}

const handleCurrentChange = (val) => {
  pagination.page = val
  fetchNoteDetails()
}

// 排序处理
const handleSortChange = ({ column, prop, order }) => {
  // 这里可以添加排序逻辑
  console.log('排序变化:', { column, prop, order })
}

// 查看完整详情
const viewFullDetails = async (row) => {
  try {
    const response = await api.get(`/api/v1/content/notes/details/${row.noteId}`)
    if (response.data.success) {
      detailDialog.data = response.data.data
      detailDialog.visible = true
      activeTab.value = 'basic'
    } else {
      ElMessage.error('获取详情失败')
    }
  } catch (error) {
    console.error('获取笔记详情失败:', error)
    ElMessage.error('获取详情失败: ' + (error.response?.data?.detail || error.message))
  }
}

// 关闭详情对话框
const handleCloseDetail = () => {
  detailDialog.visible = false
  detailDialog.data = {}
}

// 页面加载时获取数据
onMounted(() => {
  fetchNoteDetails()
})
</script>

<style scoped>
.note-details-view {
  padding: 20px;
}

.filter-card {
  margin-bottom: 20px;
}

.card-header h2 {
  margin: 0 0 5px 0;
  color: #303133;
}

.subtitle {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.filter-section {
  margin-top: 20px;
}

.table-card {
  margin-bottom: 20px;
}

.pagination-wrapper {
  margin-top: 20px;
  text-align: right;
}

.title-cell {
  display: flex;
  align-items: center;
}

.title-text {
  flex: 1;
  min-width: 0;
}

.desc-cell {
  line-height: 1.4;
}

.media-info {
  display: flex;
  align-items: center;
  justify-content: center;
}

.interaction-info {
  text-align: center;
}

.interaction-info > div {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
}

.interaction-info .el-icon {
  margin-right: 4px;
}

.expand-content {
  padding: 20px;
  background-color: #fafafa;
  border-radius: 4px;
}

.expand-content h4 {
  margin: 0 0 10px 0;
  color: #303133;
}

.expand-content p {
  margin: 5px 0;
  color: #606266;
}

.detail-content {
  max-height: 600px;
  overflow-y: auto;
}

.basic-info {
  padding: 20px;
}

.interaction-data {
  padding: 20px;
}

.comments-data {
  padding: 20px;
}

.comment-item {
  border: 1px solid #ebeef5;
  border-radius: 4px;
  padding: 15px;
  margin-bottom: 10px;
  background-color: #fafafa;
}

.comment-header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.comment-time {
  margin-left: auto;
  color: #909399;
  font-size: 12px;
}

.comment-content {
  margin-bottom: 8px;
  line-height: 1.4;
  color: #303133;
}

.comment-stats {
  display: flex;
  gap: 15px;
  color: #909399;
  font-size: 12px;
}

.comment-stats span {
  display: flex;
  align-items: center;
}

.comment-stats .el-icon {
  margin-right: 4px;
}

.tags-data {
  padding: 20px;
}

.raw-data {
  padding: 20px;
}
</style> 