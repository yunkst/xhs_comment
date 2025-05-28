# GET请求响应内容抓取测试指南

## 🎯 **抓取能力总结**

### ✅ **可以完整抓取响应内容的GET请求类型：**

1. **JavaScript Fetch API请求**
   - ✅ 完整响应体
   - ✅ 响应头信息
   - ✅ 响应时间
   - ✅ 状态码

2. **XMLHttpRequest (AJAX)请求**
   - ✅ 完整响应体
   - ✅ 响应头信息
   - ✅ 响应时间
   - ✅ 状态码

3. **API接口请求 (含/api/路径或.json后缀)**
   - ✅ 通过重新获取方式抓取响应体
   - ✅ 响应头信息
   - ✅ 状态码

### ⚠️ **部分抓取的请求类型：**

1. **资源加载请求 (图片、CSS、JS等)**
   - ❌ 响应体内容 (受浏览器安全限制)
   - ✅ 性能数据 (大小、耗时等)
   - ✅ 响应头 (通过WebRequest API)

2. **页面导航请求**
   - ❌ 响应体内容
   - ✅ 基本性能数据
   - ✅ 响应头

## 🧪 **测试方法**

### 1. 准备工作
1. 重新加载插件 (在chrome://extensions/中点击刷新)
2. 访问小红书官网
3. 打开浏览器开发者工具 (F12)
4. 查看Console标签页，应该看到：
   ```
   小红书网络请求拦截器已注入
   增强GET请求响应拦截器已启动
   [XHS Monitor Enhanced] 增强拦截器初始化完成
   ```

### 2. 测试JavaScript发起的GET请求

#### 测试方法1：在Console中手动发起请求
```javascript
// 测试Fetch API
fetch('https://edith.xiaohongshu.com/api/sns/web/v1/user/me')
  .then(response => response.json())
  .then(data => console.log('Fetch测试完成', data));

// 测试XMLHttpRequest
const xhr = new XMLHttpRequest();
xhr.open('GET', 'https://edith.xiaohongshu.com/api/sns/web/v1/user/me');
xhr.onload = function() {
  console.log('XHR测试完成', xhr.responseText);
};
xhr.send();
```

#### 预期结果：
- Console中看到 `[XHS Monitor Enhanced] Fetch拦截: GET https://...`
- Console中看到 `[XHS Monitor Enhanced] Fetch响应拦截: 200 https://... (123ms, 456 bytes)`
- 插件弹窗中显示完整的请求和响应信息

### 3. 测试页面操作触发的AJAX请求

#### 操作方法：
1. 在小红书页面中进行正常操作：
   - 滚动页面加载更多内容
   - 点击用户头像查看资料
   - 点击笔记查看详情
   - 进行搜索操作

#### 预期结果：
- 每个AJAX请求都会在Console中显示拦截日志
- 插件弹窗显示包含响应体的完整信息

### 4. 测试API接口重新获取功能

#### 触发条件：
- URL包含 `/api/` 路径
- URL以 `.json` 结尾

#### 预期结果：
- Console中看到 `[XHS Monitor Enhanced] 重新获取响应成功: https://...`
- 插件弹窗中显示通过重新获取得到的响应内容

## 📊 **验证清单**

### 基础功能验证
- [ ] 插件图标显示请求计数
- [ ] Console中显示增强拦截器启动信息
- [ ] 手动fetch请求被正确拦截
- [ ] 响应体内容正确显示

### 响应内容验证
- [ ] JSON响应自动格式化显示
- [ ] 响应时间正确计算
- [ ] 响应大小正确显示
- [ ] 响应头信息完整

### 性能数据验证
- [ ] 传输大小信息显示
- [ ] 编码/解码大小信息
- [ ] 请求持续时间
- [ ] 发起类型识别

### 错误处理验证
- [ ] 网络错误正确记录
- [ ] 无法读取的响应体有相应提示
- [ ] 插件不会因错误而停止工作

## 🔍 **调试技巧**

### 1. 查看详细日志
在Console中输入以下命令查看更多信息：
```javascript
// 查看页面监控状态
console.log('监控状态:', document.documentElement.getAttribute('data-xhs-monitor-enhanced'));

// 手动触发事件测试
window.dispatchEvent(new CustomEvent('XHS_REQUEST_INTERCEPTED', {
  detail: { url: 'test', method: 'GET', type: 'test' }
}));
```

### 2. 性能监控
```javascript
// 查看Performance API支持
console.log('Performance Observer支持:', 'PerformanceObserver' in window);

// 查看最近的网络请求
performance.getEntriesByType('resource')
  .filter(entry => entry.name.includes('xiaohongshu.com'))
  .forEach(entry => console.log(entry));
```

## ⚠️ **已知限制**

1. **CORS限制**：某些跨域请求无法重新获取响应内容
2. **安全策略**：浏览器可能阻止读取某些敏感响应
3. **大文件限制**：超大响应体可能影响性能
4. **缓存影响**：重新获取可能返回缓存内容而非原始响应

## 🛠 **故障排除**

### 问题1：看不到Console日志
**解决方案：**
- 确保在小红书页面中打开开发者工具
- 检查Console过滤设置
- 刷新页面重新加载脚本

### 问题2：部分请求没有响应体
**可能原因：**
- 请求类型不支持响应体读取
- 网络错误导致响应不完整
- 浏览器安全策略限制

### 问题3：性能数据缺失
**解决方案：**
- 检查浏览器版本是否支持Performance Observer
- 确保页面完全加载后再测试
- 某些请求类型可能不产生性能条目 