# 小红书扩展安装指南

## 最新更新 (2024-01-20)

✅ **已修复问题：**
- 修复了历史评论按钮不显示的问题
- 修复了备注输入框不显示的问题
- 优化了模块加载顺序和依赖关系
- 改进了错误处理和调试信息

## 安装步骤

### 1. 准备扩展文件
确保你有完整的 `xhs_plugin_v2` 文件夹，包含以下关键文件：
- `manifest.json`
- `background/index.js`
- `content/index.js`
- `injected/` 文件夹（包含所有注入脚本）
- `popup.html` 和相关文件

### 2. 加载扩展到Chrome
1. 打开Chrome浏览器
2. 地址栏输入 `chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择 `xhs_plugin_v2` 文件夹

### 3. 配置扩展
1. 点击扩展图标打开设置
2. 配置后端API地址（默认：`http://localhost:8000`）
3. 如果需要，配置认证token

### 4. 验证安装

#### 在小红书通知页面验证：
1. 访问 `https://www.xiaohongshu.com/notification`
2. 打开浏览器开发者工具（F12）
3. 在控制台运行以下代码验证：

```javascript
// 快速验证脚本
console.log('=== 扩展状态检查 ===');
console.log('API服务:', typeof window.xhsApiService !== 'undefined' ? '✓' : '✗');
console.log('用户备注:', typeof window.xhsUserNotes !== 'undefined' ? '✓' : '✗');
console.log('对话框管理:', typeof window.xhsDialogManager !== 'undefined' ? '✓' : '✗');
console.log('通知处理:', typeof window.xhsNotificationHandler !== 'undefined' ? '✓' : '✗');

const containers = document.querySelectorAll('.tabs-content-container .container');
const buttons = document.querySelectorAll('.xhs-plugin-action-btn');
const noteInputs = document.querySelectorAll('.xhs-note-input');

console.log('通知容器:', containers.length);
console.log('历史评论按钮:', buttons.length);
console.log('备注输入框:', noteInputs.length);

if (buttons.length === 0 && containers.length > 0) {
    console.log('尝试手动初始化...');
    if (window.xhsNotificationHandler) {
        window.xhsNotificationHandler.initializeNotificationHandler();
    }
}
```

#### 期望结果：
- ✅ 所有模块都应显示 "✓"
- ✅ 每个通知项右侧应有红色的"历史评论"按钮
- ✅ 每个通知项右侧应有备注输入框
- ✅ 点击"历史评论"按钮应弹出对话框

## 功能说明

### 1. 历史评论功能
- **位置**：每个通知项左侧的红色按钮
- **功能**：点击查看该用户的历史评论记录
- **数据来源**：从后端API获取

### 2. 用户备注功能
- **位置**：每个通知项右侧的文本框
- **功能**：为用户添加个人备注
- **自动保存**：输入内容会自动保存到后端
- **状态指示**：保存成功/失败会有颜色提示

### 3. 网络请求监控
- **自动抓取**：监控小红书的网络请求
- **规则匹配**：根据预设规则抓取相关数据
- **数据上传**：自动上传到配置的后端服务

## 故障排除

### 问题1：按钮或输入框不显示
**解决方案：**
1. 刷新页面
2. 检查控制台是否有错误信息
3. 手动运行初始化代码：
```javascript
if (window.xhsNotificationHandler) {
    window.xhsNotificationHandler.initializeNotificationHandler();
}
```

### 问题2：扩展无法加载
**解决方案：**
1. 检查manifest.json格式是否正确
2. 确认所有文件路径存在
3. 重新加载扩展：
   - 在 `chrome://extensions/` 页面
   - 点击扩展的"重新加载"按钮

### 问题3：API请求失败
**解决方案：**
1. 检查后端服务是否运行
2. 确认API地址配置正确
3. 检查网络连接和CORS设置

### 问题4：权限问题
**解决方案：**
1. 确认manifest.json中的permissions配置
2. 重新安装扩展
3. 检查Chrome的扩展权限设置

## 调试技巧

### 1. 查看扩展日志
- 打开 `chrome://extensions/`
- 找到扩展，点击"检查视图"中的链接
- 查看background script的控制台

### 2. 查看页面注入日志
- 在小红书页面按F12打开开发者工具
- 查看Console标签页
- 搜索 `[XHS Plugin]` 或 `[User Notes]` 等关键词

### 3. 手动测试功能
```javascript
// 测试API服务
if (window.xhsApiService) {
    window.xhsApiService.getApiConfig().then(console.log);
}

// 测试用户备注
if (window.xhsUserNotes) {
    console.log('用户备注模块可用');
}

// 测试对话框
if (window.xhsDialogManager) {
    // window.xhsDialogManager.showNotificationDialog(0);
}
```

## 开发者信息

- **版本**：2.1.0
- **最后更新**：2024-01-20
- **支持页面**：xiaohongshu.com
- **依赖**：Chrome 88+

## 更新日志

### v2.1.0 (2024-01-20)
- 🔧 修复了模块加载顺序问题
- 🔧 修复了ES6模块导入/导出问题
- 🔧 改进了错误处理和日志输出
- 🔧 优化了初始化流程
- ✨ 添加了详细的调试工具

