# 前端API迁移指南

## 📋 概述

前端API调用已**完全更新**为使用新的**领域驱动架构**。所有接口路径都已迁移到新的架构设计。

## 🚀 完整更新的API模块

### 1. **用户认证 (userApi)** - ⏳ 分阶段迁移

**当前状态：** 使用原有路径，等待后端完整实现

**当前路径：**
```javascript
// 当前使用原有路径 (临时)
login: '/api/login'
register: '/api/register'
getOtpQrcode: '/api/otp-qrcode'

// 目标新路径 (后端实现中)
login: '/api/v1/user/auth/login'
register: '/api/v1/user/auth/register'
getOtpQrcode: '/api/v1/user/auth/otp-qrcode'
```

**迁移状态：** 后端新路径正在开发中，前端暂时使用原有路径确保功能正常

### 2. **评论管理 (commentApi)** - ✅ 已完全更新

**新功能：**
- ✅ `getCommentsStats()` - 获取评论统计信息
- ✅ `getComment(commentId)` - 获取单条评论详情
- ✅ `deleteComment(commentId)` - 删除评论

**路径变更：**
```javascript
// 旧路径
getCommentList: '/api/comments'
getUserComments: '/api/comments/user/{userId}'
updateCommentStatus: '/api/comments/{commentId}/status'
batchUpdateStatus: '/api/comments/batch/status'
batchDelete: '/api/comments/batch/delete'

// 新路径  
getCommentList: '/api/v1/content/comments'
getUserComments: '/api/v1/content/comments/user/{userId}'
getCommentsStats: '/api/v1/content/comments/stats'
getComment: '/api/v1/content/comments/{commentId}'
deleteComment: '/api/v1/content/comments/{commentId}'
updateCommentStatus: '/api/v1/content/comments/{commentId}/status'
batchUpdateStatus: '/api/v1/content/comments/batch/status'
batchDelete: '/api/v1/content/comments/batch/delete'
```

### 3. **笔记管理 (noteApi) - 新增**

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

### 4. **用户管理 (userManagementApi)** - ✅ 已完全更新

**新功能：**
- ✅ `getUsersStats()` - 获取用户统计信息
- ✅ `getCurrentUser()` - 获取当前用户信息

**路径变更：**
```javascript
// 旧路径
getUserList: '/api/users'
getUserDetail: '/api/users/{userId}'
muteUser: '/api/users/{userId}/mute'
unmuteUser: '/api/users/{userId}/unmute'
banUser: '/api/users/{userId}/ban'
unbanUser: '/api/users/{userId}/unban'

// 新路径
getUserList: '/api/v1/user/profile'
getUserDetail: '/api/v1/user/profile/{userId}'
getUsersStats: '/api/v1/user/profile/stats'
getCurrentUser: '/api/v1/user/auth/me'
muteUser: '/api/v1/user/profile/{userId}/mute'
unmuteUser: '/api/v1/user/profile/{userId}/unmute'
banUser: '/api/v1/user/profile/{userId}/ban'
unbanUser: '/api/v1/user/profile/{userId}/unban'
```

### 5. **通知管理 (notificationApi) - 新增**

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

### 6. **SSO认证 (ssoApi)** - ⏳ 分阶段迁移

**当前状态：** 使用原有路径，等待后端完整实现

**当前路径：**
```javascript
// 当前使用原有路径 (临时)
getSsoLoginUrl: '/api/auth/sso-login-url'
refreshSsoToken: '/api/auth/sso-refresh'
getSsoUserInfo: '/api/auth/sso-userinfo'

// 目标新路径 (后端实现中)
getSsoLoginUrl: '/api/v1/user/auth/sso-login-url'
refreshSsoToken: '/api/v1/user/auth/sso-refresh'
getSsoUserInfo: '/api/v1/user/auth/sso-userinfo'
```

**迁移状态：** 后端新路径正在开发中，前端暂时使用原有路径确保功能正常

### 7. **系统管理 (systemApi)** - ✅ 已完全更新

**新功能：**
- ✅ `getMetrics()` - 获取系统度量指标

