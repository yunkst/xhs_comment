# 小红书评论维护系统 - 前端管理界面 (xhs_admin_ui)

本项目是 "小红书评论维护系统" 的前端管理界面，基于 Vue 3 和 Element Plus 构建。

## 🆕 API架构更新 (v2.1.0)

本项目已更新为使用**领域驱动设计 (DDD)** 的新API架构，提供更清晰的接口组织和更好的功能支持。

### 新架构特点

- **🎯 按业务领域分组**：系统管理、内容管理、用户管理、通知管理
- **📈 增强的统计功能**：每个领域都提供专门的统计接口
- **🔄 完全向后兼容**：原有API路径自动重定向到新路径
- **📚 更好的文档**：统一的响应格式和错误处理

### 主要API模块

| 模块 | 路径前缀 | 功能 |
|------|----------|------|
| 系统管理 | `/api/v1/system` | 抓取规则、网络数据、系统监控 |
| 内容管理 | `/api/v1/content` | 评论、笔记管理和统计 |
| 用户管理 | `/api/v1/user` | 认证、用户资料管理 |
| 通知管理 | `/api/v1/notification` | 通知消息管理 |

### 迁移指南

查看详细的API迁移指南：**[API_MIGRATION_GUIDE.md](./API_MIGRATION_GUIDE.md)**

### 获取迁移信息

```bash
GET /api/migrate-info
```

## 环境准备

在开始之前，请确保您的开发环境中安装了以下软件：

