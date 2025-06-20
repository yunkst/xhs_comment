# 小红书插件 Token 过期处理修复

## 修复概述

本次修复解决了小红书插件 `xhs_plugin_v2` 中对API返回401错误没有正确处理的问题。现在插件能够：

1. **自动检测401错误**：当API返回401 Unauthorized时，插件会自动检测并处理
2. **自动刷新Token**：尝试使用refresh_token自动刷新访问令牌
3. **自动重试请求**：Token刷新成功后自动重试原始请求
4. **用户友好提示**：为不同错误场景提供清晰的用户指导
5. **状态可视化**：在插件界面中显示登录状态和过期警告

## 修复的文件

### 1. Background脚本修复 (`background/index.js`)

**修复内容：**
- `handleProxyRequest`函数增加401错误检测
- 收到401时自动调用`refreshApiToken()`
- 更新Authorization头并重试请求
- 返回重试状态信息

**关键改进：**
```javascript
// 检查401错误并尝试刷新token
if (response.status === 401) {
    console.log('[Background] 代理请求收到401，尝试刷新token...');
    
    try {
        await refreshApiToken();
        
        // 更新请求头中的Authorization
        if (globalState.apiConfig?.token && fetchOptions.headers) {
            fetchOptions.headers['Authorization'] = `Bearer ${globalState.apiConfig.token}`;
            
            // 重新发送请求
            const retryResponse = await fetch(requestData.url, fetchOptions);
            // ... 处理重试响应
        }
    } catch (refreshError) {
        console.error('[Background] Token刷新失败:', refreshError);
    }
}
```

### 2. API服务层修复 (`injected/api-service.js`)

**修复内容：**
- `proxyFetch`函数增加401错误特殊处理
- 为所有API调用函数添加401错误检测
- 提供用户友好的错误消息
- 支持重试状态提示

**关键改进：**
```javascript
// 特殊处理401错误
if (response.status === 401) {
    reject(new Error('登录已过期，请重新登录或刷新token'));
} else {
    reject(new Error(response.error || '代理请求失败'));
}
```

### 3. 对话框管理器优化 (`injected/dialog-manager.js`)

**修复内容：**
- 为401错误提供专门的错误界面
- 包含具体的解决步骤指导
- 区分不同类型的错误（401、配置错误、其他错误）

**用户界面改进：**
- 🔒 登录已过期：显示重新登录步骤
- ⚙️ 配置未完成：显示配置指导
- ❌ 其他错误：显示通用故障排除

### 4. Popup界面增强 (`popup/ui.js`, `popup/state.js`)

**修复内容：**
- 添加`lastApiError`状态跟踪
- 在API状态显示中检测token过期
- 提供可视化的过期警告

**状态显示：**
- ✅ 正常连接：绿色指示器
- ⚠️ 登录过期：橙色警告指示器
- ❌ 未配置：默认指示器

## 工作流程

### Token过期处理流程

1. **检测阶段**
   - API请求返回401状态码
   - Background脚本捕获401响应

2. **自动刷新阶段**
   - 调用`refreshApiToken()`函数
   - 使用存储的refresh_token获取新的access_token
   - 更新globalState中的token

3. **重试阶段**
   - 使用新token更新请求头
   - 重新发送原始请求
   - 返回重试结果

4. **用户反馈阶段**
   - 成功：在控制台记录"Token已自动刷新"
   - 失败：显示"登录已过期，请重新登录"

### 错误处理优先级

1. **401错误**：优先处理，自动刷新token
2. **配置错误**：提示用户完成配置
3. **网络错误**：提示检查网络连接
4. **其他错误**：显示通用错误信息

## 测试方法

### 1. 模拟Token过期测试

**步骤：**
1. 正常登录插件，确保有有效token
2. 在开发者工具中手动清除token：
   ```javascript
   chrome.storage.local.set({
       'xhs_api_config': {
           host: 'http://localhost:8000',
           token: 'invalid_token',
           refreshToken: 'valid_refresh_token'
       }
   });
   ```
3. 触发需要API调用的操作（如查看用户历史评论）
4. 观察控制台日志和用户界面反应

**预期结果：**
- 控制台显示：`[Background] 代理请求收到401，尝试刷新token...`
- 如果refresh_token有效：自动刷新成功，请求继续
- 如果refresh_token无效：显示"登录已过期"提示

### 2. 用户界面状态测试

**步骤：**
1. 点击插件图标打开popup
2. 观察API状态显示
3. 模拟401错误后再次查看popup

**预期结果：**
- 正常状态：✅ API已连接 (绿色)
- 过期状态：⚠️ 登录可能已过期 (橙色)

### 3. 错误提示测试

**步骤：**
1. 在小红书页面点击用户头像查看历史评论
2. 确保触发401错误
3. 查看弹出的错误对话框

**预期结果：**
- 显示🔒登录已过期对话框
- 包含具体的解决步骤
- 提供重新登录的指导

### 4. 自动重试测试

**步骤：**
1. 设置有效的refresh_token但无效的access_token
2. 发起API请求
3. 观察网络请求和响应

**预期结果：**
- 第一次请求返回401
- 自动刷新token
- 第二次请求使用新token成功

## 调试日志

修复后的插件会在控制台输出详细的调试信息：

```
[Background] 代理请求收到401，尝试刷新token...
[Background] 已更新Authorization头，重试请求
[Background] 重试请求响应: 200 OK
[API Service] Token已自动刷新，成功获取用户 xxx 的历史评论
```

## 注意事项

1. **Refresh Token有效期**：如果refresh_token也过期，需要用户重新登录
2. **网络连接**：确保后端服务正常运行且可访问
3. **浏览器兼容性**：需要Chrome 88+支持Manifest V3
4. **存储权限**：插件需要storage权限来保存token

## 故障排除

### 问题1：Token刷新失败
**解决方案：**
1. 检查refresh_token是否有效
2. 确认后端刷新接口正常工作
3. 重新进行SSO登录

### 问题2：401错误未被捕获
**解决方案：**
1. 检查浏览器控制台错误
2. 确认API请求经过插件代理
3. 验证后端返回正确的401状态码

### 问题3：用户界面未更新
**解决方案：**
1. 刷新插件（在chrome://extensions/中）
2. 重新打开popup界面
3. 检查popup/state.js中的lastApiError状态

## 更新历史

- **v2.4.0** (2024-12-01): 新增401错误自动处理和token刷新机制
- **v2.3.0** (2024-12-01): 后端统一抓取规则管理
- **v2.2.0** (2024-11-30): SSO登录功能 