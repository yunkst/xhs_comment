# 小红书评论维护系统 - 前端API使用文档

## 概述

本文档描述了前端管理界面 (`xhs_admin_ui`) 使用的所有后端API接口。所有接口都基于RESTful设计，使用JSON格式进行数据交换。

## 基础信息

- **基础URL**: `/api/v1`
- **认证方式**: Bearer Token (JWT)
- **响应格式**: JSON
- **字符编码**: UTF-8

## 接口分类

### 1. 用户认证接口 (`userApi`)

#### 1.1 用户登录
- **接口**: `POST /api/v1/user/auth/login`
- **描述**: 用户登录，支持用户名密码和OTP验证
- **参数**:
  ```json
  {
    "username": "string",
    "password": "string",
    "otp_code": "string" // 可选，OTP动态验证码
  }
  ```
- **响应**:
  ```json
  {
    "access_token": "string",
    "refresh_token": "string",
    "token_type": "bearer"
  }
  ```

#### 1.2 用户注册
- **接口**: `POST /api/v1/user/auth/register`
- **描述**: 注册新用户
- **参数**:
  ```json
  {
    "username": "string",
    "password": "string"
  }
  ```

#### 1.3 获取OTP二维码
- **接口**: `GET /api/v1/user/auth/otp-qrcode?username={username}`
- **描述**: 获取用户的OTP设置二维码
- **响应**:
  ```json
  {
    "qrcode_url": "data:image/png;base64,..."
  }
  ```

#### 1.4 检查注册状态
- **接口**: `GET /api/v1/user/auth/register-status`
- **描述**: 检查系统是否允许注册
- **响应**:
  ```json
  {
    "allow_register": true
  }
  ```

#### 1.5 检查OTP状态
- **接口**: `GET /api/v1/user/auth/otp-status`
- **描述**: 检查系统是否启用OTP验证
- **响应**:
  ```json
  {
    "otp_enabled": true
  }
  ```

#### 1.6 检查登录状态
- **接口**: `GET /api/v1/user/auth/check-login-status`
- **描述**: 验证当前token是否有效
- **响应**:
  ```json
  {
    "status": "已登录",
    "user_id": "string"
  }
  ```

#### 1.7 获取当前用户信息
- **接口**: `GET /api/v1/user/auth/me`
- **描述**: 获取当前登录用户的详细信息

### 2. SSO相关接口 (`ssoApi`)

#### 2.1 获取SSO登录URL
- **接口**: `GET /api/v1/user/auth/sso-login-url`
- **描述**: 获取Keycloak SSO登录URL

#### 2.2 刷新SSO Token
- **接口**: `POST /api/v1/user/auth/sso-refresh`
- **描述**: 使用refresh_token刷新访问令牌
- **参数**:
  ```json
  {
    "refresh_token": "string"
  }
  ```

#### 2.3 获取SSO用户信息
- **接口**: `GET /api/v1/user/auth/sso-userinfo`
- **描述**: 获取SSO用户信息

#### 2.4 创建SSO会话
- **接口**: `POST /api/v1/user/auth/sso-session`
- **描述**: 为插件创建SSO会话
- **参数**:
  ```json
  {
    "client_type": "chrome_extension"
  }
  ```

#### 2.5 获取SSO会话状态
- **接口**: `GET /api/v1/user/auth/sso-session/{sessionId}`
- **描述**: 查询SSO会话状态

#### 2.6 批准SSO会话
- **接口**: `POST /api/v1/user/auth/sso-approve-session`
- **描述**: 批准插件的SSO授权请求
- **参数**:
  ```json
  {
    "session_id": "string"
  }
  ```

### 3. 评论管理接口 (`commentApi`)

#### 3.1 获取评论列表
- **接口**: `GET /api/v1/content/comments`
- **描述**: 分页获取评论列表
- **参数**:
  - `page`: 页码 (默认: 1)
  - `page_size`: 每页数量 (默认: 20)
  - `keyword`: 搜索关键词
  - `startDate`: 开始日期
  - `endDate`: 结束日期
