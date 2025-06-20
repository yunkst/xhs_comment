# 小红书网络请求监控插件 v2.1.0

一个用于监控和记录小红书网络请求的Chrome扩展插件，内置固化抓取规则和历史评论查看功能。

## 🆕 新功能：通知备注功能

在小红书通知页面为每个通知添加备注输入框，支持：
- ✅ 实时自动保存
- ✅ 状态可视化反馈
- ✅ 批量备注加载
- ✅ 数据持久化存储

详细说明请查看：[用户备注功能文档](USER_NOTES_FEATURE.md)

## 主要功能

### 🔍 网络请求监控
- 监控所有发往 xiaohongshu.com 的网络请求
- 自动记录请求和响应数据
- 支持请求过滤和分类

### 📋 固化抓取规则
- 内置预定义的数据抓取规则
- 自动识别和处理特定API接口
- 支持规则的动态更新和管理

### 📝 历史评论查看
- 在通知页面添加"历史评论"按钮
- 查看用户的历史评论记录
- 支持按笔记分组显示

### 💬 通知备注功能 (新增)
- 在每个通知旁边添加备注输入框
- 支持实时保存和状态反馈
- 备注数据持久化存储

### ⚙️ 配置管理
- 可配置的API接口地址
- 支持用户认证和权限控制
- 灵活的插件选项设置

## 安装和使用

### 1. 安装插件
1. 下载或克隆此项目
2. 打开Chrome浏览器，进入 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择 `xhs_plugin_v2` 文件夹

### 2. 配置插件
1. 点击插件图标，进入选项页面
2. 设置后端API地址（默认：http://localhost:8000）
3. 配置认证令牌
4. 保存设置

### 3. 使用功能
- **网络监控**：自动运行，无需手动操作
- **历史评论**：在小红书通知页面点击"历史评论"按钮
- **通知备注**：在通知页面的备注输入框中输入内容

## 技术架构

### 文件结构
```
xhs_plugin_v2/
├── manifest.json              # 插件配置文件
├── background/                # 后台脚本
│   ├── index.js
│   ├── api.js
│   ├── storage.js
│   └── webRequest.js
├── content/                   # 内容脚本
│   └── index.js
├── injected/                  # 注入脚本
│   ├── index.js               # 主入口
│   ├── api-service.js         # API服务
│   ├── dialog-manager.js      # 对话框管理
│   ├── notification-handler.js # 通知处理
│   ├── user-notes.js          # 用户备注 (新增)
│   ├── fetch.js               # Fetch拦截
│   ├── xhr.js                 # XHR拦截
│   ├── observer.js            # DOM观察
│   └── utils.js               # 工具函数
├── popup/                     # 弹窗页面
├── options/                   # 选项页面
├── logs/                      # 日志页面
└── shared/                    # 共享资源
```

### 核心模块

1. **网络拦截器**
   - `fetch.js` - 拦截 Fetch API 请求
   - `xhr.js` - 拦截 XMLHttpRequest 请求

2. **数据处理器**
   - `api-service.js` - API服务和数据处理
   - `notification-handler.js` - 通知页面处理

3. **用户界面**
   - `dialog-manager.js` - 弹窗和对话框管理
   - `user-notes.js` - 用户备注功能

4. **后台服务**
   - `webRequest.js` - Web请求监控
   - `storage.js` - 数据存储管理

## API接口

### 历史评论接口
```
GET /api/comments/user/{userId}
```

### 用户备注接口
```
POST /api/user-notes
GET /api/user-notes?user_id={userId}
GET /api/user-notes/batch?user_ids={userIds}
```

### 抓取规则接口
```
GET /api/v1/system/capture-rules
```

## 开发指南

### 调试方法
1. 打开Chrome开发者工具
2. 查看Console面板的日志输出
3. 使用以下标签过滤日志：
   - `[XHS Plugin]` - 主插件日志
   - `[User Notes]` - 用户备注日志
   - `[API Service]` - API服务日志
   - `[Notification Handler]` - 通知处理日志

### 扩展开发
1. 修改 `injected/` 目录下的相关文件
2. 更新 `manifest.json` 中的 `web_accessible_resources`
3. 重新加载插件进行测试

### 常见问题

**Q: 备注输入框不显示？**
A: 检查插件是否正确加载，确认在小红书通知页面。

**Q: 备注保存失败？**
A: 检查API服务器状态和认证配置。

**Q: 历史评论显示空白？**
A: 确认用户有历史评论数据，检查API接口返回。

## 更新日志

### v2.1.0 (2024-01-XX)
- ✨ 新增通知备注功能
- ✨ 实现智能保存机制
- ✨ 添加状态可视化反馈
- ✨ 支持批量备注加载
- 🐛 修复API服务导出问题
- 📚 完善功能文档

### v2.0.0
- 🎉 重构插件架构
- ✨ 添加历史评论功能
- ✨ 实现固化抓取规则
- ⚡ 优化性能和稳定性

### v1.0.0
- 🎉 初始版本发布
- ✨ 基础网络监控功能

## 许可证

本项目采用 MIT 许可证。详情请查看 [LICENSE](../LICENSE) 文件。

## 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目。

---

**注意：** 此插件仅供学习和研究使用，请遵守相关网站的使用条款。 