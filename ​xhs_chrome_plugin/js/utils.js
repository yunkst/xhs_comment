// 工具函数模块

// 从URL中提取用户ID
function extractUserIdFromUrl(url) {
  if (!url) return '';
  
  try {
    const match = url.match(/\/profile\/([^?]+)/);
    return match ? match[1] : '';
  } catch (error) {
    return '';
  }
}

// 从图片URL中提取笔记信息
function extractNoteInfo(imageUrl) {
  if (!imageUrl) return null;
  
  try {
    // 从图片URL中提取笔记ID
    const match = imageUrl.match(/\/([^/]+)\.(jpg|jpeg|png|webp)/);
    const noteId = match ? match[1] : '';
    
    return noteId ? { noteId } : null;
  } catch (error) {
    return null;
  }
}

// 提取元素的文本内容（包括emoji）
function extractTextContent(element) {
  if (!element) return '';
  
  // 克隆节点以避免修改原始DOM
  const clone = element.cloneNode(true);
  
  // 处理emoji图片
  const emojiImgs = clone.querySelectorAll('img.note-content-emoji');
  emojiImgs.forEach(img => {
    // 替换emoji图片为[emoji]标记
    img.replaceWith('[emoji]');
  });
  
  return clone.textContent.trim();
}

// Toast通知组件
const toastManager = (function() {
  // 创建Toast容器（如果尚不存在）
  function ensureToastContainer() {
    if (!document.querySelector('.xhs-plugin-toast-container')) {
      const toastContainer = document.createElement('div');
      toastContainer.className = 'xhs-plugin-toast-container';
      toastContainer.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 10000;
        width: 90%;
        max-width: 280px;
      `;
      document.body.appendChild(toastContainer);
      
      // 添加Toast样式
      const style = document.createElement('style');
      style.textContent = `
        .xhs-plugin-toast {
          padding: 10px 15px;
          margin-bottom: 10px;
          border-radius: 4px;
          font-size: 14px;
          text-align: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          animation: xhs-plugin-fadeInOut 3s ease forwards;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .xhs-plugin-toast.success {
          background-color: #00994d;
          color: white;
        }
        .xhs-plugin-toast.error {
          background-color: #ff3b30;
          color: white;
        }
        .xhs-plugin-toast.info {
          background-color: #0084ff;
          color: white;
        }
        @keyframes xhs-plugin-fadeInOut {
          0% { opacity: 0; transform: translateY(20px); }
          10% { opacity: 1; transform: translateY(0); }
          80% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-20px); }
        }
      `;
      document.head.appendChild(style);
    }
    return document.querySelector('.xhs-plugin-toast-container');
  }

  // 显示Toast通知
  function showToast(message, type = 'info') {
    const container = ensureToastContainer();
    
    const toast = document.createElement('div');
    toast.className = `xhs-plugin-toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // 3秒后自动移除
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  return {
    success: (msg) => showToast(msg, 'success'),
    error: (msg) => showToast(msg, 'error'),
    info: (msg) => showToast(msg, 'info')
  };
})();

// 导出对象
window.xhsUtils = {
  extractUserIdFromUrl,
  extractTextContent,
  extractNoteInfo,
  toastManager
}; 