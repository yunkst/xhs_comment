# API迁移文档

## 概述

本文档记录了小红书插件 `xhs_plugin_v2` 的API接口迁移。所有API接口已从原路径迁移到新的域名空间结构下，遵循 RESTful API 最佳实践。

## 迁移路径映射表

| 原API路径 | 新API路径 | 功能描述 |
|---------|----------|---------|
| `/api/health` | `/api/v1/system/health` | 健康检查接口 |
| `/api/auth/sso-session` | `/api/v1/user/auth/sso-session` | 创建SSO会话 |
| `/api/auth/sso-session/{id}` | `/api/v1/user/auth/sso-session/{id}` | 获取SSO会话状态 |
| `/api/auth/sso-refresh` | `/api/v1/user/auth/sso-refresh` | 刷新SSO令牌 |
| `/api/system/capture-rules` | `/api/v1/system/capture-rules` | 获取抓取规则 |
| `/api/system/network-data` | `/api/v1/system/network-data` | 上传网络数据 |

## 迁移说明

### 命名空间结构

新的API路径遵循以下命名空间结构：

```
/api/v1/{领域}/{资源}
```

其中：
- `v1` - API版本号
- `领域` - 功能领域，如 user、system、content 等
- `资源` - 具体资源，如 auth、capture-rules 等

### 域划分

1. **user域** - 用户相关功能
   - `auth` - 认证相关
   - `profile` - 用户资料

2. **system域** - 系统功能
   - `health` - 健康检查
   - `capture-rules` - 抓取规则
   - `network-data` - 网络数据

3. **content域** - 内容相关功能
   - `comments` - 评论数据
   - `notes` - 笔记数据

## 修改文件列表

以下文件已完成API迁移：

1. `background.js`
   - 更新抓取规则请求
   - 更新网络数据上传
   - 更新令牌刷新

2. `popup.js`
   - 更新SSO会话创建
   - 更新SSO会话状态查询

3. `options.js`
   - 更新健康检查接口

## 向后兼容性

为确保平滑过渡，建议后端同时支持新旧路径一段时间，实现方式可以是：

1. **URL重写**：将旧路径请求重定向到新路径
2. **双端点支持**：同时支持新旧两个端点
3. **版本降级**：检测到旧版本客户端时使用旧API逻辑

## 测试方法

1. 确保后端已实现新API路径
2. 测试所有插件功能，确保能正常工作：
   - API连接测试
   - SSO登录流程
   - 抓取规则获取
   - 网络数据上传

## 后续计划

1. 完全移除对旧API路径的支持
2. 将接口文档更新为新路径
3. 考虑将API调用逻辑集中到专门的服务模块中 