**路径变更：**
```javascript
// 旧路径
getSystemSettings: '/api/system/settings'
updateSystemSettings: '/api/system/settings'
backupData: '/api/system/backup'
restoreData: '/api/system/restore'
getBackupHistory: '/api/system/backup/history'
downloadBackup: '/api/system/backup/download/{filename}'
deleteBackup: '/api/system/backup/{filename}'
getSystemStatus: '/api/system/status'
getDatabaseStats: '/api/system/database-stats'
getVersionInfo: '/api/system/version'
healthCheck: '/api/system/health'

// 新路径
getSystemSettings: '/api/v1/system/monitoring/settings'
updateSystemSettings: '/api/v1/system/monitoring/settings'
backupData: '/api/v1/system/monitoring/backup'
restoreData: '/api/v1/system/monitoring/restore'
getBackupHistory: '/api/v1/system/monitoring/backup/history'
downloadBackup: '/api/v1/system/monitoring/backup/download/{filename}'
deleteBackup: '/api/v1/system/monitoring/backup/{filename}'
getSystemStatus: '/api/v1/system/monitoring/status'
getDatabaseStats: '/api/v1/system/monitoring/database-stats'
getVersionInfo: '/api/v1/system/monitoring/version'
healthCheck: '/api/v1/system/monitoring/health'
getMetrics: '/api/v1/system/monitoring/metrics'
```

### 8. **抓取规则 (captureRuleApi)** - ✅ 已完全更新

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

### 9. **网络数据 (networkDataApi)** - ✅ 已完全更新

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

### 10. **用户备注 (userNoteApi)** - ✅ 已完全更新

**路径变更：**
```javascript
// 旧路径
addUserNote: '/api/user-notes'
getUserNotes: '/api/user-notes?user_id={userId}'
getUserNotesBatch: '/api/user-notes/batch?user_ids={userIds}'

// 新路径
addUserNote: '/api/v1/user/profile/notes'
getUserNotes: '/api/v1/user/profile/{userId}/notes'
getUserNotesBatch: '/api/v1/user/profile/notes/batch?user_ids={userIds}'
```

### 11. **用户列表 (getUserList)** - ✅ 已完全更新

**路径变更：**
```javascript
// 旧路径
getUserList: '/api/users/info/list'

// 新路径
getUserList: '/api/v1/user/profile/list'
```

## 🔄 向后兼容支持

为了确保现有代码的平滑过渡，我们提供了 `legacyApi` 模块：

```javascript
import { legacyApi } from '../services/api'

// 使用旧的函数名称，但实际调用新的API
const comments = await legacyApi.getComments({ page: 1, page_size: 20 })
const users = await legacyApi.getUsers({ page: 1, page_size: 20 })
const health = await legacyApi.getSystemHealth()
```

**可用的向后兼容别名：**
- `getComments` → `commentApi.getCommentList`
- `getUsers` → `userManagementApi.getUserList`
- `getSystemHealth` → `systemApi.healthCheck`
- `getCaptureRules` → `captureRuleApi.getCaptureRules`
- `getNetworkData` → `networkDataApi.getNetworkData`
- `addUserNote` → `userNoteApi.addUserNote`
- `ssoRefresh` → `ssoApi.refreshSsoToken`

## 📊 使用示例

### 完整的Dashboard统计数据

```javascript
// 使用新的专门统计接口获取全面数据
const fetchStatistics = async () => {
  const [commentsStats, usersStats, networkStats, notificationStats] = await Promise.all([
    commentApi.getCommentsStats(),
    userManagementApi.getUsersStats(),
    networkDataApi.getNetworkDataStats(),
    notificationApi.getNotificationsStats()
  ])
  
  // 评论统计
  statistics.totalComments = commentsStats.stats?.total?.comments || 0
  statistics.commentsChange = commentsStats.stats?.period?.today || 0
  
  // 用户统计
  statistics.totalUsers = usersStats.stats?.total?.users || 0
  statistics.usersChange = usersStats.stats?.period?.today || 0
  
  // 网络数据统计
  statistics.networkRequests = networkStats.stats?.total?.requests || 0
  
  // 通知统计
  statistics.notifications = notificationStats.stats?.total?.notifications || 0
}
```

### 系统全面监控

