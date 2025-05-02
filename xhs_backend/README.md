# 小红书数据接收后端服务

这是一个使用 FastAPI 和 MongoDB 搭建的简单后端服务，用于接收和存储来自小红书数据获取浏览器插件的数据。

## 功能

- 接收通过 POST 请求发送的 JSON 数据（包含类型和数据列表）。
- 通过“账号+密码+动态验证码（OTP）”登录，获取 JWT 令牌，后续接口需携带 JWT。
- 支持注册新账号（可通过 .env 配置 ALLOW_REGISTER=true/false 控制是否允许注册）。
- 根据数据类型存储到 MongoDB 中不同的集合：
    - **通知数据**: 直接插入到 `notifications` 集合。
    - **评论数据**:
        1.  执行 **Upsert** 操作将原始评论数据保存到 `raw_comments` 集合。如果评论（根据 `id` 判断，通常需要配合 `noteId`，具体逻辑见 `database.py`）已存在，则递归合并新的回复数据到现有回复列表中并更新其他字段；如果不存在，则插入新评论。
        2.  将接收到的原始评论数据转换为扁平化的**结构化格式**。
        3.  执行 **Upsert** 操作将结构化评论数据保存到 `structured_comments` 集合。如果结构化评论（根据 `commentId` 判断）已存在，则更新除 `timestamp` 外的字段；如果不存在，则插入新的结构化评论（包括 `timestamp`）。
- 提供基本的日志记录。
- 通过 Docker 和 Docker Compose 简化部署。

## 技术栈

- Python 3.9+ (FastAPI 对类型提示支持更好)
- FastAPI
- Uvicorn (ASGI Server)
- Motor (Async MongoDB Driver for asynchronous operations)
- Pydantic (Data Validation & Models)
- MongoDB
- python-dotenv (Environment Variables)

## 环境准备

1.  **Python**: 确保已安装 Python 3.9 或更高版本。
2.  **MongoDB**: 确保本地或远程 MongoDB 服务正在运行。

## 安装与运行

1.  **克隆或下载代码**: 将此 `xhs_backend` 目录放置到你的工作区。

2.  **进入目录**: 在终端中进入 `xhs_backend` 目录。
    ```bash
    cd xhs_backend
    ```

3.  **创建虚拟环境 (推荐)**:
    ```bash
    python -m venv venv
    ```
    激活虚拟环境:
    - Windows: `venv\Scripts\activate`
    - macOS/Linux: `source venv/bin/activate`

4.  **安装依赖**: 
    ```bash
    pip install -r requirements.txt
    ```
    *注意: 如果 `requirements.txt` 不存在或过时，你可能需要根据导入语句手动安装: `pip install fastapi uvicorn motor pydantic python-dotenv pymongo`*

5.  **创建 `.env` 文件**: 在 `xhs_backend` 目录下创建一个名为 `.env` 的文件，并填入以下内容，**请务必修改为你的实际配置**: 
    ```dotenv
    # .env 文件内容示例
    
    # MongoDB 连接字符串
    MONGODB_URL="mongodb://mongodb:27017/" # Docker Compose 内部地址 (如果使用 Docker)
    # MONGODB_URL="mongodb://localhost:27017/" # 非 Docker 运行时地址
    
    # MongoDB 数据库名称
    DATABASE_NAME="xiaohongshu_data"
    
    # MongoDB 集合名称 (注意: raw_comments 和 structured_comments 目前在代码中硬编码)
    NOTIFICATIONS_COLLECTION="notifications"
    # COMMENTS_COLLECTION="comments" # 旧的集合名，已被 raw_comments 替代
    
    # 用于API认证的密钥 (请生成一个安全的随机字符串)
    API_SECRET_TOKEN="替换为你的安全令牌"
    ```
    **重要**: `API_SECRET_TOKEN` 应该是一个复杂且随机的字符串，用于验证插件发送请求的合法性。请妥善保管。

6.  **运行服务 (非 Docker)**:
    ```bash
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
    ```
    - `--reload`: 开发模式下，代码更改时自动重启服务。
    - `--host 0.0.0.0`: 使服务可以从本地网络访问（如果需要）。
    - `--port 8000`: 指定服务监听的端口。

7.  **访问服务**: 服务启动后，可以在浏览器中访问 `http://localhost:8000` 查看根路径信息，或访问 `http://localhost:8000/docs` 查看自动生成的 API 文档。

## 使用 Docker 和 Docker Compose 运行 (推荐)

1.  **确保已安装 Docker 和 Docker Compose**.

2.  **创建或确认 `.env` 文件**: 确保 `xhs_backend` 目录下存在 `.env` 文件，并且至少包含 `API_SECRET_TOKEN`，例如：
    ```dotenv
    API_SECRET_TOKEN="你的安全令牌"
    # Docker Compose 会覆盖 MONGODB_URL 指向内部服务
    MONGODB_URL="mongodb://localhost:27017" 
    DATABASE_NAME="xiaohongshu_data"
    NOTIFICATIONS_COLLECTION="notifications"
    # COMMENTS_COLLECTION="comments" # 已不再直接使用
    ```

