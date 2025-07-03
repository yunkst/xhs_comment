# 小红书笔记详情数据采集功能使用指南

## 功能概述

本功能实现了对小红书网页中 `window.__INITIAL_STATE__.note.noteDetailMap` 对象的自动提取和上传，可以获取到完整的笔记详情信息，包括：

### 📝 笔记基本信息
- **noteId**: 笔记唯一标识符
- **type**: 笔记类型（"video" 视频笔记、"normal" 图文笔记）
- **title**: 笔记标题
- **desc**: 笔记描述内容
- **time**: 发布时间戳
- **lastUpdateTime**: 最后更新时间戳
- **ipLocation**: 发布地理位置

### 👤 作者信息
- **userId**: 用户ID
- **nickname**: 用户昵称
- **avatar**: 用户头像URL
- **xsecToken**: 用户安全令牌

### 💖 互动数据
- **likedCount**: 点赞数量
- **collectedCount**: 收藏数量
- **commentCount**: 评论数量
- **shareCount**: 分享数量
- **liked**: 当前用户是否已点赞
- **collected**: 当前用户是否已收藏
- **followed**: 是否关注作者

### 🎯 话题标签
- **id**: 话题ID
- **name**: 话题名称
- **type**: 话题类型

### 🖼️ 媒体内容
- **imageList**: 图片列表（包含URL、尺寸等）
- **video**: 视频信息（包含时长、画质、编码等）

### 💬 评论信息
- **comments**: 完整的评论数据，包括主评论和子评论
- 每条评论包含：作者信息、内容、时间、点赞数、回复等

## 使用方法

### 1. 插件端使用

#### 自动提取
插件会自动在小红书页面启动笔记详情提取器：

```javascript
// 插件会自动启动，无需手动操作
// 每5秒检查一次页面中的笔记详情数据
// 发现新数据时自动上传到后台
```

#### 手动控制
在浏览器控制台中可以使用以下命令：

```javascript
// 查看提取器状态
window.xhsNoteDetailExtractor.status()

// 手动触发提取
window.xhsNoteDetailExtractor.extract()

// 启动提取器
window.xhsNoteDetailExtractor.start()

// 停止提取器
window.xhsNoteDetailExtractor.stop()

// 清除缓存（重新提取已处理的笔记）
window.xhsNoteDetailExtractor.clearCache()
```

#### 状态信息
```javascript
{
  isRunning: true,        // 是否正在运行
  extractedCount: 15,     // 已提取的笔记数量
  queueLength: 0,         // 待上传队列长度
  isUploading: false      // 是否正在上传
}
```

### 2. 后台API

#### 上传笔记详情数据
```http
POST /api/v1/content/notes/details/upload
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

[
  {
    "noteId": "64a123...",
    "type": "normal",
    "title": "美食分享",
    "desc": "今天做的超好吃的蛋糕",
    "time": 1672531200000,
    "user": {
      "userId": "user123",
      "nickname": "小美食家"
    },
    "interactInfo": {
      "likedCount": "128",
      "commentCount": "45"
    },
    "comments": {
      "list": [...],
      "hasMore": true
    }
  }
]
```

#### 查询笔记详情列表
```http
GET /api/v1/content/notes/details/list?page=1&page_size=20&keyword=美食&note_type=normal
```

#### 获取单条笔记详情
```http
GET /api/v1/content/notes/details/{noteId}
```

### 3. 前端管理界面

访问管理系统的 **"笔记详情数据"** 页面：

1. **数据列表**: 查看所有采集到的笔记详情
2. **搜索过滤**: 按关键字、作者、类型、日期范围搜索
3. **详情查看**: 点击详情按钮查看完整数据
4. **多标签展示**: 基本信息、互动数据、评论、标签等分页显示

## 数据结构

