// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', function() {
  // 获取DOM元素
  const apiHostInput = document.getElementById('apiHost');
  const saveBtn = document.getElementById('saveBtn');
  const statusEl = document.getElementById('status');
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const loginUsernameInput = document.getElementById('loginUsername');
  const loginPasswordInput = document.getElementById('loginPassword');
  const loginOtpInput = document.getElementById('loginOtp');
  const showRegisterBtn = document.getElementById('showRegisterBtn');
  const registerModal = document.getElementById('registerModal');
  const closeRegisterBtn = document.getElementById('closeRegisterBtn');
  const registerBtn = document.getElementById('registerBtn');
  const regUsernameInput = document.getElementById('regUsername');
  const regPasswordInput = document.getElementById('regPassword');
  const regPassword2Input = document.getElementById('regPassword2');
  const regOtpInput = document.getElementById('regOtp');
  const registerStatus = document.getElementById('registerStatus');
  const otpQrcodeGroup = document.getElementById('otpQrcodeGroup');
  const otpQrcodeDiv = document.getElementById('otpQrcode');
  const otpCodeGroup = document.getElementById('otpCodeGroup');
  const ssoStartLoginButton = document.getElementById('ssoStartLogin');
  const ssoCheckLoginButton = document.getElementById('ssoCheckLogin');
  // 获取自动上传评论开关
  const autoUploadCommentsCheckbox = document.getElementById('autoUploadComments');
  
  // SSO会话信息
  let ssoSession = {
    id: null,
    status: 'idle', // 'idle', 'pending', 'completed', 'failed'
    pollInterval: null
  };
  
  // 通过background.js代理API请求，解决跨域问题
  async function proxyFetch(url, options = {}) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'proxyApiRequest',
        url: url,
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.body
      }, response => {
        if (chrome.runtime.lastError) {
          console.error('消息发送错误:', chrome.runtime.lastError);
          reject(new Error(`消息发送失败: ${chrome.runtime.lastError.message}`));
          return;
        }
        
        if (!response) {
          reject(new Error('未收到代理响应'));
          return;
        }
        
        if (!response.success) {
          reject(new Error(response.error || '代理请求失败'));
          return;
        }
        
        // 模拟fetch返回的Response对象
        const fetchResponse = {
          ok: response.status >= 200 && response.status < 300,
          status: response.status,
          statusText: response.statusText,
          text: () => Promise.resolve(typeof response.data === 'string' ? response.data : JSON.stringify(response.data)),
          json: () => Promise.resolve(response.data)
        };
        
        resolve(fetchResponse);
      });
    });
  }
  
  // 从storage中加载已保存的配置
  chrome.storage.local.get(['apiBaseUrl', 'apiToken', 'autoUploadComments'], function(result) {
    if (result.apiBaseUrl) {
      apiHostInput.value = result.apiBaseUrl;
    }
    
    // 加载自动上传评论设置
    autoUploadCommentsCheckbox.checked = result.autoUploadComments === true;
    
    // 如果有token，显示已登录状态
    if (result.apiToken) {
      loginBtn.textContent = '已登录';
      loginBtn.style.backgroundColor = '#00994d';
      logoutBtn.style.display = 'inline-block';
    } else {
      logoutBtn.style.display = 'none';
    }
    
    console.log('从存储加载配置:', result);
  });
  
  // SSO启动登录按钮事件
  ssoStartLoginButton.addEventListener('click', function() {
    startSsoLogin();
  });
  
  // SSO检查登录按钮事件
  ssoCheckLoginButton.addEventListener('click', function() {
    checkSsoLoginStatus();
  });
  
  // 启动SSO登录流程
  async function startSsoLogin() {
    const apiBaseUrl = apiHostInput.value.trim();
    
    if (!apiBaseUrl) {
      showStatus('请先设置API地址', 'error');
      return;
    }
    
    if (!apiBaseUrl.startsWith('http')) {
      showStatus('API接口地址必须以http://或https://开头', 'error');
      return;
    }
    
    // 更新状态
    showStatus('正在准备SSO登录...', '');
    ssoStartLoginButton.disabled = true;
    ssoStartLoginButton.innerHTML = '<span class="spinner"></span>初始化SSO...';
    
    try {
      // 创建SSO会话
      const response = await fetch(`${apiBaseUrl}/api/auth/sso-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_type: 'plugin'
        })
      });
      
      if (!response.ok) {
        throw new Error(`服务器返回错误状态: ${response.status}`);
      }
      
      const data = await response.json();
      
      // 保存会话ID
      ssoSession.id = data.session_id;
      ssoSession.status = 'pending';
      
      // 显示已完成登录按钮
      ssoCheckLoginButton.style.display = 'inline-block';
      
      // 打开SSO登录URL
      const loginUrl = data.login_url;
      
      // 打开新标签页
      chrome.tabs.create({ url: loginUrl });
      
      showStatus('已打开SSO登录页面，请在新标签页完成登录后返回此处点击"已完成登录"按钮', 'success');
      ssoStartLoginButton.disabled = false;
      ssoStartLoginButton.innerHTML = '重新发起SSO登录';
      
      // 自动开始轮询（可选，也可以等用户点击"已完成登录"按钮）
      // startPollingLoginStatus();
      
    } catch (error) {
      console.error('SSO登录初始化失败:', error);
      ssoStartLoginButton.disabled = false;
      ssoStartLoginButton.innerHTML = '单点登录 (SSO)';
      showStatus(`SSO登录失败: ${error.message || '未知错误'}`, 'error');
      ssoSession.status = 'failed';
    }
  }
  
  // 检查SSO登录状态
  async function checkSsoLoginStatus() {
    const apiBaseUrl = apiHostInput.value.trim();
    
    if (ssoSession.id === null) {
      showStatus('无效的SSO会话，请重新发起登录', 'error');
      ssoCheckLoginButton.style.display = 'none';
      return;
    }
    
    // 更新UI
    ssoCheckLoginButton.disabled = true;
    ssoCheckLoginButton.innerHTML = '<span class="spinner"></span>正在检查登录状态...';
    showStatus('正在检查SSO登录状态...', '');
    
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/sso-session/${ssoSession.id}`);
      
      if (!response.ok) {
        throw new Error(`服务器返回错误状态: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'completed' && data.tokens) {
        // 登录成功，保存token
        const accessToken = data.tokens.access_token;
        const refreshToken = data.tokens.refresh_token;
        
        // 保存token到storage
        chrome.storage.local.set({
          apiBaseUrl: apiBaseUrl,
          apiToken: accessToken,
          refreshToken: refreshToken || '',
          autoUploadComments: autoUploadCommentsCheckbox.checked
        }, function() {
          if (chrome.runtime.lastError) {
            showStatus('保存Token失败: ' + chrome.runtime.lastError.message, 'error');
          } else {
            showStatus('SSO登录成功！', 'success');
            
            // 重置会话状态
            ssoSession = {
              id: null,
              status: 'idle',
              pollInterval: null
            };
            
            // 更新UI
            ssoCheckLoginButton.style.display = 'none';
            ssoStartLoginButton.innerHTML = '单点登录 (SSO)';
            
            // 更新登录按钮状态
            loginBtn.textContent = '已登录';
            loginBtn.style.backgroundColor = '#00994d';
            logoutBtn.style.display = 'inline-block';
            
            // 通知popup页面刷新API配置
            chrome.runtime.sendMessage({ action: 'refreshApiConfig' });
          }
          // 启用按钮
          ssoCheckLoginButton.disabled = false;
          ssoCheckLoginButton.innerHTML = '已完成登录，点击继续';
        });
      } else if (data.status === 'pending') {
        // 会话仍在等待完成
        showStatus('您尚未完成SSO登录，请在新标签页完成登录后返回', '');
        ssoCheckLoginButton.disabled = false;
        ssoCheckLoginButton.innerHTML = '已完成登录，点击继续';
      } else {
        showStatus('会话状态异常，请重新发起登录', 'error');
        ssoCheckLoginButton.disabled = false;
        ssoCheckLoginButton.innerHTML = '已完成登录，点击继续';
      }
    } catch (error) {
      console.error('检查SSO登录状态失败:', error);
      showStatus(`检查登录状态失败: ${error.message || '未知错误'}`, 'error');
      ssoCheckLoginButton.disabled = false;
      ssoCheckLoginButton.innerHTML = '已完成登录，点击继续';
    }
  }
  
  // 开始轮询登录状态（可选，如果希望自动检测）
  function startPollingLoginStatus() {
    const apiBaseUrl = apiHostInput.value.trim();
    
    // 清除可能已存在的轮询
    if (ssoSession.pollInterval) {
      clearInterval(ssoSession.pollInterval);
    }
    
    // 每3秒检查一次登录状态
    ssoSession.pollInterval = setInterval(async () => {
      if (ssoSession.id === null || ssoSession.status !== 'pending') {
        clearInterval(ssoSession.pollInterval);
        return;
      }
      
      try {
        const response = await fetch(`${apiBaseUrl}/api/auth/sso-session/${ssoSession.id}`);
        
        if (!response.ok) {
          throw new Error(`服务器返回错误状态: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.status === 'completed' && data.tokens) {
          // 登录成功，保存token并停止轮询
          clearInterval(ssoSession.pollInterval);
          
          const accessToken = data.tokens.access_token;
          const refreshToken = data.tokens.refresh_token;
          
          // 保存token到storage
          chrome.storage.local.set({
            apiBaseUrl: apiBaseUrl,
            apiToken: accessToken,
            refreshToken: refreshToken || '',
            autoUploadComments: autoUploadCommentsCheckbox.checked
          }, function() {
            if (chrome.runtime.lastError) {
              showStatus('保存Token失败: ' + chrome.runtime.lastError.message, 'error');
            } else {
              showStatus('SSO登录成功！', 'success');
              
              // 重置会话状态
              ssoSession = {
                id: null,
                status: 'idle',
                pollInterval: null
              };
              
              // 更新UI
              ssoCheckLoginButton.style.display = 'none';
              ssoStartLoginButton.innerHTML = '单点登录 (SSO)';
              
              // 更新登录按钮状态
              loginBtn.textContent = '已登录';
              loginBtn.style.backgroundColor = '#00994d';
              logoutBtn.style.display = 'inline-block';
              
              // 通知popup页面刷新API配置
              chrome.runtime.sendMessage({ action: 'refreshApiConfig' });
            }
          });
        }
      } catch (error) {
        console.error('轮询SSO状态失败:', error);
        // 出错时不停止轮询，继续尝试
      }
    }, 3000);
  }
  
  // 保存按钮点击事件
  saveBtn.addEventListener('click', function() {
    const apiBaseUrl = apiHostInput.value.trim();
    const autoUploadComments = autoUploadCommentsCheckbox.checked;
    
    if (!apiBaseUrl) {
      showStatus('API地址不能为空', 'error');
      return;
    }
    
    if (!apiBaseUrl.startsWith('http')) {
      showStatus('API接口地址必须以http://或https://开头', 'error');
      return;
    }
    
    // 保存API地址和自动上传评论设置
    chrome.storage.local.get(['apiToken'], function(result) {
      // 保留原有的token
      chrome.storage.local.set({
        apiBaseUrl: apiBaseUrl,
        apiToken: result.apiToken || '',
        autoUploadComments: autoUploadComments
      }, function() {
        if (chrome.runtime.lastError) {
          showStatus('保存设置失败: ' + chrome.runtime.lastError.message, 'error');
        } else {
          showStatus('设置已保存', 'success');
          
          // 通知popup页面刷新API配置
          chrome.runtime.sendMessage({ action: 'refreshApiConfig' });
        }
      });
    });
  });
  
  // 登录按钮点击事件
  loginBtn.addEventListener('click', async function() {
    const apiBaseUrl = apiHostInput.value.trim();
    const username = loginUsernameInput.value.trim();
    const password = loginPasswordInput.value;
    const otp = loginOtpInput.value.trim();

    if (!apiBaseUrl || !username || !password || !otp) {
      showStatus('请填写完整的API地址、账号、密码和动态验证码', 'error');
      return;
    }
    if (!apiBaseUrl.startsWith('http')) {
      showStatus('API接口地址必须以http://或https://开头', 'error');
      return;
    }
    try {
      showStatus('正在登录...', '');
      
      // 使用代理请求替代直接fetch
      const resp = await proxyFetch(apiBaseUrl + '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { username, password, otp_code: otp }
      });
      
      if (!resp.ok) {
        const err = await resp.text();
        throw new Error('登录失败: ' + err);
      }
      const data = await resp.json();
      if (!data.access_token) {
        throw new Error('未获取到JWT令牌');
      }
      // 保存JWT到apiToken，API地址也保存
      chrome.storage.local.set({
        apiBaseUrl: apiBaseUrl,
        apiToken: data.access_token,
        autoUploadComments: autoUploadCommentsCheckbox.checked
      }, function() {
        if (chrome.runtime.lastError) {
          showStatus('保存登录信息失败: ' + chrome.runtime.lastError.message, 'error');
        } else {
          showStatus('登录成功，令牌已保存', 'success');
          // 更新UI状态
          loginBtn.textContent = '已登录';
          loginBtn.style.backgroundColor = '#00994d';
          logoutBtn.style.display = 'inline-block';
          // 通知popup页面刷新API配置
          chrome.runtime.sendMessage({ action: 'refreshApiConfig' });
        }
      });
    } catch (e) {
      showStatus(e.message || '登录异常', 'error');
    }
  });
  
  // 退出登录按钮点击事件
  logoutBtn.addEventListener('click', function() {
    // 获取当前的autoUploadComments设置
    chrome.storage.local.get(['autoUploadComments'], function(result) {
      const autoUploadSetting = result.autoUploadComments;
      
      // 从存储中移除apiToken，但保留其他设置
      chrome.storage.local.remove('apiToken', function() {
        if (chrome.runtime.lastError) {
          showStatus('退出失败: ' + chrome.runtime.lastError.message, 'error');
        } else {
          // 重新保存autoUploadComments设置，确保它不会丢失
          chrome.storage.local.set({
            autoUploadComments: autoUploadSetting
          }, function() {
            // 更新UI状态
            loginBtn.textContent = '登录';
            loginBtn.style.backgroundColor = '#ff2442';
            logoutBtn.style.display = 'none';
            // 清空登录表单
            loginUsernameInput.value = '';
            loginPasswordInput.value = '';
            loginOtpInput.value = '';
            // 显示成功消息
            showStatus('已成功退出登录', 'success');
            // 通知popup页面刷新API配置
            chrome.runtime.sendMessage({ action: 'refreshApiConfig' });
          });
        }
      });
    });
  });
  
  // 显示注册弹窗
  showRegisterBtn.addEventListener('click', function() {
    registerModal.style.display = 'block';
    registerStatus.textContent = '';
    regUsernameInput.value = '';
    regPasswordInput.value = '';
    regPassword2Input.value = '';
    regOtpInput.value = '';
    otpQrcodeGroup.style.display = 'none';
    otpQrcodeDiv.innerHTML = '';
    otpCodeGroup.style.display = 'none';
  });
  // 关闭注册弹窗
  closeRegisterBtn.addEventListener('click', function() {
    registerModal.style.display = 'none';
  });

  // 注册流程
  registerBtn.addEventListener('click', async function() {
    const apiBaseUrl = apiHostInput.value.trim();
    const username = regUsernameInput.value.trim();
    const password = regPasswordInput.value;
    const password2 = regPassword2Input.value;
    const otp = regOtpInput.value.trim();
    if (!apiBaseUrl || !username || !password || !password2) {
      showRegisterStatus('请填写完整的API地址、账号和密码', 'error');
      return;
    }
    if (password !== password2) {
      showRegisterStatus('两次输入的密码不一致', 'error');
      return;
    }
    if (!apiBaseUrl.startsWith('http')) {
      showRegisterStatus('API接口地址必须以http://或https://开头', 'error');
      return;
    }
    // 第一步：注册账号
    if (otpQrcodeGroup.style.display === 'none') {
      try {
        showRegisterStatus('正在注册账号...', '');
        
        // 使用代理请求替代直接fetch
        const resp = await proxyFetch(apiBaseUrl + '/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: { username, password }
        });
        
        if (!resp.ok) {
          const err = await resp.text();
          throw new Error('注册失败: ' + err);
        }
        
        // 解析注册响应并保存token
        const data = await resp.json();
        if (!data.access_token) {
          throw new Error('注册成功但未获取到JWT令牌');
        }
        
        // 保存JWT令牌用于后续请求
        const token = data.access_token;
        chrome.storage.local.set({
          apiBaseUrl: apiBaseUrl,
          apiToken: token,
          autoUploadComments: autoUploadCommentsCheckbox.checked
        });
        
        // 注册成功，获取OTP二维码
        otpQrcodeGroup.style.display = 'block';
        otpCodeGroup.style.display = 'block';
        
        // 获取二维码 - 使用代理请求获取图片，并带上认证头
        const qrCodeUrl = apiBaseUrl + '/api/otp-qrcode';
        
        // 使用data URL形式显示二维码图片
        try {
          // 使用代理请求直接获取二维码二进制数据，并带上认证头
          chrome.runtime.sendMessage({
            action: 'proxyApiRequest',
            url: qrCodeUrl,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
            responseType: 'blob'
          }, response => {
            if (response && response.success && response.data) {
              // 创建Base64数据URL
              otpQrcodeDiv.innerHTML = `<img src="data:image/png;base64,${response.data}" style="width:180px;height:180px;">`;
            } else {
              // 显示错误信息
              otpQrcodeDiv.innerHTML = `<div class="error-msg">二维码加载失败，请重试</div>`;
              console.error('获取二维码失败:', response?.error || '未知错误');
            }
          });
        } catch (e) {
          console.error('获取二维码时出错:', e);
          otpQrcodeDiv.innerHTML = `<div class="error-msg">二维码加载失败: ${e.message}</div>`;
        }
        showRegisterStatus('请用App扫码绑定后，输入动态码完成注册', 'success');
      } catch (e) {
        showRegisterStatus(e.message || '注册异常', 'error');
      }
      return;
    }
    // 第二步：输入动态码，自动登录
    if (!otp) {
      showRegisterStatus('请输入动态验证码', 'error');
      return;
    }
    try {
      showRegisterStatus('正在验证动态码并登录...', '');
      
      // 使用代理请求替代直接fetch
      const resp = await proxyFetch(apiBaseUrl + '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { username, password, otp_code: otp }
      });
      
      if (!resp.ok) {
        const err = await resp.text();
        throw new Error('动态码验证失败: ' + err);
      }
      const data = await resp.json();
      if (!data.access_token) {
        throw new Error('未获取到JWT令牌');
      }
      chrome.storage.local.set({
        apiBaseUrl: apiBaseUrl,
        apiToken: data.access_token,
        autoUploadComments: autoUploadCommentsCheckbox.checked
      }, function() {
        if (chrome.runtime.lastError) {
          showRegisterStatus('保存登录信息失败: ' + chrome.runtime.lastError.message, 'error');
        } else {
          showRegisterStatus('注册并登录成功，令牌已保存', 'success');
          // 更新UI状态
          loginBtn.textContent = '已登录';
          loginBtn.style.backgroundColor = '#00994d';
          logoutBtn.style.display = 'inline-block';
          setTimeout(() => { registerModal.style.display = 'none'; }, 1200);
          // 通知popup页面刷新API配置
          chrome.runtime.sendMessage({ action: 'refreshApiConfig' });
        }
      });
    } catch (e) {
      showRegisterStatus(e.message || '动态码验证异常', 'error');
    }
  });
  
  // 显示状态消息
  function showStatus(message, type) {
    statusEl.textContent = message;
    statusEl.className = 'status ' + type;
    statusEl.style.display = 'block';
    
    // 3秒后自动隐藏
    setTimeout(function() {
      statusEl.style.display = 'none';
    }, 3000);
  }

  function showRegisterStatus(message, type) {
    registerStatus.textContent = message;
    registerStatus.className = 'status ' + type;
    registerStatus.style.display = 'block';
    setTimeout(function() {
      if (type === 'success') registerStatus.style.display = 'none';
    }, 3000);
  }
});