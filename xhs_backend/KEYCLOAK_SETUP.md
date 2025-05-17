# Keycloak SSO 配置指南

本指南将帮助您设置 Keycloak SSO 与小红书评论系统的集成。

## 前提条件

- 已部署的 Keycloak 服务器（版本 >= 15.0.0）
- 小红书评论系统后端（xhs_backend）

## 1. 在 Keycloak 中创建域（Realm）

1. 登录 Keycloak 管理控制台（默认 URL: http://your-keycloak-host:8080/admin/）
2. 点击左上角的 "Add realm" 按钮
3. 输入域名称（推荐使用 `xhs-realm`）
4. 点击 "Create" 按钮

## 2. 创建客户端（Client）

1. 在左侧菜单中选择 "Clients"
2. 点击 "Create" 按钮
3. 填写以下信息：
   - Client ID: `xhs-backend`（必须与配置中的 KEYCLOAK_CLIENT_ID 匹配）
   - Client Protocol: `openid-connect`
   - Root URL: 留空或填写您的应用 URL（例如 `http://your-app-host:8000`）
4. 点击 "Save" 按钮
5. 在随后的客户端设置页面，配置以下字段：
   - Access Type: `confidential`（这将启用客户端密钥）
   - Valid Redirect URIs: 添加您的回调 URL 路径（例如 `http://your-app-host:8000/api/auth/sso-callback*`）
   - Web Origins: 添加允许的来源（例如 `+`或您的前端 URL）
6. 点击 "Save" 按钮

## 3. 获取客户端密钥

1. 切换到 "Credentials" 标签页
2. 复制显示的 "Secret" 值
3. 将此值添加到 `.env` 文件中的 `KEYCLOAK_CLIENT_SECRET` 变量中

## 4. 创建用户角色（可选）

1. 在左侧菜单中选择 "Roles"
2. 点击 "Add Role" 按钮
3. 创建所需的角色，如 `admin`、`user` 等
4. 点击 "Save" 按钮

## 5. 创建用户

1. 在左侧菜单中选择 "Users"
2. 点击 "Add user" 按钮
3. 填写用户信息（至少包括用户名）
4. 点击 "Save" 按钮
5. 切换到 "Credentials" 标签页
6. 设置用户密码并选择密码是否临时
7. 如果需要，在 "Role Mappings" 标签页中分配角色

## 6. 配置后端 .env 文件

将以下内容添加到 `xhs_backend/.env` 文件中：

```
# Keycloak SSO 配置
KEYCLOAK_ENABLED=true
KEYCLOAK_SERVER_URL=http://your-keycloak-host:8080
KEYCLOAK_REALM=xhs-realm
KEYCLOAK_CLIENT_ID=xhs-backend
KEYCLOAK_CLIENT_SECRET=your-client-secret-from-step-3
KEYCLOAK_SSL_VERIFY=false  # 如果使用自签名证书，设置为 false
FRONTEND_REDIRECT_URL=http://your-frontend-url
```

## 7. 重启应用程序

配置完成后，重启应用程序以应用更改：

```bash
cd xhs_backend
docker-compose down
docker-compose up -d
```

## 测试 SSO 集成

1. 访问 SSO 登录 URL 获取登录链接：`GET /api/auth/sso-login-url`
2. 使用返回的 URL 重定向到 Keycloak 登录页面
3. 登录后，您将被重定向回应用程序，并带有访问令牌
4. 使用此令牌访问受保护的 API 端点

## 故障排除

如果遇到问题，请检查：

1. Keycloak 服务器是否可访问
2. 域名和客户端 ID 是否正确
3. 客户端密钥是否正确
4. 重定向 URI 是否已在 Keycloak 中正确配置
5. 检查应用程序日志中的错误消息 