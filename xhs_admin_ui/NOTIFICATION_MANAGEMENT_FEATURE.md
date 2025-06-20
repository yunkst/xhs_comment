# 🔔 小红书通知管理功能

## 📋 功能概述

**更新日期：** 2024-12-01  
**功能版本：** v1.0.0  
**主要功能：** 新增小红书通知管理页面，支持通知列表展示和备注功能

## ✨ 新增功能

### 1. 小红书通知管理页面 ✅
- ✅ **统计卡片**：显示总通知数、今日新增、通知类型数、活跃用户数
- ✅ **通知列表**：展示所有从固化抓取规则获取的通知信息
- ✅ **搜索功能**：支持按用户ID、通知类型、关键词、日期范围搜索
- ✅ **备注功能**：每条通知旁边都有备注文本框，支持添加、编辑、保存、清除备注
- ✅ **详情查看**：点击查看通知的详细信息，包含备注编辑功能
- ✅ **实时保存**：支持失焦自动保存和Ctrl+Enter快捷键保存

### 2. 菜单导航 ✅
- ✅ **菜单入口**：在"小红书管理"子菜单中添加"小红书通知"选项
- ✅ **路由配置**：配置 `/content/notifications` 路由访问通知管理页面
- ✅ **面包屑导航**：显示当前页面位置

### 3. 备注功能设计 ✅
- ✅ **表格内备注**：每行通知都有独立的备注文本框
- ✅ **详情页备注**：点击详情查看时，可以编辑更详细的备注
- ✅ **批量加载**：页面加载时批量获取所有用户的备注数据
- ✅ **实时保存**：支持多种保存方式（失焦、快捷键、按钮点击）
- ✅ **哈希匹配**：使用通知哈希值关联备注数据，确保数据一致性

## 🎯 页面功能详解

### 统计信息卡片
- **总通知数**：显示数据库中所有通知的总数量
- **今日新增**：显示今天新抓取的通知数量
- **通知类型数**：显示不同通知类型的数量
- **活跃用户数**：显示有通知活动的用户数量

### 搜索和筛选
- **用户ID搜索**：精确匹配用户ID
- **通知类型筛选**：按通知类型（评论、点赞、关注、@等）筛选
- **关键词搜索**：在通知内容中搜索关键词
- **日期范围**：按通知时间范围筛选
- **重置功能**：一键清空所有搜索条件

### 通知列表表格
| 列名 | 说明 | 功能 |
|------|------|------|
| 用户ID | 通知相关的用户ID | 显示用户信息 |
| 通知类型 | 通知的类型标签 | 彩色标签显示 |
| 通知内容 | 通知的主要内容 | 显示通知信息 |
| 用户名 | 通知相关的用户名 | 显示用户名称 |
| **备注** | **备注文本框** | **支持添加、编辑、保存、清除** |
| 时间 | 通知的时间戳 | 格式化时间显示 |
| 操作 | 查看详情按钮 | 打开详情对话框 |

### 🔥 备注功能特色

#### 1. **表格内备注编辑**
```vue
<el-input
  v-model="row.userNote"
  type="textarea"
  :rows="2"
  placeholder="添加备注..."
  @blur="handleNoteSave(row)"
  @keydown.enter.ctrl="handleNoteSave(row)"
  size="small"
/>
```

#### 2. **智能保存机制**
- **失焦保存**：输入框失去焦点时自动保存
- **快捷键保存**：Ctrl+Enter 快速保存
- **按钮保存**：点击保存按钮确认保存
- **加载状态**：保存过程中显示加载状态

#### 3. **批量备注加载**
```javascript
// 批量获取用户备注
const response = await userNoteApi.getUserNotesBatch(userIds)

// 将备注数据映射到通知对象
notifications.value.forEach(notification => {
  const notificationHash = generateNotificationHash(notification)
  notification.userNote = userNotes.value[notificationHash] || ''
})
```

#### 4. **通知哈希生成**
```javascript
const generateNotificationHash = (notification) => {
  const userId = notification.userId || ''
  const contentPreview = (notification.content || '').substring(0, 20).replace(/\s+/g, '')
  const notificationType = notification.type || ''
  
  return `${userId}_${contentPreview}_${notificationType}`
}
```

