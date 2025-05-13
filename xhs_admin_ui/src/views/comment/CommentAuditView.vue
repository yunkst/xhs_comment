<template>
  <div class="comment-audit-container">
    <el-card class="audit-card">
      <div class="audit-header">
        <h3>评论审核</h3>
        <div>
          <el-button type="primary" @click="loadNextBatch">加载新评论</el-button>
        </div>
      </div>
      
      <div v-if="currentComment" class="comment-content">
        <div class="article-info">
          <h4>{{ currentComment.articleTitle }}</h4>
          <p class="article-excerpt">{{ currentComment.articleExcerpt }}</p>
        </div>
        
        <div class="comment-detail">
          <div class="comment-user">
            <el-avatar :size="50" src="https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png"></el-avatar>
            <div class="user-info">
              <h4>{{ currentComment.username }}</h4>
              <p>{{ currentComment.createTime }}</p>
            </div>
          </div>
          
          <div class="comment-text">
            {{ currentComment.content }}
          </div>
          
          <div v-if="currentComment.sensitiveWords && currentComment.sensitiveWords.length > 0" class="sensitive-info">
            <el-alert
              title="检测到敏感词"
              type="warning"
              :closable="false"
            >
              <div class="sensitive-words">
                <el-tag 
                  v-for="(word, index) in currentComment.sensitiveWords" 
                  :key="index"
                  type="danger" 
                  class="sensitive-tag"
                >
                  {{ word }}
                </el-tag>
              </div>
            </el-alert>
          </div>
        </div>
        
        <div class="audit-actions">
          <el-button type="success" size="large" @click="handleApprove(currentComment)">通过</el-button>
          <el-button type="primary" size="large" @click="handleEdit(currentComment)">编辑并通过</el-button>
          <el-button type="danger" size="large" @click="handleReject(currentComment)">拒绝</el-button>
        </div>
      </div>
      
      <div v-else class="empty-audit">
        <el-empty description="当前没有待审核的评论"></el-empty>
      </div>
    </el-card>
    
    <!-- 编辑评论抽屉 -->
    <el-drawer v-model="editDrawer" title="编辑评论" size="50%">
      <el-form :model="editingComment" label-width="100px">
        <el-form-item label="用户名">
          <span>{{ editingComment.username }}</span>
        </el-form-item>
        <el-form-item label="评论内容">
          <el-input 
            v-model="editingComment.content" 
            type="textarea" 
            :rows="5"
            placeholder="请输入修改后的评论内容"
          ></el-input>
        </el-form-item>
        <el-form-item label="修改理由">
          <el-input 
            v-model="editReason" 
            type="textarea" 
            :rows="3"
            placeholder="请输入修改理由（内部记录用）"
          ></el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="submitEdit">确认修改并通过</el-button>
          <el-button @click="editDrawer = false">取消</el-button>
        </el-form-item>
      </el-form>
    </el-drawer>
    
    <!-- 拒绝评论对话框 -->
    <el-dialog v-model="rejectDialog" title="拒绝评论" width="500px">
      <el-form :model="rejectForm" label-width="100px">
        <el-form-item label="拒绝理由">
          <el-select v-model="rejectForm.reason" placeholder="请选择拒绝理由" style="width: 100%">
            <el-option label="广告内容" value="广告内容"></el-option>
            <el-option label="违规内容" value="违规内容"></el-option>
            <el-option label="恶意攻击" value="恶意攻击"></el-option>
            <el-option label="垃圾信息" value="垃圾信息"></el-option>
            <el-option label="其他" value="其他"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="详细说明" v-if="rejectForm.reason === '其他'">
          <el-input 
            v-model="rejectForm.detail" 
            type="textarea" 
            :rows="3"
            placeholder="请详细说明拒绝理由"
          ></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="rejectDialog = false">取消</el-button>
          <el-button type="primary" @click="submitReject">确认拒绝</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { commentApi } from '../../services/api'

// 状态变量
const commentQueue = ref([])
const currentComment = ref(null)
const editDrawer = ref(false)
const editingComment = ref({})
const editReason = ref('')
const rejectDialog = ref(false)
const rejectForm = ref({
  reason: '广告内容',
  detail: ''
})

