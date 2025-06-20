# Popup界面SSO登录按钮显示修复

## 问题描述

用户反馈：点击插件图标后，没有看到SSO登录按钮。

## 问题原因

在`popup/ui.js`的`updateApiStatus`函数中，当未配置API服务时，SSO容器被隐藏了：

```javascript
} else {
    // 未配置API服务的情况
    elements.ssoContainer.style.display = 'none'; // 这里隐藏了SSO容器
}
```

这导致用户无法看到SSO登录按钮，也无法进行后续的配置和登录操作。

## 修复方案

### 1. 显示SSO容器

修改`updateApiStatus`函数，即使未配置API服务也显示SSO容器：

```javascript
} else {
    elements.apiStatusIndicator.classList.remove('connected');
    elements.apiStatusIndicator.style.backgroundColor = '';
    elements.apiStatusText.textContent = '❌ 未配置API服务';
    elements.ssoContainer.style.display = 'block'; // 显示SSO容器
    elements.logoutContainer.classList.remove('show');
    updateSsoButtons();
}
```

### 2. 智能按钮文本

修改`updateSsoButtons`函数，根据API配置状态显示不同的按钮文本：

```javascript
export function updateSsoButtons() {
    const hasHost = !!appState.apiConfig.host;
    
    if (appState.ssoSession.id && appState.ssoSession.status === 'pending') {
        elements.ssoCheckLogin.style.display = 'block';
        elements.ssoCheckLogin.classList.remove('hidden');
        elements.ssoStartLogin.innerHTML = '🔄 重新发起SSO登录';
    } else {
        elements.ssoCheckLogin.style.display = 'none';
        if (hasHost) {
            elements.ssoStartLogin.innerHTML = '🔐 单点登录 (SSO)';
        } else {
            elements.ssoStartLogin.innerHTML = '⚙️ 先配置API地址';
        }
    }
}
```

### 3. 自动跳转配置

修改`startSsoLogin`函数，未配置API地址时自动打开配置页面：

```javascript
export async function startSsoLogin() {
    if (!appState.apiConfig.host) {
        showToast('请先在配置页面设置API地址', 'error');
        // 打开配置页面
        chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
        return;
    }
    // ... 其他SSO登录逻辑
}
```

## 修复效果

### 修复前
- ❌ 未配置API时看不到SSO按钮
- ❌ 用户不知道如何开始配置
- ❌ 用户体验不友好

### 修复后
- ✅ 始终显示SSO按钮
- ✅ 按钮文本智能提示："⚙️ 先配置API地址"
- ✅ 点击按钮自动跳转到配置页面
- ✅ 配置完成后显示："🔐 单点登录 (SSO)"

## 用户操作流程

### 新用户首次使用
1. 点击插件图标
2. 看到"❌ 未配置API服务"状态
3. 看到"⚙️ 先配置API地址"按钮
4. 点击按钮自动跳转到配置页面
5. 配置API地址后返回
6. 看到"🔐 单点登录 (SSO)"按钮
7. 点击进行SSO登录

### 已配置用户
1. 点击插件图标
2. 看到"⚙️ API已配置: xxx... (未登录)"状态
3. 看到"🔐 单点登录 (SSO)"按钮
4. 点击进行SSO登录

### 已登录用户
1. 点击插件图标
2. 看到"✅ API已连接: xxx... (已登录)"状态
3. 看到"🚪 退出登录"按钮
4. 可以选择退出登录

## 测试方法

### 1. 测试未配置状态
```javascript
// 在浏览器控制台中清除配置
chrome.storage.local.remove('xhs_api_config');
// 重新打开popup检查显示
```

### 2. 测试已配置状态
```javascript
// 在浏览器控制台中设置API地址
chrome.storage.local.set({
    'xhs_api_config': {
        host: 'http://localhost:8000',
        token: '',
        refreshToken: ''
    }
});
// 重新打开popup检查显示
```

### 3. 测试已登录状态
```javascript
// 在浏览器控制台中设置完整配置
chrome.storage.local.set({
    'xhs_api_config': {
        host: 'http://localhost:8000',
        token: 'sample_token',
        refreshToken: 'sample_refresh_token'
    }
});
// 重新打开popup检查显示
```

## 相关文件

- `xhs_plugin_v2/popup/ui.js` - UI更新逻辑
- `xhs_plugin_v2/popup/sso.js` - SSO登录逻辑
- `xhs_plugin_v2/popup.html` - HTML结构
- `xhs_plugin_v2/popup.css` - 样式定义

## 版本信息

- 修复版本：v2.4.0
- 修复日期：2024-12-01
- 相关Issue：用户反馈popup界面SSO按钮不显示 