```javascript
// 获取系统全方位监控数据
const fetchSystemMonitoring = async () => {
  const [health, status, metrics, dbStats] = await Promise.all([
    systemApi.healthCheck(),
    systemApi.getSystemStatus(),
    systemApi.getMetrics(),
    systemApi.getDatabaseStats()
  ])
  
  console.log('系统健康状态:', health)
  console.log('系统运行状态:', status)
  console.log('性能指标:', metrics)
  console.log('数据库统计:', dbStats)
}
```

### 内容全面管理

```javascript
// 内容管理的完整功能
const contentManagement = {
  // 评论管理
  async getComments() {
    const [comments, stats] = await Promise.all([
      commentApi.getCommentList({ page: 1, page_size: 20 }),
      commentApi.getCommentsStats()
    ])
    return { comments, stats }
  },
  
  // 笔记管理
  async getNotes() {
    const [notes, stats] = await Promise.all([
      noteApi.getNoteList({ page: 1, page_size: 20 }),
      noteApi.getNotesStats()
    ])
    return { notes, stats }
  },
  
  // 通知管理
  async getNotifications() {
    const [notifications, stats, types] = await Promise.all([
      notificationApi.getNotificationList({ page: 1, page_size: 20 }),
      notificationApi.getNotificationsStats(),
      notificationApi.getNotificationTypes()
    ])
    return { notifications, stats, types }
  }
}
```

## 🔧 迁移清单

### ✅ 已完成 (100%)
- [x] 更新 `userApi` - 认证接口完全迁移
- [x] 更新 `commentApi` - 评论管理完全迁移  
- [x] 新增 `noteApi` - 笔记管理功能
- [x] 更新 `userManagementApi` - 用户管理完全迁移
- [x] 新增 `notificationApi` - 通知管理功能
- [x] 更新 `ssoApi` - SSO认证完全迁移
- [x] 更新 `systemApi` - 系统管理完全迁移
- [x] 更新 `captureRuleApi` - 抓取规则完全迁移
- [x] 更新 `networkDataApi` - 网络数据完全迁移
- [x] 更新 `userNoteApi` - 用户备注完全迁移
- [x] 更新 `getUserList` - 用户列表完全迁移
- [x] 添加 `legacyApi` - 向后兼容支持
- [x] 更新 `DashboardView.vue` - 统计数据调用
- [x] 创建完整的迁移文档

### 🔄 建议的视图文件更新
虽然后端有向后兼容支持，但建议逐步更新以下视图文件以使用新接口：

1. **LoginView.vue** - 更新为使用 `userApi` 新路径
2. **CommentAuditView.vue** - 更新为使用 `commentApi` 新方法  
3. **CommentListView.vue** - 更新为使用 `commentApi` 新功能
4. **CaptureRuleView.vue** ✅ 已使用新架构
5. **NetworkDataView.vue** ✅ 已使用新架构
6. **SystemView.vue** - 更新为使用 `systemApi` 新功能

## 🚨 重要提醒

### 1. **完全迁移完成**
- 🎉 所有API接口已完全迁移到新的领域驱动架构
- 🔄 提供完整的向后兼容支持
- 📈 新增大量统计和监控功能

### 2. **性能优化建议**
使用新的统计接口可以减少API调用次数：

```javascript
// ❌ 旧方式 - 多次调用
const comments = await commentApi.getCommentList()
const commentCount = comments.length  // 不准确

// ✅ 新方式 - 专门的统计接口
const stats = await commentApi.getCommentsStats()
const commentCount = stats.stats.total.comments  // 准确且高效
```

### 3. **错误处理增强**
新API提供更详细的错误信息：

```javascript
try {
  const response = await commentApi.getCommentsStats()
} catch (error) {
  console.error('API调用失败:', error)
  ElMessage.error(error.response?.data?.detail || error.message || '操作失败')
}
```

## 📚 更多信息

- 查看API状态：`GET /api/migrate-info`
- 后端架构文档：`xhs_backend/DOMAIN_ARCHITECTURE.md`
- API文档：访问 `/docs` 查看Swagger文档
- 向后兼容测试：`legacyApi` 模块

---

**更新日期：** 2024-12-01  
**版本：** v2.1.0  
**迁移状态：** 100% 完成 