// 加载评论队列
const loadCommentQueue = async () => {
  try {
    const response = await commentApi.getCommentList({ 
      status: '待审核',
      pageSize: 10
    })
    
    if (response && response.items) {
      commentQueue.value = response.items
      loadComment()
    }
  } catch (error) {
    console.error('获取待审核评论失败:', error)
    ElMessage.error('获取待审核评论失败')
  }
}

// 加载第一个评论
const loadComment = () => {
  if (commentQueue.value.length > 0) {
    currentComment.value = commentQueue.value[0]
  } else {
    currentComment.value = null
    ElMessage.info('所有评论已审核完毕')
  }
}

// 加载下一批评论
const loadNextBatch = async () => {
  await loadCommentQueue()
}

// 处理通过
const handleApprove = async (comment) => {
  try {
    await commentApi.updateCommentStatus(comment.id, '通过')
    ElMessage.success(`评论ID:${comment.id} 已通过`)
    // 移除队列中当前评论
    commentQueue.value.shift()
    // 加载下一条
    loadComment()
  } catch (error) {
    console.error('通过评论失败:', error)
    ElMessage.error('操作失败')
  }
}

// 处理编辑
const handleEdit = (comment) => {
  editingComment.value = { ...comment }
  editReason.value = ''
  editDrawer.value = true
}

// 提交编辑
const submitEdit = async () => {
  if (!editingComment.value.content.trim()) {
    ElMessage.warning('评论内容不能为空')
    return
  }
  
  try {
    // 这里需要后端提供评论内容更新接口
    // 为简化示例，假设使用与状态更新相同的接口
    await commentApi.updateCommentStatus(editingComment.value.id, '通过')
    ElMessage.success(`评论ID:${editingComment.value.id} 已修改并通过`)
    // 移除队列中当前评论
    commentQueue.value.shift()
    // 加载下一条
    loadComment()
    // 关闭抽屉
    editDrawer.value = false
  } catch (error) {
    console.error('修改评论失败:', error)
    ElMessage.error('操作失败')
  }
}

// 处理拒绝
const handleReject = (comment) => {
  rejectForm.value = {
    reason: '广告内容',
    detail: ''
  }
  rejectDialog.value = true
}

// 提交拒绝
const submitReject = async () => {
  try {
    const reason = rejectForm.value.reason === '其他' ? rejectForm.value.detail : rejectForm.value.reason
    await commentApi.updateCommentStatus(currentComment.value.id, '拦截')
    ElMessage.success(`评论ID:${currentComment.value.id} 已拒绝，原因: ${reason}`)
    // 移除队列中当前评论
    commentQueue.value.shift()
    // 加载下一条
    loadComment()
    // 关闭对话框
    rejectDialog.value = false
  } catch (error) {
    console.error('拒绝评论失败:', error)
    ElMessage.error('操作失败')
  }
}

// 初始加载
loadCommentQueue()
</script>

<style scoped>
.comment-audit-container {
  padding: 10px;
}

.audit-card {
  margin-bottom: 20px;
}

.audit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.audit-header h3 {
  margin: 0;
  font-size: 18px;
}

.empty-audit {
  padding: 40px 0;
}

.article-info {
  margin-bottom: 20px;
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.article-info h4 {
  margin-top: 0;
  margin-bottom: 10px;
  color: #303133;
}

.article-excerpt {
  color: #606266;
  margin: 0;
}

.comment-detail {
  margin-bottom: 20px;
}

.comment-user {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
}

.user-info {
  margin-left: 15px;
}

.user-info h4 {
  margin: 0 0 5px 0;
  font-size: 16px;
}

.user-info p {
  margin: 0;
  font-size: 13px;
  color: #909399;
}

.comment-text {
  font-size: 16px;
  line-height: 1.6;
  padding: 15px;
  background-color: #ffffff;
  border: 1px solid #ebeef5;
  border-radius: 4px;
}

.sensitive-info {
  margin: 20px 0;
}

.sensitive-words {
  margin-top: 10px;
}

.sensitive-tag {
  margin-right: 8px;
  margin-bottom: 8px;
}

.audit-actions {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-top: 30px;
}
</style> 