3.  **构建并启动服务**: 在包含 `docker-compose.yml` 的目录下 (通常是项目根目录，假设 `xhs_backend` 在其下) 运行：
    ```bash
    docker-compose up --build -d
    ```
    - `--build`: 强制重新构建镜像（首次运行时或 Dockerfile/依赖更改后需要）。
    - `-d`: 在后台运行容器。

4. **查看日志**:
    ```bash
    docker-compose logs -f xhs_backend # 查看后端服务的日志
    docker-compose logs -f mongodb   # 查看 MongoDB 服务的日志
    ```

5.  **访问服务**: 服务启动后，接口仍在 `http://localhost:8000` 可用。

6.  **停止服务**: 
    ```bash
    docker-compose down
    ```
    - `docker-compose down -v`: 如果想同时删除 MongoDB 数据卷。

## API 端点

- **`POST /api/data`**: 接收数据的核心端点。
    - **请求体 (Body)**: 需要符合 `models.IncomingPayload` 结构，包含 `type` ("通知" 或 "评论") 和 `data` (通知或评论对象的列表)。
    - **认证 (Authentication)**: 需要在请求头中包含 `Authorization: Bearer <JWT令牌>`，JWT 通过登录接口获取。
    - **响应 (Response)**:
        - **通知**: 返回 `{ "message": "...", "inserted": <count> }`
        - **评论**: 返回一个更详细的字典，包含原始数据和结构化数据的处理结果，例如：
          ```json
          {
              "message": "处理完成。原始评论: 插入=X, 更新=Y. 结构化评论: 新增/更新=A, 匹配=B, 失败=C.",
              "raw_inserted": X,
              "raw_updated": Y,
              "structured_upserted": A, 
              "structured_matched": B, // 注意：matched 包含未修改的文档
              "structured_modified": Z, // 新增：实际被修改的匹配文档数
              "structured_failed": C
          }
          ```
        - **错误**: 返回标准的 FastAPI HTTP 错误响应 (如 400, 401, 500)。

## 配置浏览器插件

1.  打开浏览器插件的"设置数据同步"页面 (`options.html`)。
2.  **API 接口地址**: 填入你的后端服务地址，例如 `http://localhost:8000/api/data` 或部署后的公网地址。
3.  **认证令牌 (Token)**: 填入你在 `.env` 文件中设置的 `API_SECRET_TOKEN`。
4.  点击"保存设置"。

之后，插件获取数据时将尝试发送到此后端服务。

## 数据格式

### 结构化评论数据 (在 `structured_comments` 集合中)

这是一个扁平化的评论列表，每个文档代表一个评论或回复，包含以下字段：
- `commentId`: (String) 评论自身的ID (主键)
- `noteId`: (String, Optional) 所属笔记ID
- `content`: (String, Optional) 评论内容
- `authorId`: (String, Optional) 评论作者的用户ID (从URL解析)
- `authorName`: (String, Optional) 评论作者昵称
- `authorAvatar`: (String, Optional) 评论作者头像URL
- `timestamp`: (Datetime, Optional) 解析后的评论发布时间 (只有在首次插入时设置)
- `repliedId`: (String, Optional) 回复的目标评论ID。如果是对父评论的回复，则为父评论ID；如果是对子评论的回复，则为被回复的那个子评论的ID。顶级评论此字段为 `None`。
- `repliedOrder`: (Int, Optional) 如果是子评论，表示它在父评论的直接回复列表中的顺序 (从0开始)。顶级评论此字段为 `None`。
- `fetchTimestamp`: (Datetime) 后端处理这条数据的时间 (每次更新时都会刷新)
- *可能还包含原始数据中的 `likeCount`, `ipLocation` 等字段，取决于 `processing.py` 中的实现*

### 发送到API的数据格式

发送到 `/api/data` 的 JSON 结构:
```json
{
  "type": "评论", // 或 "通知"
  "data": [ 
    // 对于 "评论", 这里是原始评论对象的列表
    {
      "id": "comment1_id",
      "noteId": "note_id",
      "authorName": "UserA",
      "content": "这是顶级评论",
      "timestamp": "1小时前", 
      // ...其他原始字段...
      "replies": [
        {
          "id": "reply1_id",
          "noteId": "note_id", // 注意: 嵌套数据也应包含 noteId
          "authorName": "UserB",
          "content": "回复UserA",
          "repliedToUser": "UserA",
          "timestamp": "30分钟前",
          // ...
          "replies": [] 
        },
        {
          "id": "reply2_id",
          "noteId": "note_id",
          "authorName": "UserA",
          "content": "自己回复自己",
          "repliedToUser": null, // 或 "UserA"，取决于前端插件逻辑
          "timestamp": "20分钟前",
          // ...
          "replies": []
        }
      ]
    },
    // ...更多顶级评论...
  ]
}
``` 

## 用户认证与注册

- 通过 `/api/register` 注册新账号（如允许注册），注册后自动登录，返回 JWT。
- 通过 `/api/login` 使用账号、密码和 OTP 动态码登录，返回 JWT。
- 通过 `/api/otp-qrcode?username=xxx` 获取 OTP 二维码（用于 Google Authenticator 等扫码绑定）。
- 登录后，所有受保护接口需在请求头携带：
  ```
  Authorization: Bearer <JWT令牌>
  ```
- `.env` 文件中可配置 `ALLOW_REGISTER=false` 禁用注册功能。 