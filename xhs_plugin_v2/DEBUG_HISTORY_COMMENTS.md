# 历史评论功能调试指南

## 问题现象
点击【历史评论】按钮后，弹窗显示"正在加载历史评论..."，但后端没有收到请求。

## 调试步骤

### 1. 检查控制台日志

打开浏览器开发者工具（F12），查看Console标签页的日志输出。按照以下顺序检查：

**a) 点击按钮时的日志：**
```
[Notification Handler] 点击了通知按钮 X
[Dialog Manager] 开始显示第 X 个通知的弹出框
[Dialog Manager] 获取到用户ID: XXXXX
```

**b) API配置获取日志：**
```
[API Service] 请求获取API配置, requestId: XXXXX
[Content] 收到配置请求: {requestId: "XXXXX"}
[API Service] 收到配置响应: {success: true, config: {...}}
[API Service] API配置获取成功: http://localhost:8000, token: 已设置/未设置
```

**c) 代理请求日志：**
```
[API Service] 发送代理请求: {url: "...", options: {...}, requestId: "XXXXX"}
[Content] 收到代理请求: {url: "...", ...}
[Background] 处理代理请求: {url: "...", ...}
[Background] 发送fetch请求: ... {...}
[Background] 收到响应: 200 OK
[API Service] 收到代理响应: {success: true, ...}
```

### 2. 常见问题诊断

#### 问题1：API配置未获取到
**现象：** 看不到"API配置获取成功"的日志
**原因：** Content Script与Background Script通信失败
**解决：** 重新加载插件或刷新页面

#### 问题2：代理请求未发送
**现象：** 看不到"发送代理请求"的日志
**原因：** API配置获取失败或用户ID提取失败
**解决：** 检查API配置和用户链接格式

#### 问题3：代理请求发送但无响应
**现象：** 看到"发送代理请求"但没有"收到代理响应"
**原因：** Content Script未正确处理事件或Background Script处理失败
**解决：** 检查网络请求是否被阻止

#### 问题4：后端请求失败
**现象：** 看到"代理请求出错"或HTTP错误状态
**原因：** API地址错误、认证失败、或后端服务未运行
**解决：** 检查API配置和后端服务状态

### 3. 手动测试代理请求

在小红书通知页面的控制台中执行以下命令来测试代理请求功能：

```javascript
// 测试代理请求
window.xhsApiService.testProxyRequest()
  .then(data => console.log('测试成功:', data))
  .catch(error => console.error('测试失败:', error));
```

### 4. 检查网络请求

在开发者工具的Network标签页中查看是否有对后端API的请求：

1. 点击【历史评论】按钮
2. 查看Network标签页是否出现对 `/api/comments/user/XXXXX` 的请求
3. 检查请求状态码和响应内容

### 5. 检查插件配置

确保在插件选项页面正确配置了：

- **API地址**：如 `http://localhost:8000`
- **API令牌**：有效的认证令牌

### 6. 检查权限

确保插件的manifest.json包含必要权限：
```json
{
  "permissions": ["webRequest", "storage", "tabs", "activeTab"],
  "host_permissions": ["<all_urls>"]
}
```

## 问题排查流程图

```
用户点击按钮
    ↓
是否显示弹窗？ ──否──> 检查按钮事件绑定
    ↓是
是否获取到用户ID？ ──否──> 检查用户链接选择器
    ↓是
是否获取到API配置？ ──否──> 检查插件配置和通信
    ↓是
是否发送代理请求？ ──否──> 检查事件监听器
    ↓是
是否收到代理响应？ ──否──> 检查Content/Background通信
    ↓是
是否有网络请求？ ──否──> 检查fetch实现
    ↓是
后端是否响应？ ──否──> 检查后端服务和API配置
    ↓是
数据是否正确？ ──否──> 检查API端点和数据格式
    ↓是
成功！
```

## 常见错误及解决方案

### 错误1："获取API配置超时"
- **原因**：Background Script未响应配置请求
- **解决**：重新加载插件，检查Background Script是否正常运行

### 错误2："代理请求超时"
- **原因**：网络请求被阻止或后端响应慢
- **解决**：检查网络连接，增加超时时间，或检查后端服务

### 错误3："未配置API地址"
- **原因**：插件选项中未设置API地址
- **解决**：在插件选项页面设置正确的API地址

### 错误4："API请求失败 (401)"
- **原因**：API令牌无效或过期
- **解决**：重新获取有效的API令牌并在插件选项中更新

### 错误5："API请求失败 (404)"
- **原因**：API端点不存在或用户ID无效
- **解决**：检查API端点路径和用户ID格式

## 开发者工具使用技巧

1. **过滤日志**：在Console中输入 `[API Service]` 或 `[Dialog Manager]` 来过滤相关日志
2. **清除日志**：点击Console的清除按钮，然后重新触发操作
3. **网络监控**：在Network标签页中使用过滤器只显示XHR/Fetch请求
4. **断点调试**：在Sources标签页设置断点来详细调试代码执行

## 联系支持

如果以上步骤无法解决问题，请提供以下信息：

1. 完整的控制台日志输出
2. Network标签页的请求详情
3. 插件配置截图
4. 后端服务日志（如果可访问）
5. 浏览器版本和操作系统信息 