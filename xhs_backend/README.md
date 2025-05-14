# 小红书评论维护系统后端

## 项目概述

小红书评论维护系统后端采用FastAPI框架开发，提供RESTful API接口，用于管理和维护小红书的评论、通知和笔记数据。系统支持用户认证、数据接收和查询、系统状态监控等功能。

## 系统架构

系统采用模块化的API架构，主要包括以下部分：

1. 主应用入口 (`main.py`) - 配置FastAPI应用、中间件和路由
2. 模型定义 (`models.py`) - 定义Pydantic模型用于验证请求和响应
3. 数据库操作 (`database.py`) - 封装MongoDB数据库操作
4. 数据处理 (`processing.py`) - 处理和转换数据
5. API模块 (`api/`) - 包含API路由和依赖项

### API目录结构

```
api/
├── __init__.py       # 主路由器和模块注册
├── deps.py           # API依赖项（认证、分页等）
└── endpoints/        # API端点实现
    ├── __init__.py
    ├── comments.py   # 评论相关端点
    ├── notes.py      # 笔记相关端点
    ├── notifications.py # 通知相关端点
    ├── system.py     # 系统管理端点
    └── users.py      # 用户认证和管理端点
```
## 文档更新
```bash
python3 export_openapi.py --format both --html both --output-dir api_docs --standalone
```

## API端点

系统提供以下主要API端点：

### 用户认证

- `POST /api/login` - 用户登录（用户名、密码和OTP）
- `POST /api/register` - 用户注册
- `GET /api/otp-qrcode` - 获取OTP二维码
- `GET /api/users/me` - 获取当前用户信息

### 评论管理

- `GET /api/comments` - 获取评论列表（支持过滤和分页）
- `GET /api/comments/{comment_id}` - 获取评论详情
- `PUT /api/comments/{comment_id}/status` - 更新评论状态
- `DELETE /api/comments/{comment_id}` - 删除评论
- `PUT /api/comments/batch/status` - 批量更新评论状态
- `POST /api/comments/batch/delete` - 批量删除评论
- `GET /api/comments/user/{user_id}` - 获取用户历史评论
- `POST /api/comments/data` - 接收评论数据

### 笔记管理

- `GET /api/notes` - 获取笔记列表（支持过滤和分页）
- `GET /api/notes/{note_id}` - 获取笔记详情
- `POST /api/notes/data` - 接收笔记数据

### 通知管理

- `GET /api/notifications` - 获取通知列表（支持过滤和分页）
- `GET /api/notifications/{notification_id}` - 获取通知详情
- `POST /api/notifications/data` - 接收通知数据

### 系统管理

- `GET /api/system/status` - 获取系统状态信息
- `GET /api/system/database-stats` - 获取数据库统计信息
- `GET /api/system/version` - 获取系统版本信息

## 认证与安全

系统使用JWT (JSON Web Token) 进行用户认证，并支持OTP (One-Time Password) 二因素认证增强安全性。所有API请求（除了登录、注册和版本信息外）都需要在请求头中包含有效的JWT令牌。

## 数据库

系统使用MongoDB存储数据，主要包括以下集合：

- `comments` - 存储原始评论数据
- `structured_comments` - 存储结构化评论数据
- `notes` - 存储笔记数据
- `notifications` - 存储通知数据
- `users` - 存储用户信息

## 浏览器插件API调用更新指南

由于后端API结构调整，浏览器插件需要更新API调用方式。原有的通用数据接收端点 `/api/data` 已被以下特定端点替代：

1. 评论数据：`POST /api/comments/data`
2. 通知数据：`POST /api/notifications/data`
3. 笔记数据：`POST /api/notes/data`

### 插件修改步骤

1. 访问浏览器插件设置页面（通常是 `options.html`）
2. 根据数据类型修改API接口地址：
   - 评论数据：`http://<服务器地址>/api/comments/data`
   - 通知数据：`http://<服务器地址>/api/notifications/data`
   - 笔记数据：`http://<服务器地址>/api/notes/data`

或者，更新插件代码中的数据发送逻辑，例如：

```javascript
// 原代码
async function sendData(type, data) {
  const apiUrl = localStorage.getItem('apiUrl') || DEFAULT_API_URL;
  const token = localStorage.getItem('apiToken') || '';
  
  const payload = {
    type: type,
    data: data
  };
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  
  return response.json();
}

// 修改后的代码
async function sendData(type, data) {
  let baseApiUrl = localStorage.getItem('apiUrl') || DEFAULT_API_URL;
  // 移除末尾可能存在的 /data
  baseApiUrl = baseApiUrl.replace(/\/data$/, '');
  
  // 根据数据类型选择不同的API端点
  let apiUrl;
  if (type === "评论") {
    apiUrl = `${baseApiUrl}/comments/data`;
  } else if (type === "通知") {
    apiUrl = `${baseApiUrl}/notifications/data`;
  } else if (type === "笔记") {
    apiUrl = `${baseApiUrl}/notes/data`;
  } else {
    throw new Error(`不支持的数据类型: ${type}`);
  }
  
  const token = localStorage.getItem('apiToken') || '';
  
  const payload = {
    type: type,
    data: data
  };
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  
  return response.json();
}
```

注意：请确保更新浏览器插件后重新测试数据发送功能，以确保API调用正常工作。

## 开发环境配置

1. 安装依赖项：

    ```bash
    pip install -r requirements.txt
    ```

2. 创建`.env`文件，配置环境变量：

```
MONGO_URI=mongodb://localhost:27017
MONGO_DB=xhs_data
JWT_SECRET_KEY=your_secret_key_here
ALLOW_REGISTER=true
```

3. 运行开发服务器：

```bash
python main.py
```

或者使用uvicorn直接运行：

    ```bash
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
    ```

## 生产环境部署

推荐使用Docker和Docker Compose进行部署，配置文件已包含在项目中：

- `Dockerfile` - 生产环境镜像构建
- `Dockerfile.dev` - 开发环境镜像构建
- `docker-compose.yml` - 服务编排配置

使用以下命令启动服务：

    ```bash
docker-compose up -d
    ```

## 如何扩展

### 添加新的API端点

1. 在`api/endpoints/`目录下创建新的模块文件
2. 定义路由器和端点函数
3. 在`api/__init__.py`中注册新的路由器

示例：

```python
# api/endpoints/new_module.py
from fastapi import APIRouter, Depends
from api.deps import get_current_user

router = APIRouter()

@router.get("/example")
async def example_endpoint(current_user: str = Depends(get_current_user)):
    return {"message": "这是一个示例端点"}

# api/__init__.py
from .endpoints import new_module
api_router.include_router(new_module.router, prefix="/new-module", tags=["新模块"])
```

### 添加新的数据库模型

1. 在`models.py`中定义新的Pydantic模型
2. 在`database.py`中添加相关的数据库操作函数

### 添加新的依赖项

在`api/deps.py`中定义新的依赖项函数，可以用于验证、过滤或其他共享功能。

## API文档

启动服务后，可以通过以下URL访问自动生成的API文档：

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc` 