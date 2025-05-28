<template>
  <div class="capture-rule-view">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2>抓取规则管理</h2>
      <p class="page-description">管理URL抓取规则，控制插件监控的网络请求</p>
    </div>

    <!-- 操作工具栏 -->
    <div class="toolbar">
      <el-button 
        type="primary" 
        icon="Plus" 
        @click="showAddDialog"
      >
        添加规则
      </el-button>
      <el-button 
        icon="Refresh" 
        @click="loadData"
      >
        刷新
      </el-button>
      <div class="toolbar-right">
        <el-text class="stats-text">
          共 {{ total }} 条规则，启用 {{ enabledCount }} 条
        </el-text>
      </div>
    </div>

    <!-- 规则列表 -->
    <div class="table-container">
      <el-table 
        :data="ruleList" 
        v-loading="loading"
        stripe
        border
        style="width: 100%"
      >
        <el-table-column prop="name" label="规则名称" width="150">
          <template #default="{ row }">
            <el-text>{{ row.name }}</el-text>
          </template>
        </el-table-column>
        
        <el-table-column prop="pattern" label="URL匹配模式" min-width="200">
          <template #default="{ row }">
            <el-text class="pattern-text">{{ row.pattern }}</el-text>
          </template>
        </el-table-column>
        
        <el-table-column prop="data_type" label="数据类型" width="120">
          <template #default="{ row }">
            <el-tag :type="getDataTypeColor(row.data_type)">
              {{ getDataTypeLabel(row.data_type) }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="priority" label="优先级" width="100" align="center">
          <template #default="{ row }">
            <el-text :type="getPriorityType(row.priority)">{{ row.priority }}</el-text>
          </template>
        </el-table-column>
        
        <el-table-column prop="enabled" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-switch 
              v-model="row.enabled" 
              @change="toggleRuleStatus(row)"
              :loading="row.updating"
            />
          </template>
        </el-table-column>
        
        <el-table-column prop="description" label="描述" min-width="150">
          <template #default="{ row }">
            <el-text class="description-text">{{ row.description || '无描述' }}</el-text>
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button 
              type="primary" 
              text 
              size="small" 
              @click="editRule(row)"
            >
              编辑
            </el-button>
            <el-button 
              type="danger" 
              text 
              size="small" 
              @click="deleteRule(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 添加/编辑规则对话框 -->
    <el-dialog 
      :title="dialogTitle" 
      v-model="dialogVisible" 
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form 
        ref="ruleFormRef" 
        :model="ruleForm" 
        :rules="ruleRules" 
        label-width="120px"
      >
        <el-form-item label="规则名称" prop="name">
          <el-input 
            v-model="ruleForm.name" 
            placeholder="请输入规则名称"
            :disabled="isEditMode"
          />
        </el-form-item>
        
        <el-form-item label="URL匹配模式" prop="pattern">
          <el-input 
            v-model="ruleForm.pattern" 
            placeholder="例如: */api/sns/web/v1/comment/*"
            type="textarea"
            :rows="2"
          />
          <div class="form-tip">
            支持通配符 *，用于匹配URL路径
          </div>
        </el-form-item>
        
        <el-form-item label="数据类型" prop="data_type">
          <el-select v-model="ruleForm.data_type" placeholder="请选择数据类型">
            <el-option label="评论" value="comment" />
            <el-option label="通知" value="notification" />
            <el-option label="用户" value="user" />
            <el-option label="笔记" value="note" />
            <el-option label="搜索" value="search" />
            <el-option label="推荐" value="recommendation" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="优先级" prop="priority">
          <el-input-number 
            v-model="ruleForm.priority" 
            :min="1" 
            :max="10" 
            placeholder="1-10，数字越大优先级越高"
          />
          <div class="form-tip">
            1-10之间的数字，数字越大优先级越高
          </div>
        </el-form-item>
        
        <el-form-item label="描述">
          <el-input 
            v-model="ruleForm.description" 
            placeholder="请输入规则描述"
            type="textarea"
            :rows="3"
          />
        </el-form-item>
        
        <el-form-item label="启用状态">
          <el-switch v-model="ruleForm.enabled" />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button 
            type="primary" 
            @click="saveRule"
            :loading="saving"
          >
            {{ isEditMode ? '更新' : '创建' }}
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { captureRuleApi } from '../../services/api'

// 响应式数据
const loading = ref(false)
const saving = ref(false)
const ruleList = ref([])
const dialogVisible = ref(false)
const isEditMode = ref(false)
const ruleFormRef = ref()

// 统计数据
const total = computed(() => ruleList.value.length)
const enabledCount = computed(() => ruleList.value.filter(rule => rule.enabled).length)

// 对话框标题
const dialogTitle = computed(() => isEditMode.value ? '编辑抓取规则' : '添加抓取规则')

// 表单数据
const ruleForm = reactive({
  name: '',
  pattern: '',
  data_type: '',
  priority: 5,
  description: '',
  enabled: true
})

// 表单验证规则
const ruleRules = {
  name: [
    { required: true, message: '请输入规则名称', trigger: 'blur' },
    { min: 2, max: 50, message: '规则名称长度在 2 到 50 个字符', trigger: 'blur' }
  ],
  pattern: [
    { required: true, message: '请输入URL匹配模式', trigger: 'blur' },
    { min: 5, message: 'URL匹配模式至少5个字符', trigger: 'blur' }
  ],
  data_type: [
    { required: true, message: '请选择数据类型', trigger: 'change' }
  ],
  priority: [
    { required: true, message: '请输入优先级', trigger: 'blur' }
  ]
}

// 获取数据类型颜色
const getDataTypeColor = (dataType) => {
  const colorMap = {
    comment: 'primary',
    notification: 'success',
    user: 'info',
    note: 'warning',
    search: '',
    recommendation: 'danger',
    other: ''
  }
  return colorMap[dataType] || ''
}

// 获取数据类型标签
const getDataTypeLabel = (dataType) => {
  const labelMap = {
    comment: '评论',
    notification: '通知',
    user: '用户',
    note: '笔记',
    search: '搜索',
    recommendation: '推荐',
    other: '其他'
  }
  return labelMap[dataType] || dataType
}

// 获取优先级类型
const getPriorityType = (priority) => {
  if (priority >= 8) return 'danger'
  if (priority >= 5) return 'warning'
  return 'info'
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const response = await captureRuleApi.getAllCaptureRules()
    if (response.success) {
      ruleList.value = response.rules.map(rule => ({
        ...rule,
        updating: false
      }))
    }
  } catch (error) {
    ElMessage.error('获取抓取规则失败：' + error.message)
  } finally {
    loading.value = false
  }
}

