# 前端API迁移指南

## 📋 概述

前端API调用已更新为使用新的**领域驱动架构**。本文档说明了API路径变更和使用方法。

## 🚀 已更新的API模块

### 1. **评论管理 (commentApi)**

**新功能：**
- ✅ `getCommentsStats()` - 获取评论统计信息
- ✅ `getComment(commentId)` - 获取单条评论详情
- ✅ `deleteComment(commentId)` - 删除评论

**路径变更：**
```javascript
// 旧路径
getCommentList: '/api/comments'
getUserComments: '/api/comments/user/{userId}'

// 新路径  
getCommentList: '/api/v1/content/comments'
getUserComments: '/api/v1/content/comments/user/{userId}'
getCommentsStats: '/api/v1/content/comments/stats'
getComment: '/api/v1/content/comments/{commentId}'
deleteComment: '/api/v1/content/comments/{commentId}'
```

### 2. **笔记管理 (noteApi) - 新增**

```javascript
import { noteApi } from '../services/api'

// 获取笔记列表
const notes = await noteApi.getNoteList({ page: 1, page_size: 20 })

// 获取笔记统计
const stats = await noteApi.getNotesStats()

// 获取单条笔记
const note = await noteApi.getNote(noteId)

// 删除笔记
await noteApi.deleteNote(noteId)
```

### 3. **用户管理 (userManagementApi)**

**新功能：**
- ✅ `getUsersStats()` - 获取用户统计信息
- ✅ `getCurrentUser()` - 获取当前用户信息

**路径变更：**
```javascript
// 旧路径
getUserList: '/api/users'
getUserDetail: '/api/users/{userId}'

// 新路径
getUserList: '/api/v1/user/profile'
getUserDetail: '/api/v1/user/profile/{userId}'
getUsersStats: '/api/v1/user/profile/stats'
getCurrentUser: '/api/v1/user/auth/me'
```

### 4. **通知管理 (notificationApi) - 新增**

```javascript
import { notificationApi } from '../services/api'

// 获取通知列表
const notifications = await notificationApi.getNotificationList({ page: 1, page_size: 20 })

// 获取通知统计
const stats = await notificationApi.getNotificationsStats()

// 获取通知类型
const types = await notificationApi.getNotificationTypes()

// 获取单条通知
const notification = await notificationApi.getNotification(notificationId)

// 删除通知
await notificationApi.deleteNotification(notificationId)
```

### 5. **SSO认证 (ssoApi)**

**路径变更：**
```javascript
// 旧路径
getSsoLoginUrl: '/api/auth/sso-login-url'
refreshSsoToken: '/api/auth/sso-refresh'
getSsoUserInfo: '/api/auth/sso-userinfo'

// 新路径
getSsoLoginUrl: '/api/v1/user/auth/sso-login-url'
refreshSsoToken: '/api/v1/user/auth/sso-refresh'
getSsoUserInfo: '/api/v1/user/auth/sso-userinfo'
```

### 6. **系统管理 (systemApi)**

**新功能：**
- ✅ `getMetrics()` - 获取系统度量指标

**路径变更：**
```javascript
// 旧路径
getSystemStatus: '/api/system/status'
getDatabaseStats: '/api/system/database-stats'
getVersionInfo: '/api/system/version'
healthCheck: '/api/system/health'

// 新路径
getSystemStatus: '/api/v1/system/monitoring/status'
getDatabaseStats: '/api/v1/system/monitoring/database-stats'
getVersionInfo: '/api/v1/system/monitoring/version'
healthCheck: '/api/v1/system/monitoring/health'
getMetrics: '/api/v1/system/monitoring/metrics'
```

### 7. **抓取规则 (captureRuleApi)**

**路径变更：**
```javascript
// 旧路径
getAllCaptureRules: '/api/system/capture-rules/all'
getCaptureRules: '/api/system/capture-rules'
createCaptureRule: '/api/system/capture-rules'
updateCaptureRule: '/api/system/capture-rules/{ruleName}'
deleteCaptureRule: '/api/system/capture-rules/{ruleName}'

// 新路径
getAllCaptureRules: '/api/v1/system/capture-rules/all'
getCaptureRules: '/api/v1/system/capture-rules'
createCaptureRule: '/api/v1/system/capture-rules'
updateCaptureRule: '/api/v1/system/capture-rules/{ruleName}'
deleteCaptureRule: '/api/v1/system/capture-rules/{ruleName}'
```

