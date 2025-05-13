// 笔记提取相关模块

// 从页面DOM中提取笔记内容
function extractNoteContentFromDOM() {
  try {
    // 提取笔记ID
    let noteId = null;
    
    // 优先从URL中提取
    const urlMatch = window.location.href.match(/\/explore\/([^/?]+)/);
    if (urlMatch && urlMatch[1]) {
      noteId = urlMatch[1];
      console.log(`从URL中提取到笔记ID: ${noteId}`);
    } else {
      // 尝试从页面元素中提取
      const noteElement = document.querySelector('[note-id], #noteContainer, .note-detail'); 
      if (noteElement && noteElement.getAttribute('note-id')) {
        noteId = noteElement.getAttribute('note-id');
        console.log(`从元素属性中提取到笔记ID: ${noteId}`);
      } else {
        console.warn("无法从页面中提取笔记ID");
      }
    }
    
    // 提取笔记标题和内容 - 更新标题选择器
    const titleElement = document.querySelector('#detail-title, .title, [id="detail-title"]');
    const descElement = document.querySelector('#detail-desc, .desc .note-text');
    
    // 提取作者信息
    const authorElement = document.querySelector('.author-wrapper .info .name');
    const authorId = authorElement ? extractUserIdFromAuthorLink(authorElement.href) : null;
    
    // 提取发布时间
    const dateElement = document.querySelector('.bottom-container .date, .date');
    const publishTime = dateElement ? dateElement.textContent.trim() : '';
    
    // 提取交互数据（点赞数、评论数）- 更新点赞选择器
    let likeCount = 0;
    // 尝试多种可能的选择器来获取点赞数
    const likeSelectors = [
      '.engage-bar-container .like-wrapper .count',
      '.engage-bar .left .like-wrapper .count',
      '.engage-bar .buttons .left .like-wrapper .count',
      '.like-active .count',
      '.xg-v2-collect [data-type="like"] .count',
      '.like-wrapper .count',
      '[class*="like-wrapper"] .count'
    ];
    
    for (const selector of likeSelectors) {
      const likeElement = document.querySelector(selector);
      if (likeElement) {
        likeCount = parseInteractionCount(likeElement.textContent.trim());
        console.log(`通过选择器 ${selector} 获取到点赞数: ${likeCount}`);
        break;
      }
    }
    
    let commentCount = 0;
    const commentsElement = document.querySelector('.comments-container .total, .comments-container .comment-title .count');
    if (commentsElement) {
      const commentText = commentsElement.textContent.trim();
      const commentMatch = commentText.match(/共\s*(\d+)\s*条评论/);
      if (commentMatch && commentMatch[1]) {
        commentCount = parseInt(commentMatch[1], 10);
      }
    }
    
    // 构建笔记内容对象
    const noteContent = {
      noteId: noteId,
      noteContent: descElement ? extractTextContentWithTags(descElement) : '',
      noteLike: likeCount,
      noteCommitCount: commentCount,
      publishTime: publishTime,
      authorId: authorId,
      title: titleElement ? titleElement.textContent.trim() : ''
    };
    
    console.log('提取的笔记内容:', noteContent);
    return noteContent;
  } catch (error) {
    console.error('提取笔记内容出错:', error);
    return null;
  }
}

// 从作者链接中提取用户ID
function extractUserIdFromAuthorLink(url) {
  if (!url) return null;
  
  try {
    const match = url.match(/\/user\/profile\/([^/?]+)/);
    return match ? match[1] : null;
  } catch (error) {
    console.error('从作者链接提取ID出错:', error);
    return null;
  }
}

// 解析交互数量（处理单位 如"1.2k"）
function parseInteractionCount(countText) {
  if (!countText) return 0;
  
  try {
    if (countText.includes('k') || countText.includes('K')) {
      return Math.round(parseFloat(countText.replace(/[kK]/g, '')) * 1000);
    } else if (countText.includes('w') || countText.includes('W')) {
      return Math.round(parseFloat(countText.replace(/[wW]/g, '')) * 10000);
    } else {
      return parseInt(countText, 10) || 0;
    }
  } catch (error) {
    console.error('解析交互数量出错:', error);
    return 0;
  }
}

// 提取包含标签的文本内容
function extractTextContentWithTags(element) {
  if (!element) return '';
  
  try {
    // 克隆节点以避免修改原始DOM
    const clone = element.cloneNode(true);
    
    // 处理emoji图片
    const emojiImgs = clone.querySelectorAll('img.note-content-emoji');
    emojiImgs.forEach(img => {
      img.replaceWith('[emoji]');
    });
    
    // 提取标签文本
    const tags = Array.from(clone.querySelectorAll('.tag')).map(tag => tag.textContent.trim());
    
    // 获取主要文本内容
    const mainText = clone.textContent.trim();
    
    return mainText;
  } catch (error) {
    console.error('提取文本内容出错:', error);
    return '';
  }
}

// 导出函数
window.xhsNoteExtractor = {
  extractNoteContentFromDOM,
  extractUserIdFromAuthorLink,
  parseInteractionCount,
  extractTextContentWithTags
}; 