- **响应**:
  ```json
  {
    "items": [
      {
        "_id": "string",
        "id": "string",
        "content": "string",
        "authorId": "string",
        "authorName": "string",
        "authorAvatar": "string",
        "noteId": "string",
        "timestamp": "string",
        "fetchTimestamp": "string",
        "target_comment": {} // 可选，被回复的评论
      }
    ],
    "total": 100,
    "page": 1,
    "page_size": 20
  }
  ```

#### 3.2 获取评论统计
- **接口**: `GET /api/v1/content/comments/stats`
- **描述**: 获取评论相关统计数据
- **响应**:
  ```json
  {
    "success": true,
    "stats": {
      "total": {
        "comments": 1000
      },
      "period": {
        "today": 50,
        "yesterday": 45,
        "week": 300
      }
    }
  }
  ```

#### 3.3 获取特定用户的评论
- **接口**: `GET /api/v1/content/comments/user/{userId}`
- **描述**: 获取指定用户的历史评论
- **响应**:
  ```json
  {
    "success": true,
    "data": [],
    "total": 10,
    "message": "成功获取用户历史评论"
  }
  ```

#### 3.4 删除评论
- **接口**: `DELETE /api/v1/content/comments/{commentId}`
- **描述**: 删除指定评论

#### 3.5 批量删除评论
- **接口**: `POST /api/v1/content/comments/batch/delete`
- **描述**: 批量删除评论
- **参数**:
  ```json
  {
    "ids": ["commentId1", "commentId2"]
  }
  ```

### 4. 笔记管理接口 (`noteApi`)

#### 4.1 获取笔记列表
- **接口**: `GET /api/v1/content/notes`
- **描述**: 分页获取笔记列表
- **参数**:
  - `page`: 页码
  - `page_size`: 每页数量
  - `noteId`: 笔记ID搜索
  - `authorName`: 作者名称搜索
  - `keyword`: 关键词搜索
  - `startDate`: 开始日期
  - `endDate`: 结束日期
- **响应**:
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "string",
        "noteId": "string",
        "title": "string",
        "noteContent": "string",
        "authorId": "string",
        "publishTime": "string",
        "noteLike": 100,
        "noteCommitCount": 50,
        "fetchTimestamp": "string",
        "illegal_info": {
          "illegal_type": "string",
          "illegal_text": "string"
        }
      }
    ],
    "total": 100
  }
  ```

#### 4.2 获取笔记统计
- **接口**: `GET /api/v1/content/notes/stats`
- **描述**: 获取笔记相关统计数据
- **响应**:
  ```json
  {
    "success": true,
    "stats": {
      "total": {
        "notes": 500
      },
      "period": {
        "today": 10
      },
      "engagement": {
        "total_liked": 5000,
        "total_collected": 1000
      }
    }
  }
  ```

### 5. 通知管理接口 (`notificationApi`)

#### 5.1 获取通知列表
- **接口**: `GET /api/v1/notification/notifications`
- **描述**: 分页获取通知列表
- **参数**:
  - `page`: 页码
  - `page_size`: 每页数量
  - `userId`: 用户ID搜索
  - `type`: 通知类型
  - `keyword`: 关键词搜索
  - `startDate`: 开始日期
  - `endDate`: 结束日期
- **响应**:
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "string",
        "userId": "string",
        "username": "string",
        "type": "评论",
        "content": "string",
        "title": "string",
        "timestamp": "string"
      }
    ],
    "total": 100
  }
  ```

#### 5.2 获取通知统计
- **接口**: `GET /api/v1/notification/notifications/stats`
- **描述**: 获取通知统计数据
- **响应**:
  ```json
  {
    "success": true,
    "stats": {
      "total": {
        "notifications": 1000
      },
      "period": {
        "today": 50
      },
      "by_type": {
        "评论": 500,
        "点赞": 300
      },
      "top_users": []
    }
  }
  ```

#### 5.3 获取通知类型列表
- **接口**: `GET /api/v1/notification/notifications/types`
- **描述**: 获取所有通知类型
- **响应**:
  ```json
  {
    "success": true,
    "types": [
      {
        "type": "评论",
        "count": 500
      }
    ]
  }
  ```

### 6. 小红书用户管理接口 (`xhsUserApi`)

