## 用户使用指南

以下是快速启动和使用本系统的步骤：

1. **安装浏览器插件**:

   - 前往 `xhs_chrome_plugin` 目录。
   - 打开你的 Chromium 内核浏览器（如 Chrome, Edge）的扩展管理页面。
   - 启用"开发者模式"。
   - 点击"加载已解压的扩展程序"，选择 `xhs_chrome_plugin` 文件夹。
   - 安装成功后，插件图标会出现在浏览器工具栏。
2. **安装 Docker**:

   - 如果你还没有安装 Docker，请前往 [Docker 官方网站](https://www.docker.com/products/docker-desktop/) 下载并安装 Docker Desktop。它包含了 Docker Engine 和 Docker Compose。
3. **设置后端环境变量**:

   - 进入 `xhs_backend` 目录。
   - 创建一个名为 `.env` 的文件。
   - **最少需要设置 JWT 密钥和API密钥**。复制以下内容到 `.env` 文件中，并将安全令牌值替换为你自己生成的安全令牌（例如，一个长随机字符串）：
     ```dotenv
     # .env 文件 (位于 xhs_backend 目录下)
     JWT_SECRET_KEY="your_secure_jwt_secret_here"
     API_SECRET_TOKEN="your_secure_api_token_here"
     ALLOW_REGISTER="true"

     # 其他配置项（如数据库地址、名称等）对于 Docker Compose 运行有默认值，
     # 如果需要自定义，可以参考 xhs_backend/README.md 中的完整示例。
     ```
   - **重要**: 这个 `API_SECRET_TOKEN` 需要与之后在插件设置中填写的令牌保持一致。
4. **启动服务 (使用 Docker Compose)**:
     ```bash
     docker network create app-network
     ```
   - 回到项目的**xhs_backend 目录**（即包含 `docker-compose.yml` 文件的目录）。
   - 打开终端或命令提示符。
   - 运行以下命令来构建并以后台模式启动所有服务（后端、数据库、前端）:
     ```bash
     docker-compose up -d --build
     ```
   - `--build` 参数会确保在首次启动或代码有更新时构建最新的镜像。
   - `-d` 参数表示在后台运行。
5. **配置插件**:

   - 服务启动后（可能需要几十秒时间），右键点击浏览器工具栏中的插件图标，选择"选项"或"设置数据同步"。
   - **API 接口地址**: 由于系统重构，现在需要根据数据类型使用不同的API端点：
     - 评论数据：`http://localhost:8000/api/comments/data`
     - 通知数据：`http://localhost:8000/api/notifications/data`
     - 笔记数据：`http://localhost:8000/api/notes/data`
   - **认证令牌 (Token)**: 填入你在第 3 步 `.env` 文件中设置的 `API_SECRET_TOKEN`。
   - 点击"保存设置"。
   
   > 注意：如果插件代码不支持多个API端点配置，请参考`xhs_backend/README.md`中的"浏览器插件API调用更新指南"部分进行插件代码的更新。

6. **注册与登录**:

   - 首次使用时，需要注册账号。访问 `http://localhost:3000` 进入管理后台。
   - 点击"注册"填写用户名和密码，系统会生成OTP (一次性密码) 二维码。
   - 使用Google Authenticator等OTP应用扫描二维码，获取动态验证码。
   - 注册完成后，使用用户名、密码和OTP动态验证码登录系统。

7. **开始使用**:

   - 在小红书网页版浏览评论或通知时，点击插件上的功能按钮，会把数据发送给后端服务
   - 你也可以通过 `docker-compose logs -f xhs_backend` 查看后端服务的日志，确认数据接收情况。
   - 登录管理后台可以查看和管理所有收集的数据。



## 功能截图

![1745905553906](image/README/1745905553906.png)

## 系统架构

系统由以下三个主要组件组成：

1. **Chrome浏览器插件** (`xhs_chrome_plugin`): 
   - 负责从小红书网页中抓取评论、通知和笔记数据
   - 将数据发送到后端API进行存储和处理

2. **后端服务** (`xhs_backend`): 
   - 基于FastAPI框架构建的RESTful API服务
   - 处理并存储来自插件的数据
   - 提供数据查询、筛选和管理功能的API
   - 支持用户认证和鉴权

3. **前端管理界面** (`xhs_admin_ui`): 
   - 基于React构建的Web管理界面
   - 提供直观的数据可视化和管理功能
   - 支持数据筛选、搜索和批量操作