### 8. **网络数据 (networkDataApi)**

**新功能：**
- ✅ `getNetworkDataStats()` - 获取网络数据统计
- ✅ `batchProcessNetworkData()` - 批量处理网络数据

**路径变更：**
```javascript
// 旧路径
getNetworkData: '/api/network-data'
receiveNetworkData: '/api/system/network-data'

// 新路径
getNetworkData: '/api/v1/system/network-data'
getNetworkDataStats: '/api/v1/system/network-data/stats'
batchProcessNetworkData: '/api/v1/system/network-data/batch-process'
receiveNetworkData: '/api/v1/system/network-data'
```

## 📊 使用示例

### Dashboard统计数据更新

```javascript
// 旧方式
const fetchStatistics = async () => {
  const response = await systemApi.getSystemSettings()
  // 处理数据...
}

// 新方式 - 使用专门的统计接口
const fetchStatistics = async () => {
  const [commentsStats, usersStats] = await Promise.all([
    commentApi.getCommentsStats(),
    systemApi.getDatabaseStats()
  ])
  
  // 评论统计
  statistics.totalComments = commentsStats.stats?.total?.comments || 0
  statistics.commentsChange = commentsStats.stats?.period?.today || 0
  
  // 用户统计
  statistics.totalUsers = usersStats.total_stats?.users || 0
  statistics.usersChange = usersStats.daily_stats?.users || 0
}
```

### 系统监控页面

```javascript
// 健康检查
const healthStatus = await systemApi.healthCheck()

// 系统状态
const systemStatus = await systemApi.getSystemStatus()

// 数据库统计
const dbStats = await systemApi.getDatabaseStats()

// 性能指标
const metrics = await systemApi.getMetrics()
```

### 内容管理页面

```javascript
// 评论管理
const comments = await commentApi.getCommentList({ page: 1, page_size: 20 })
const commentStats = await commentApi.getCommentsStats()

// 笔记管理
const notes = await noteApi.getNoteList({ page: 1, page_size: 20 })
const noteStats = await noteApi.getNotesStats()

// 通知管理
const notifications = await notificationApi.getNotificationList({ page: 1, page_size: 20 })
const notificationStats = await notificationApi.getNotificationsStats()
```

## 🔧 迁移清单

### ✅ 已完成
- [x] 更新 `src/services/api.js` 中所有API路径
- [x] 添加新的领域API模块 (noteApi, notificationApi)
- [x] 更新 `DashboardView.vue` 统计数据获取方式
- [x] 保持向后兼容的接口

### 🔄 需要更新的视图文件
以下文件中的API调用已兼容，但建议逐步更新：

1. **LoginView.vue** - SSO相关调用 ✅ 已更新
2. **DashboardView.vue** - 统计数据调用 ✅ 已更新
3. **CaptureRuleView.vue** - 抓取规则调用 ✅ 已更新
4. **NetworkDataView.vue** - 网络数据调用 ✅ 已更新
5. **CommentAuditView.vue** - 评论管理调用 (使用向后兼容接口)
6. **CommentListView.vue** - 评论列表调用 (使用向后兼容接口)

## 🚨 注意事项

### 1. **向后兼容性**
- 原有API路径在后端会自动重定向到新路径
- 建议逐步迁移到新的API接口，获得更好的功能支持

### 2. **错误处理**
新的API可能返回不同的错误格式，请注意更新错误处理逻辑：

```javascript
try {
  const response = await commentApi.getCommentsStats()
} catch (error) {
  console.error('API调用失败:', error)
  ElMessage.error(error.response?.data?.detail || error.message || '操作失败')
}
```

### 3. **响应数据结构**
新API的响应结构更加标准化：

```javascript
// 统一响应格式
{
  "success": true,
  "data": {...},
  "message": "操作成功",
  "total": 100,
  "page": 1,
  "page_size": 20
}
```

## 📚 更多信息

- 查看完整的API映射：`GET /api/migrate-info`
- 后端架构文档：`xhs_backend/DOMAIN_ARCHITECTURE.md`
- API文档：访问 `/docs` 查看Swagger文档

---

**更新日期：** 2024-12-01  
**版本：** v2.1.0 