### v2.0.0
- ✨ 添加了用户备注功能
- ✨ 添加了历史评论查看功能
- 🔧 重构了代码架构
- 🔧 改进了UI交互

## 🚀 快速安装

### 1. 准备工作
确保你有以下环境：
- Chrome 浏览器 88+ 
- 后端API服务运行在 `http://localhost:8000`
- 有效的API访问令牌

### 2. 安装插件
1. 下载或克隆整个项目
2. 打开Chrome浏览器，访问 `chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择 `xhs_plugin_v2` 文件夹
6. 确认插件图标出现在浏览器工具栏

### 3. 配置插件
1. 点击插件图标 → "选项"
2. 设置API基础地址：`http://localhost:8000`
3. 输入你的API访问令牌
4. 点击"保存设置"

## 🧪 功能测试

### 测试1：基础功能检查
1. 打开测试页面：`chrome-extension://[插件ID]/test_user_notes.html`
2. 点击"检查插件状态"按钮
3. 确认所有模块都显示"已加载"

### 测试2：API连接测试
1. 在测试页面点击"测试API服务"
2. 确认API配置获取成功
3. 检查控制台是否有连接错误

### 测试3：备注功能测试
1. 在测试页面点击"测试备注功能"
2. 确认每个模拟通知右侧出现备注输入框
3. 在输入框中输入文本，观察保存状态变化

### 测试4：真实环境测试
1. 访问 `https://www.xiaohongshu.com/notification`
2. 登录你的小红书账号
3. 确认通知列表中每个通知右侧都有备注输入框
4. 测试备注输入和保存功能

## 🔧 故障排除

### 问题1：插件无法加载
**症状**：插件图标不显示或显示错误
**解决方案**：
- 检查 `manifest.json` 语法是否正确
- 确认所有必需文件都存在
- 查看扩展管理页面的错误信息

### 问题2：备注输入框不显示
**症状**：在通知页面看不到备注输入框
**解决方案**：
- 打开开发者工具，查看控制台错误
- 确认在小红书通知页面（URL包含 `/notification`）
- 检查是否有JavaScript错误阻止了脚本执行

### 问题3：备注保存失败
**症状**：输入备注后显示红色边框（保存失败）
**解决方案**：
- 检查后端API服务是否运行
- 确认API地址和令牌配置正确
- 查看网络面板的API请求状态

### 问题4：历史评论功能不工作
**症状**：点击"历史评论"按钮无反应或显示错误
**解决方案**：
- 确认用户有历史评论数据
- 检查API令牌是否有效
- 查看控制台的API请求错误

## 📊 调试技巧

### 1. 控制台日志
打开开发者工具 → Console，查找以下标签的日志：
- `[XHS Plugin]` - 主插件日志
- `[User Notes]` - 用户备注日志  
- `[API Service]` - API服务日志
- `[Notification Handler]` - 通知处理日志

### 2. 网络请求监控
在开发者工具 → Network 面板中：
- 过滤 `localhost:8000` 查看API请求
- 检查请求状态码和响应内容
- 确认请求头包含正确的授权信息

### 3. 存储检查
在开发者工具 → Application → Storage：
- 查看 Extension storage 中的配置数据
- 确认API地址和令牌已正确保存

### 4. 元素检查
在页面上右键 → 检查元素：
- 查找 `.xhs-note-input` 类的备注输入框
- 确认 `.xhs-plugin-action-btn` 历史评论按钮存在
- 检查元素的样式和位置

## 🎯 性能优化

### 1. 减少API调用
- 插件会批量获取用户备注，减少单独请求
- 使用防抖机制延迟保存，避免频繁API调用

### 2. 内存管理  
- 备注数据缓存在内存中，避免重复请求
- 页面切换时会清理不必要的监听器

### 3. 错误恢复
- API请求失败时会自动重试
- 网络错误不会影响其他功能的正常使用

## 📋 测试清单

安装完成后，请按以下清单逐项测试：

- [ ] 插件成功加载，图标显示正常
- [ ] 选项页面可以正常打开和保存设置
- [ ] 测试页面显示所有模块已加载
- [ ] API连接测试通过
- [ ] 在测试页面可以看到备注输入框
- [ ] 在真实通知页面可以看到备注输入框
- [ ] 备注输入和保存功能正常
- [ ] 历史评论按钮点击正常
- [ ] 历史评论弹窗显示正常
- [ ] 页面刷新后备注内容保持

## 🆘 获取帮助

如果遇到问题：

1. **查看文档**：阅读 [README.md](README.md) 和 [USER_NOTES_FEATURE.md](USER_NOTES_FEATURE.md)
2. **检查日志**：使用浏览器开发者工具查看详细错误信息
3. **测试环境**：使用提供的测试页面验证功能
4. **重新安装**：删除插件后重新安装
5. **联系支持**：提供详细的错误信息和复现步骤

---

**提示**：首次使用建议先在测试页面验证功能，确认无误后再在真实环境中使用。 