## 🛠️ 技术实现

### 前端技术栈
- **Vue 3** + **Composition API**
- **Element Plus** UI 组件库
- **响应式设计** 适配不同屏幕尺寸
- **TypeScript** 类型支持

### API 接口
```javascript
// 通知管理 API
export const notificationApi = {
  getNotificationList: (params) => api.get('/api/notifications', { params }),
  getNotificationsStats: () => api.get('/api/notifications/stats'),
  getNotificationTypes: () => api.get('/api/notifications/types'),
  getNotification: (id) => api.get(`/api/notifications/${id}`),
  deleteNotification: (id) => api.delete(`/api/notifications/${id}`),
  searchNotifications: (params) => api.get('/api/notifications', { params })
}

// 用户备注 API
export const userNoteApi = {
  addUserNote: (data) => api.post('/api/user-notes', data),
  getUserNotes: (userId) => api.get(`/api/user-notes?user_id=${userId}`),
  getUserNotesBatch: (userIds) => api.get(`/api/user-notes/batch?user_ids=${userIds.join(',')}`)
}
```

### 数据流程
```
固化抓取规则 → 通知数据 → 数据库存储 → 通知管理页面
                                    ↓
用户添加备注 → 备注API → 用户备注数据库 → 页面展示备注
```

## 📱 使用方式

### 访问路径
1. 登录管理后台
2. 点击左侧菜单"小红书管理"
3. 选择"小红书通知"子菜单
4. 进入通知管理页面：`/content/notifications`

### 备注操作
1. **添加备注**：在通知行的备注列中直接输入文本
2. **保存备注**：
   - 方式1：输入完成后点击其他地方（失焦保存）
   - 方式2：按 `Ctrl + Enter` 快捷键保存
   - 方式3：点击"保存"按钮
3. **编辑备注**：直接在文本框中修改内容
4. **清除备注**：点击"清除"按钮删除备注
5. **详情备注**：点击"详情"按钮，在弹窗中编辑更详细的备注

### 搜索和筛选
- **用户搜索**：在"用户ID"框中输入用户ID
- **类型筛选**：在"通知类型"下拉框中选择类型
- **关键词搜索**：在"关键词"框中输入搜索词
- **时间筛选**：选择日期范围
- **执行搜索**：点击"查询"按钮
- **重置条件**：点击"重置"按钮清空所有条件

## 📈 数据来源

通知数据来自固化抓取规则：
- **抓取接口**：`edith.xiaohongshu.com/api/sns/web/v1/you/mentions`
- **数据类型**：通知列表（评论、点赞、关注、@等）
- **处理流程**：Chrome插件抓取 → 后端解析 → 数据库存储 → 前端展示

## 🎨 UI 设计特色

### 1. **统计卡片设计**
- 渐变色背景，视觉效果佳
- 图标 + 数据的清晰布局
- 响应式设计，适配不同屏幕

### 2. **表格设计**
- 斑马纹表格，易于阅读
- 固定操作列，方便操作
- 悬停效果，交互友好

### 3. **备注组件设计**
- 内联编辑，操作直观
- 自适应高度文本框
- 操作按钮仅在有内容时显示

### 4. **搜索表单设计**
- 浅灰色背景区分
- 内联表单布局，紧凑高效
- 清晰的标签和占位符

## 🔧 技术优化

### 1. **性能优化**
- 批量API调用减少请求次数
- 虚拟滚动支持大量数据
- 防抖搜索避免频繁请求

### 2. **用户体验优化**
- 加载状态提示
- 错误处理和用户反馈
- 快捷键支持提高效率

### 3. **数据一致性**
- 通知哈希确保备注关联正确
- 实时数据同步
- 乐观更新策略

## 🚀 未来扩展

### 计划功能
- [ ] 批量备注操作
- [ ] 备注历史记录
- [ ] 备注导出功能
- [ ] 通知标签分类
- [ ] 通知优先级设置
- [ ] 通知自动处理规则

---

**🎉 小红书通知管理功能已成功实现！**

现在你可以在管理后台中方便地查看所有通知信息，并为每条通知添加个性化备注，大大提升了通知管理的效率和便利性。 