*   **Node.js**: 版本建议 >= 18.x。您可以从 [Node.js 官网](https://nodejs.org/) 下载并安装。
*   **npm** 或 **yarn**: Node.js 自带 npm。如果您偏好 yarn，可以从 [Yarn 官网](https://classic.yarnpkg.com/en/docs/install) 安装。

## 项目设置与安装

1.  **克隆或下载项目**：
    如果项目是版本控制的一部分，请先克隆仓库。

2.  **进入项目目录**：
    ```bash
    cd xhs_admin_ui
    ```

3.  **安装依赖**：
    使用 npm:
    ```bash
    npm install
    ```
    或者使用 yarn:
    ```bash
    yarn install
    ```

## 开发运行

1.  **配置 API 地址 (可选)**：
    在开发过程中，前端应用需要知道后端 API 服务的地址。默认情况下，API 请求会尝试连接到与前端服务相同的主机和端口下的 `/api` 路径 (例如，如果前端运行在 `http://localhost:5173`，API会请求 `http://localhost:5173/api`)。

    如果您的后端服务运行在不同的地址（例如 `http://localhost:8000`），您可以在项目根目录下创建 `.env.development` 文件，并配置 `VITE_API_BASE_URL` 变量：
    ```env
    # xhs_admin_ui/.env.development
    VITE_API_BASE_URL=http://localhost:8000
    ```
    这样，在开发模式下，所有 API 请求都会以 `http://localhost:8000` 作为基地址。

2.  **启动开发服务器**：
    使用 npm:
    ```bash
    npm run dev
    ```
    或者使用 yarn:
    ```bash
    yarn dev
    ```
    该命令会启动 Vite 开发服务器，通常默认地址是 `http://localhost:5173`。您可以在浏览器中打开此地址查看应用。项目支持热模块替换 (HMR)，代码更改后浏览器会自动刷新。

## API使用示例

### 基础用法

```javascript
import { commentApi, systemApi, noteApi, notificationApi } from './src/services/api'

// 获取评论列表和统计
const comments = await commentApi.getCommentList({ page: 1, page_size: 20 })
const commentStats = await commentApi.getCommentsStats()

// 系统监控
const healthStatus = await systemApi.healthCheck()
const systemStatus = await systemApi.getSystemStatus()

// 笔记管理
const notes = await noteApi.getNoteList({ page: 1, page_size: 20 })
const noteStats = await noteApi.getNotesStats()

// 通知管理
const notifications = await notificationApi.getNotificationList({ page: 1, page_size: 20 })
```

### Dashboard统计数据

```javascript
// 获取全面的统计数据
const fetchStatistics = async () => {
  const [commentsStats, usersStats, networkStats] = await Promise.all([
    commentApi.getCommentsStats(),
    systemApi.getDatabaseStats(),
    networkDataApi.getNetworkDataStats()
  ])
  
  // 处理统计数据...
}
```

## 构建打包 (生产环境)

1.  **配置生产环境 API 地址 (如果需要)**：
    生产构建时，API 基地址的行为由 `src/services/api.js` 中的 `baseURL: import.meta.env.VITE_API_BASE_URL || '',` 决定。
    *   如果 `VITE_API_BASE_URL` 在构建环境 (例如，通过 `.env.production` 文件) 中未定义或为空，则 API 请求将使用相对路径 (例如，请求 `/api/...`)。这是推荐的生产环境部署方式，假设前端和后端服务于同一个域名下。
    *   如果您需要在生产构建时指定一个固定的 API 地址，可以在 `xhs_admin_ui` 目录下创建 `.env.production` 文件并设置 `VITE_API_BASE_URL`。

2.  **执行构建命令**：
    使用 npm:
    ```bash
    npm run build
    ```
    或者使用 yarn:
    ```bash
    yarn build
    ```
    构建产物默认会输出到 `../xhs_backend/static_frontend` 目录（根据 `vite.config.js` 中的 `build.outDir` 配置）。此目录已配置为后端 FastAPI 服务静态文件的位置。

## 主要技术栈

*   Vue 3
*   Vite
*   Vue Router
*   Pinia (如果使用)
*   Element Plus
*   Axios

## 目录结构 (简要)

```
xhs_admin_ui/
├── public/             # 静态公共资源
├── src/
│   ├── assets/         # 静态资源 (会被 Vite 处理)
│   ├── components/     # Vue 组件
│   ├── router/         # Vue Router 配置
│   ├── services/       # API 服务调用 (api.js)
│   ├── stores/         # Pinia 状态管理 (如果使用)
│   ├── views/          # 页面级组件
│   ├── App.vue         # 应用根组件
│   └── main.js         # 应用入口文件
├── .env.development    # (可选) 开发环境变量
├── .env.production     # (可选) 生产环境变量
├── vite.config.js      # Vite 配置文件
├── package.json        # 项目依赖和脚本
├── README.md           # 项目说明
└── API_MIGRATION_GUIDE.md  # API迁移指南
```

## 特性说明

### 🔐 SSO认证
支持 Keycloak 单点登录，自动token刷新和错误处理。

### 📊 实时监控
- 系统健康状态监控
- 数据库统计信息
- 网络数据处理状态
- 性能度量指标

### 🎯 内容管理
- 评论审核和管理
- 笔记内容分析
- 通知消息处理
- 批量操作支持

### ⚙️ 系统配置
- 抓取规则配置
- 网络数据监控
- 系统设置管理
- 备份恢复功能

## 注意事项

*   如果在 WSL 环境下开发，Vite 的文件监听可能需要配置 `server.watch.usePolling = true` (已在 `vite.config.js` 中配置)。
*   确保后端服务 (`xhs_backend`) 正在运行，以便前端可以正常请求 API 数据。
*   新的API架构提供了更好的错误处理和响应格式，建议查看 [API_MIGRATION_GUIDE.md](./API_MIGRATION_GUIDE.md) 了解详细用法。

## 版本历史

### v2.1.0 (2024-12-01)
- ✨ 重构为领域驱动API架构
- 🚀 新增笔记和通知管理功能
- 📈 增强的统计和监控功能
- 🔄 完全向后兼容

---

祝您开发愉快！

如有问题，请查看 [API迁移指南](./API_MIGRATION_GUIDE.md) 或检查后端 [架构文档](../xhs_backend/DOMAIN_ARCHITECTURE.md)。