#### 6.1 获取小红书用户列表
- **接口**: `GET /api/v1/user/profile/xhs/list`
- **描述**: 分页获取小红书用户列表
- **参数**:
  - `page`: 页码
  - `page_size`: 每页数量
  - `user_id`: 用户ID搜索
  - `name`: 用户名称搜索
- **响应**:
  ```json
  {
    "data": {
      "items": [
        {
          "id": "string",
          "name": "string",
          "avatar": "string",
          "url": "string",
          "createdAt": "string",
          "updatedAt": "string"
        }
      ],
      "total": 100
    }
  }
  ```

### 7. 用户备注接口 (`userNoteApi`)

#### 7.1 添加用户备注
- **接口**: `POST /api/v1/user/notes`
- **描述**: 为用户添加备注
- **参数**:
  ```json
  {
    "userId": "string",
    "notificationHash": "string",
    "noteContent": "string",
    "content": "string"
  }
  ```

#### 7.2 批量获取用户备注
- **接口**: `GET /api/v1/user/notes/batch?user_ids=id1,id2,id3`
- **描述**: 批量获取多个用户的备注
- **响应**:
  ```json
  {
    "success": true,
    "data": {
      "user_hash_1": "备注内容1",
      "user_hash_2": "备注内容2"
    }
  }
  ```

### 8. 抓取规则管理接口 (`captureRuleApi`)

#### 8.1 获取所有抓取规则（管理员）
- **接口**: `GET /api/v1/system/capture-rules/all`
- **描述**: 获取所有抓取规则，包括禁用的
- **响应**:
  ```json
  {
    "success": true,
    "rules": [
      {
        "name": "string",
        "pattern": "string",
        "data_type": "comment",
        "priority": 5,
        "enabled": true,
        "description": "string"
      }
    ],
    "total_count": 10
  }
  ```

#### 8.2 获取启用的抓取规则（插件用）
- **接口**: `GET /api/v1/system/capture-rules`
- **描述**: 获取启用的抓取规则供插件使用

#### 8.3 创建抓取规则
- **接口**: `POST /api/v1/system/capture-rules`
- **描述**: 创建新的抓取规则
- **参数**:
  ```json
  {
    "name": "string",
    "pattern": "string",
    "data_type": "comment",
    "priority": 5,
    "enabled": true,
    "description": "string"
  }
  ```

#### 8.4 更新抓取规则
- **接口**: `PUT /api/v1/system/capture-rules/{ruleName}`
- **描述**: 更新指定的抓取规则

#### 8.5 删除抓取规则
- **接口**: `DELETE /api/v1/system/capture-rules/{ruleName}`
- **描述**: 删除指定的抓取规则

## 错误处理

### 常见HTTP状态码
- `200`: 请求成功
- `201`: 创建成功
- `400`: 请求参数错误
- `401`: 未授权，需要登录
- `403`: 禁止访问，权限不足
- `404`: 资源不存在
- `500`: 服务器内部错误

### 错误响应格式
```json
{
  "detail": "错误描述信息",
  "status_code": 400
}
```

## 认证机制

### Token获取
通过登录接口获取`access_token`和`refresh_token`

### Token使用
在请求头中添加：
```
Authorization: Bearer <access_token>
```

### Token刷新
当`access_token`过期(401错误)时，前端会自动使用`refresh_token`刷新令牌

## 分页参数

大部分列表接口支持以下分页参数：
- `page`: 页码，从1开始
- `page_size`: 每页数量，默认20，最大100

## 搜索参数

支持搜索的接口通常接受以下参数：
- `keyword`: 关键词搜索
- `startDate`: 开始日期 (YYYY-MM-DD)
- `endDate`: 结束日期 (YYYY-MM-DD)

## 使用示例

### JavaScript调用示例
```javascript
import { commentApi } from './services/api'

// 获取评论列表
const comments = await commentApi.getCommentList({
  page: 1,
  page_size: 20,
  keyword: '搜索关键词'
})

// 获取统计数据
const stats = await commentApi.getCommentsStats()
```

## 更新日志

- **v2.1.0**: 采用领域驱动设计(DDD)架构，重构API路径
- **v2.0.0**: 添加SSO支持，增强安全性
- **v1.0.0**: 基础功能实现 