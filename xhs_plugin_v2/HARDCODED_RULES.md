# 固化抓取规则说明

## 概述

插件内置了一些基础的抓取规则，这些规则直接写在代码中，无需通过管理页面进行配置。固化规则的优先级高于动态规则，确保重要的数据接口始终被监控。

## 当前固化规则

### 1. 通知列表
- **规则名称**: 通知列表
- **匹配模式**: `/api/sns/web/v1/you/mentions`
- **描述**: 抓取用户通知列表数据
- **状态**: 启用
- **数据处理**: 自动发送到后端系统

#### 匹配的URL示例:
```
https://edith.xiaohongshu.com/api/sns/web/v1/you/mentions?num=20&cursor=
https://edith.xiaohongshu.com/api/sns/web/v1/you/mentions
```

#### 后端处理日志示例:
```
规则: 通知列表, URL: //edith.xiaohongshu.com/api/sns/web/v1/you/mentions?num=20&cursor=
INFO:api.services.note:笔记保存/更新完成。插入: 6, 更新: 3
INFO:api.services.comment:评论保存/更新完成。插入: 9, 更新: 0
INFO:api.services.notification:向集合 'notifications' 插入 9 条通知记录...
INFO:api.services.notification:成功插入 9 条记录到集合 'notifications'
INFO:api.v1.system.network_data:网络数据处理成功: 18 条数据已保存
```

## 技术实现

### 代码位置

固化规则定义在以下文件中：

1. **前端拦截器**: `injected/utils.js`
   ```javascript
   const HARDCODED_CAPTURE_RULES = [
       {
           name: '通知列表',
           pattern: '/api/sns/web/v1/you/mentions',
           enabled: true,
           description: '抓取用户通知列表数据'
       }
   ];
   ```

2. **后端处理器**: `background/webRequest.js`
   ```javascript
   const HARDCODED_CAPTURE_RULES = [
       {
           name: '通知列表',
           pattern: '/api/sns/web/v1/you/mentions',
           enabled: true,
           description: '抓取用户通知列表数据',
           isHardcoded: true
       }
   ];
   ```

### 匹配逻辑

1. **URL检查**: 使用 `url.includes(rule.pattern)` 进行模式匹配
2. **优先级**: 固化规则优先于动态规则检查
3. **状态检查**: 只有 `enabled: true` 的规则才会生效

### 数据流程

```
页面请求 → 拦截器检查 → 匹配固化规则 → 记录日志 → 发送到后端 → 数据处理
```

## 添加新的固化规则

如果需要添加新的固化规则，需要修改以下文件：

### 1. 更新前端拦截器
文件: `injected/utils.js`
```javascript
const HARDCODED_CAPTURE_RULES = [
    // 现有规则...
    {
        name: '新规则名称',
        pattern: '/api/path/to/match',
        enabled: true,
        description: '规则描述'
    }
];
```

### 2. 更新后端处理器
文件: `background/webRequest.js`
```javascript
const HARDCODED_CAPTURE_RULES = [
    // 现有规则...
    {
        name: '新规则名称',
        pattern: '/api/path/to/match',
        enabled: true,
        description: '规则描述',
        isHardcoded: true
    }
];
```

### 3. 更新文档
在本文档中添加新规则的说明。

## 调试和监控

### 控制台日志

当URL匹配到固化规则时，会在控制台输出日志：

```
[XHS Monitor] 匹配到固化规则: 通知列表, URL: https://edith.xiaohongshu.com/api/sns/web/v1/you/mentions
[Background] URL匹配到固化规则: 通知列表, URL: https://edith.xiaohongshu.com/api/sns/web/v1/you/mentions
```

### 数据验证

可以通过以下方式验证固化规则是否正常工作：

1. 打开小红书网站
2. 访问通知页面
3. 查看浏览器开发者工具的Console标签
4. 确认看到匹配日志
5. 检查后端系统是否收到数据

## 注意事项

1. **不可配置**: 固化规则不能通过用户界面进行开关或修改
2. **优先级**: 固化规则优先级高于动态规则
3. **版本控制**: 修改固化规则需要更新插件版本
4. **测试**: 添加新规则后务必进行充分测试

## 版本历史

### v2.1.0
- 添加通知列表固化规则
- 实现固化规则优先级机制
- 完善规则匹配日志 