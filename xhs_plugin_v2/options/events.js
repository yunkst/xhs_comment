import { elements } from './state.js';
import { saveApiConfig, testApiConnection, login, logout, saveConfig, loadConfig } from './actions.js';
import { toggleOtpInput } from './ui.js';

/**
 * 设置所有事件监听器
 */
export function setupEventListeners() {
    // API 配置
    elements.saveApiConfigBtn.addEventListener('click', saveApiConfig);
    elements.testApiConnectionBtn.addEventListener('click', testApiConnection);
    elements.testApiConnectionBtn.dataset.originalText = elements.testApiConnectionBtn.innerHTML;

    // 登录/登出
    elements.loginBtn.addEventListener('click', (e) => {
        console.log('登录按钮被点击');
        e.preventDefault();
        login();
    });
    elements.loginBtn.dataset.originalText = elements.loginBtn.innerHTML;
    elements.logoutBtn.addEventListener('click', logout);

    // 在输入框中按回车键登录
    [elements.usernameInput, elements.passwordInput, elements.otpInput].forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                login();
            }
        });
    });

    // OTP 复选框
    elements.useOtpCheckbox.addEventListener('change', (e) => {
        toggleOtpInput(e.target.checked);
    });

    // 监控配置
    elements.saveBtn.addEventListener('click', saveConfig);
    elements.resetBtn.addEventListener('click', () => {
        if (confirm('确定要恢复默认配置吗？')) {
            // 这里可以实现一个恢复默认的 action
            console.log('Reset to default clicked');
            // resetToDefault();
        }
    });

    // 导入/导出
    elements.exportConfigBtn.addEventListener('click', () => console.log('Export clicked'));
    elements.importConfigBtn.addEventListener('click', () => elements.importFileInput.click());
    elements.importFileInput.addEventListener('change', () => console.log('Import file selected'));
} 