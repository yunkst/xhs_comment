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
  // 如果没有图片URL，返回空对象
  if (!imageUrl) return {};
  
  // 尝试从URL中提取笔记ID等信息
  try {
    // 这里是一个示例，实际提取逻辑可能需要根据小红书的具体URL格式调整
    const noteIdMatch = imageUrl.match(/\/([^\/]+)$/);
    const noteId = noteIdMatch ? noteIdMatch[1] : '';
    
    return {
      id: noteId,
      url: '' // 由于图片URL不一定包含笔记URL，可能需要其他方式获取
    };
  } catch (error) {
    return {};
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

// 导出函数
window.xhsUtils = {
  extractUserIdFromUrl,
  extractNoteInfo,
  extractTextContent
}; 