// 显示添加对话框
const showAddDialog = () => {
  isEditMode.value = false
  resetForm()
  dialogVisible.value = true
}

// 编辑规则
const editRule = (rule) => {
  isEditMode.value = true
  Object.assign(ruleForm, rule)
  dialogVisible.value = true
}

// 重置表单
const resetForm = () => {
  Object.assign(ruleForm, {
    name: '',
    pattern: '',
    data_type: '',
    priority: 5,
    description: '',
    enabled: true
  })
  if (ruleFormRef.value) {
    ruleFormRef.value.clearValidate()
  }
}

// 保存规则
const saveRule = async () => {
  if (!ruleFormRef.value) return
  
  const valid = await ruleFormRef.value.validate().catch(() => false)
  if (!valid) return
  
  saving.value = true
  try {
    if (isEditMode.value) {
      await captureRuleApi.updateCaptureRule(ruleForm.name, ruleForm)
      ElMessage.success('更新规则成功')
    } else {
      await captureRuleApi.createCaptureRule(ruleForm)
      ElMessage.success('创建规则成功')
    }
    
    dialogVisible.value = false
    await loadData()
  } catch (error) {
    ElMessage.error((isEditMode.value ? '更新' : '创建') + '规则失败：' + error.message)
  } finally {
    saving.value = false
  }
}

// 切换规则状态
const toggleRuleStatus = async (rule) => {
  const originalStatus = !rule.enabled
  rule.updating = true
  
  try {
    await captureRuleApi.updateCaptureRule(rule.name, rule)
    ElMessage.success(`规则已${rule.enabled ? '启用' : '禁用'}`)
  } catch (error) {
    // 恢复原状态
    rule.enabled = originalStatus
    ElMessage.error('更新规则状态失败：' + error.message)
  } finally {
    rule.updating = false
  }
}

// 删除规则
const deleteRule = async (rule) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除规则 "${rule.name}" 吗？此操作不可恢复。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await captureRuleApi.deleteCaptureRule(rule.name)
    ElMessage.success('删除规则成功')
    await loadData()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除规则失败：' + error.message)
    }
  }
}

// 组件挂载时加载数据
onMounted(() => {
  loadData()
})
</script>

<style scoped>
.capture-rule-view {
  padding: 20px;
}

.page-header {
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0 0 8px 0;
  color: #303133;
}

.page-description {
  margin: 0;
  color: #606266;
  font-size: 14px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 16px 20px;
  background: #f8f9fa;
  border-radius: 8px;
}

.toolbar-right {
  display: flex;
  align-items: center;
}

.stats-text {
  color: #606266;
  font-size: 14px;
}

.table-container {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.pattern-text {
  font-family: Monaco, 'Courier New', monospace;
  font-size: 12px;
  color: #409eff;
  word-break: break-all;
}

.description-text {
  color: #606266;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .capture-rule-view {
    padding: 12px;
  }
  
  .toolbar {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .toolbar-right {
    justify-content: center;
  }
}
</style> 