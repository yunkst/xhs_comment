# 小红书数据接收后端服务

这是一个使用 FastAPI 和 MongoDB 搭建的简单后端服务，用于接收和存储来自小红书数据获取浏览器插件的数据。

## 功能

- 接收通过 POST 请求发送的 JSON 数据（包含类型和数据列表）。
- 通过 Bearer Token 进行简单的认证。
- 根据数据类型（"通知" 或 "评论"）将数据存储到 MongoDB 中不同的集合。
- 提供基本的日志记录。

## 技术栈

- Python 3.7+
- FastAPI
- Uvicorn (ASGI Server)
- Motor (Async MongoDB Driver)
- Pydantic (Data Validation)
- MongoDB
- python-dotenv (Environment Variables)

## 环境准备

1.  **Python**: 确保已安装 Python 3.7 或更高版本。
2.  **MongoDB**: 确保本地或远程 MongoDB 服务正在运行。

## 安装与运行

1.  **克隆或下载代码**: 将此 `后端服务` 目录放置到你的工作区。

2.  **进入目录**: 在终端中进入 `后端服务` 目录。
    ```bash
    cd 后端服务
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

5.  **创建 `.env` 文件**: 在 `后端服务` 目录下创建一个名为 `.env` 的文件，并填入以下内容，**请务必修改为你的实际配置**: 
    ```dotenv
    # .env 文件内容示例
    
    # MongoDB 连接字符串
    MONGODB_URL="mongodb://localhost:27017" 
    
    # MongoDB 数据库名称
    DATABASE_NAME="xiaohongshu_data"
    
    # MongoDB 集合名称
    NOTIFICATIONS_COLLECTION="notifications"
    COMMENTS_COLLECTION="comments"
    
    # 用于API认证的密钥 (请生成一个安全的随机字符串)
    API_SECRET_TOKEN="替换为你的安全令牌"
    ```
    **重要**: `API_SECRET_TOKEN` 应该是一个复杂且随机的字符串，用于验证插件发送请求的合法性。请妥善保管。

6.  **运行服务**:
    ```bash
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
    ```
    - `--reload`: 开发模式下，代码更改时自动重启服务。
    - `--host 0.0.0.0`: 使服务可以从本地网络访问（如果需要）。
    - `--port 8000`: 指定服务监听的端口。

7.  **访问服务**: 服务启动后，可以在浏览器中访问 `http://localhost:8000` 查看根路径信息，或访问 `http://localhost:8000/docs` 查看自动生成的 API 文档。

## 使用 Docker 和 Docker Compose 运行 (推荐)

1.  **确保已安装 Docker 和 Docker Compose**.

2.  **创建或确认 `.env` 文件**: 确保 `后端服务` 目录下存在 `.env` 文件，并且至少包含 `API_SECRET_TOKEN`，例如：
    ```dotenv
    API_SECRET_TOKEN="你的安全令牌"
    # MONGODB_URL 在 docker-compose.yml 中配置为指向内部服务，此处的 MONGODB_URL 主要用于非 Docker 运行
    MONGODB_URL="mongodb://localhost:27017"
    DATABASE_NAME="xiaohongshu_data"
    NOTIFICATIONS_COLLECTION="notifications"
    COMMENTS_COLLECTION="comments"
    ```

3.  **构建并启动服务**: 在 `后端服务` 目录下运行：
    ```bash
    docker-compose up --build
    ```
    - `--build`: 强制重新构建镜像（首次运行时或 Dockerfile/依赖更改后需要）。
    - `-d` (可选): 在后台运行容器。

4.  **访问服务**: 服务启动后，接口仍在 `http://localhost:8000` 可用。

5.  **停止服务**: 按 `Ctrl+C`，或者如果使用了 `-d`，则运行：
    ```bash
    docker-compose down
    ```
    - `docker-compose down -v`: 如果想同时删除 MongoDB 数据卷。

## API 端点

- **`POST /api/data`**: 接收数据的端点。
    - **请求体 (Body)**: 需要符合 `models.IncomingPayload` 结构，包含 `type` ("通知" 或 "评论") 和 `data` (通知或评论对象的列表)。
    - **认证 (Authentication)**: 需要在请求头中包含 `Authorization: Bearer <你的API_SECRET_TOKEN>`。

## 配置浏览器插件

1.  打开浏览器插件的"设置数据同步"页面 (`options.html`)。
2.  **API 接口地址**: 填入你的后端服务地址，例如 `http://localhost:8000/api/data` 或部署后的公网地址。
3.  **认证令牌 (Token)**: 填入你在 `.env` 文件中设置的 `API_SECRET_TOKEN`。
4.  点击"保存设置"。

之后，插件获取数据时将尝试发送到此后端服务。 