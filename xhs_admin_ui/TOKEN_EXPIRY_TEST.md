# JWT Token过期处理测试指南

## 修复内容

我们已经修复了JWT token过期后前端没有正确处理的问题。修复包括：

### 1. 主要修复点
- ✅ 修复了路由器实例未正确设置的问题
- ✅ 增强了API拦截器的错误处理和日志记录
- ✅ 添加了用户友好的过期提示消息
- ✅ 实现了自动token刷新机制
- ✅ 添加了定期token状态检查
- ✅ 改进了登录成功后的token设置流程

### 2. 新增功能
- 🔄 **自动token刷新**：当收到401响应时，自动尝试使用refresh_token刷新
- ⏰ **定期状态检查**：每5分钟检查一次token有效性
- 🔔 **用户通知**：token过期时显示友好提示
- 📝 **详细日志**：完整的认证状态日志记录

## 测试步骤

### 测试1：正常token过期处理

1. **登录系统**
   ```bash
   # 访问管理界面
   http://localhost:5173/web/
   ```

2. **等待token过期**
   - 后端JWT token默认7天过期
   - 可以手动修改后端token过期时间进行快速测试

3. **触发API请求**
   - 尝试访问任何需要认证的页面
   - 或手动刷新页面

4. **期望结果**
   - ✅ 显示"登录已过期，请重新登录"提示
   - ✅ 自动跳转到登录页面
   - ✅ 本地token被清除

### 测试2：自动token刷新

1. **确保有有效的refresh_token**
   ```javascript
   // 在浏览器控制台检查
   console.log('Token:', localStorage.getItem('token'))
   console.log('Refresh Token:', localStorage.getItem('refresh_token'))
   ```

2. **模拟token即将过期**
   - 可以通过修改后端token过期时间
   - 或直接删除access_token但保留refresh_token

3. **期望结果**
   - ✅ 自动使用refresh_token获取新的access_token
   - ✅ 请求继续正常执行
   - ✅ 用户无感知刷新

### 测试3：定期状态检查

1. **登录后观察控制台**
   ```javascript
   // 应该看到这些日志
   [Auth] 启动定期token检查（每5分钟一次）
   [Auth] 定期检查token状态...
   ```

2. **等待5分钟**
   - 系统会自动检查token状态

3. **期望结果**
   - ✅ 每5分钟自动检查一次
   - ✅ 如果token无效，自动清除并跳转登录

## 手动测试脚本

### 在浏览器控制台运行以下脚本：

```javascript
// 1. 检查当前认证状态
console.log('=== 当前认证状态 ===')
console.log('Token:', localStorage.getItem('token'))
console.log('Refresh Token:', localStorage.getItem('refresh_token'))

// 2. 测试token验证
async function testTokenValidation() {
  try {
    const { userApi } = await import('./src/services/api.js')
    const response = await userApi.checkLoginStatus()
    console.log('Token验证结果:', response)
  } catch (error) {
    console.error('Token验证失败:', error)
  }
}

// 3. 模拟token过期
function simulateTokenExpiry() {
  // 保存refresh_token
  const refreshToken = localStorage.getItem('refresh_token')
  
  // 清除access_token
  localStorage.removeItem('token')
  
  console.log('已模拟token过期，refresh_token保留:', !!refreshToken)
  
  // 尝试API请求，应该触发自动刷新
  testTokenValidation()
}

// 4. 完全清除认证信息
function clearAllAuth() {
  localStorage.removeItem('token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('id_token')
  console.log('已清除所有认证信息')
}

// 运行测试
console.log('可用的测试函数:')
console.log('- testTokenValidation(): 测试token验证')
console.log('- simulateTokenExpiry(): 模拟token过期')
console.log('- clearAllAuth(): 清除所有认证信息')
```

## 后端配置调整（用于测试）

如果需要快速测试token过期，可以临时修改后端配置：

```python
# 在 xhs_backend/api/deps.py 或相关文件中
ACCESS_TOKEN_EXPIRE_MINUTES = 1  # 改为1分钟，便于测试
```

## 预期日志输出

### 正常登录
```
[Auth] 使用auth工具函数设置令牌，这会自动启动定期检查
[Auth] 启动定期token检查（每5分钟一次）
```

### Token过期处理
```
[Auth] API请求失败: {url: "/api/v1/...", status: 401, message: "..."}
[Auth] 收到401未授权响应，尝试刷新token
[Auth] 尝试刷新token...
[Auth] Token刷新成功，重试原始请求
```

### 刷新失败
```
[Auth] Token刷新失败，跳转登录页
[Auth] 处理认证失败，清除token并跳转登录页
[Auth] 使用Vue Router跳转到登录页
```

## 故障排除

### 问题1：没有显示过期提示
- 检查ElementPlus是否正确导入
- 查看控制台是否有错误信息

### 问题2：没有自动跳转登录页
- 检查路由器是否正确设置
- 确认`setRouter(router)`在main.js中被调用

### 问题3：定期检查没有启动
- 确认登录时使用了`setAuthTokens()`函数
- 检查控制台是否有相关日志

## 验证清单

- [ ] Token过期时显示用户友好提示
- [ ] 自动清除本地存储的无效token
- [ ] 自动跳转到登录页面
- [ ] 有refresh_token时自动刷新access_token
- [ ] 定期检查token状态（每5分钟）
- [ ] 完整的日志记录便于调试
- [ ] 登录成功后启动定期检查

## 注意事项

1. **生产环境**：token过期时间应该设置合理（如7天）
2. **安全性**：refresh_token也有过期时间，需要定期重新登录
3. **用户体验**：过期提示应该友好，避免突然跳转
4. **日志级别**：生产环境可以减少详细日志输出 