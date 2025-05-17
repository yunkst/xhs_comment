# 小红书评论维护系统 - 前端管理界面 (xhs_admin_ui)

本项目是 "小红书评论维护系统" 的前端管理界面，基于 Vue 3 和 Element Plus 构建。

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
├── .env.development  # (可选) 开发环境变量
├── .env.production   # (可选) 生产环境变量
├── vite.config.js    # Vite 配置文件
├── package.json      # 项目依赖和脚本
└── README.md         # 项目说明
```

## 注意事项

*   如果在 WSL 环境下开发，Vite 的文件监听可能需要配置 `server.watch.usePolling = true` (已在 `vite.config.js` 中配置)。
*   确保后端服务 (`xhs_backend`) 正在运行，以便前端可以正常请求 API 数据。

---

祝您开发愉快！