### 完整数据模型
```json
{
  "noteId": "64a123456789abcdef",
  "type": "normal",
  "title": "美食分享 - 自制芝士蛋糕",
  "desc": "周末在家做的芝士蛋糕，奶香浓郁...",
  "time": 1672531200000,
  "lastUpdateTime": 1672531300000,
  "ipLocation": "北京",
  "user": {
    "userId": "user123",
    "nickname": "小美食家",
    "avatar": "https://...",
    "xsecToken": "token123"
  },
  "interactInfo": {
    "liked": false,
    "collected": false,
    "followed": false,
    "likedCount": "128",
    "collectedCount": "89",
    "commentCount": "45",
    "shareCount": "12"
  },
  "imageList": [
    {
      "urlPre": "https://...",
      "urlDefault": "https://...",
      "height": 1080,
      "width": 1920
    }
  ],
  "tagList": [
    {
      "id": "tag123",
      "name": "美食",
      "type": "topic"
    }
  ],
  "comments": {
    "list": [
      {
        "id": "comment123",
        "content": "看起来好好吃！",
        "createTime": 1672531400000,
        "likeCount": "5",
        "userInfo": {
          "nickname": "小吃货",
          "image": "https://..."
        },
        "subComments": [...]
      }
    ],
    "hasMore": true,
    "cursor": "cursor123"
  },
  "fetchTimestamp": "2024-01-15T10:30:00.000Z",
  "source": "noteDetailMap"
}
```

## 技术特点

### 1. 智能去重
- 使用笔记ID作为唯一标识
- 1分钟内不重复提取同一笔记
- 数据库层面upsert操作，避免重复存储

### 2. 批量处理
- 每次最多上传10条笔记详情
- 队列化上传，避免请求过于频繁
- 失败重试机制

### 3. 实时监控
- 监听页面URL变化
- DOM变化检测
- 定时检查机制

### 4. 完整数据
- 提取完整的笔记详情信息
- 包含嵌套的评论数据
- 保留原始数据结构

## 部署和配置

### 1. 后端部署
确保数据库中有 `note_details` 集合：

```python
# 已在 database.py 中添加
NOTE_DETAILS_COLLECTION = "note_details"
```

### 2. 插件更新
新版本插件已包含笔记详情提取器：

```javascript
// 文件已添加到 manifest.json
"injected/note-detail-extractor.js"
```

### 3. 前端页面
管理界面已添加笔记详情数据页面：

```
/content/note-details
```

## 监控和调试

### 1. 控制台日志
插件会输出详细的日志信息：

```
[NoteDetailExtractor] 启动笔记详情数据提取器
[NoteDetailExtractor] 提取到笔记详情: 美食分享
[NoteDetailExtractor] 本次提取到 3 条新笔记详情
[NoteDetailExtractor] 正在上传 3 条笔记详情数据
[NoteDetailExtractor] 笔记详情数据上传成功
```

### 2. 错误处理
- 网络请求失败会自动重试
- 数据格式错误会跳过并记录日志
- 上传失败的数据会保留在队列中

### 3. 性能优化
- 延迟启动避免影响页面加载
- 短暂延迟避免请求过于频繁
- 内存中缓存已处理的笔记ID

## 使用场景

1. **内容分析**: 分析热门笔记的特征和互动数据
2. **用户研究**: 了解用户行为和偏好
3. **竞品分析**: 研究同类内容的表现
4. **数据挖掘**: 从大量笔记数据中发现规律
5. **趋势分析**: 跟踪话题标签的流行趋势

## 注意事项

1. **合规使用**: 请遵守小红书的使用条款和相关法律法规
2. **数据隐私**: 妥善保护用户数据，不得用于非法用途
3. **频率控制**: 避免过于频繁的数据采集影响网站性能
4. **存储管理**: 定期清理不需要的历史数据
5. **权限控制**: 确保只有授权用户可以访问敏感数据

## 故障排除

### 常见问题

1. **提取器不工作**
   - 检查是否在小红书页面
   - 确认插件是否正确加载
   - 查看控制台是否有错误

2. **数据上传失败**
   - 检查网络连接
   - 确认后台服务是否运行
   - 检查认证token是否有效

3. **前端页面显示异常**
   - 清除浏览器缓存
   - 检查API请求是否正常
   - 确认路由配置是否正确

### 调试命令

```javascript
// 检查当前页面的笔记数据
console.log(window.__INITIAL_STATE__?.note?.noteDetailMap);

// 手动提取
window.xhsNoteDetailExtractor.extract();

// 查看详细状态
console.log(window.xhsNoteDetailExtractor.status());
```

---

## 技术支持

如有问题，请检查：
1. 后台服务日志
2. 浏览器控制台输出
3. 网络请求状态
4. 数据库连接情况

更多技术细节请参考源代码注释和API文档。 