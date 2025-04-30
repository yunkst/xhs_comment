import re
from datetime import datetime, timedelta
import logging
from typing import List, Dict, Any, Optional

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Helper Functions ---

def parse_author_id(author_url: Optional[str]) -> Optional[str]:
    """从用户主页URL中解析用户ID"""
    if not author_url:
        return None
    # 匹配 /user/profile/ 后面的ID部分
    match = re.search(r'/user/profile/([^/?]+)', author_url)
    if match:
        return match.group(1)
    logger.warning(f"无法从URL解析authorId: {author_url}")
    return None

def parse_relative_timestamp(timestamp_str: Optional[str]) -> Optional[datetime]:
    """将小红书的相对时间字符串转换为datetime对象"""
    if not timestamp_str:
        return None

    # 清理字符串，去除可能的前后空格
    timestamp_str = timestamp_str.strip()
    
    # 处理"N 天前 地区"格式（笔记中的发布时间）
    # 例如："3 天前 浙江"
    location_match = re.match(r'(\d+)\s*天前\s+.*', timestamp_str)
    if location_match:
        days_ago = int(location_match.group(1))
        return datetime.now() - timedelta(days=days_ago)

    now = datetime.now()
    try:
        # 格式: YYYY-MM-DD (例如: 2023-01-10)
        if re.match(r'^\d{4}-\d{1,2}-\d{1,2}$', timestamp_str):
            year, month, day = map(int, timestamp_str.split('-'))
            return datetime(year, month, day)
        
        # 格式: YYYY年MM月DD日 (例如: 2023年1月10日)
        match = re.match(r'(\d{4})年(\d{1,2})月(\d{1,2})日', timestamp_str)
        if match:
            year, month, day = map(int, match.groups())
            return datetime(year, month, day)
        
        # 格式: MM-DD (例如: 01-14)
        if re.match(r'^\d{1,2}-\d{1,2}$', timestamp_str):
            parts = timestamp_str.split('-')
            if len(parts) == 2:
                month, day = map(int, parts)
                # 假设是今年，如果计算出的日期在未来，则认为是去年
                parsed_dt = datetime(now.year, month, day)
                if parsed_dt > now:
                    parsed_dt = datetime(now.year - 1, month, day)
                return parsed_dt
        
        # 格式: 昨天 HH:MM (例如: 昨天 14:09)
        match = re.match(r'昨天\s+(\d{1,2}):(\d{2})', timestamp_str)
        if match:
            hour, minute = map(int, match.groups())
            yesterday = now - timedelta(days=1)
            return yesterday.replace(hour=hour, minute=minute, second=0, microsecond=0)
        
        # 格式: N天前 (例如: 4天前)
        match = re.match(r'(\d+)\s*天前$', timestamp_str)
        if match:
            days_ago = int(match.group(1))
            return now - timedelta(days=days_ago)
            
        # 格式: N小时前
        match = re.match(r'(\d+)\s*小时前', timestamp_str)
        if match:
            hours_ago = int(match.group(1))
            return now - timedelta(hours=hours_ago)

        # 格式: N分钟前
        match = re.match(r'(\d+)\s*分钟前', timestamp_str)
        if match:
            minutes_ago = int(match.group(1))
            return now - timedelta(minutes=minutes_ago)
            
        # 尝试直接解析日期时间格式 (例如: YYYY-MM-DD HH:MM:SS)
        try:
            return datetime.fromisoformat(timestamp_str)
        except ValueError:
            pass
            
        # 无法识别的格式
        logger.warning(f"无法解析的时间戳格式: {timestamp_str}")
        return None

    except Exception as e:
        logger.error(f"解析时间戳 '{timestamp_str}' 时出错: {e}", exc_info=True)
        return None

# --- Transformation Logic ---

def transform_raw_comments_to_structured(raw_comments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """将原始嵌套评论列表转换为扁平化的结构化评论列表"""
    structured_comments_flat = []
    
    def _process_comment_recursive(comment_dict: Dict[str, Any], parent_comment_id: Optional[str] = None, reply_order: Optional[int] = None, sibling_comments: List[Dict[str, Any]] = []):
        """递归处理单个评论及其回复"""
        if not comment_dict or not comment_dict.get('id'):
            logger.warning(f"跳过无效评论数据：{str(comment_dict)[:100]}")
            return

        comment_id = comment_dict['id']
        replied_to_user = comment_dict.get('repliedToUser')
        calculated_replied_id = None

        if parent_comment_id is not None: # 这是一个子评论
            if replied_to_user:
                # 查找被回复用户的评论ID
                # 从当前子评论往前找兄弟评论
                found_reply_target = False
                for i in range(reply_order - 1, -1, -1):
                    prev_sibling = sibling_comments[i]
                    if prev_sibling.get('authorName') == replied_to_user:
                        calculated_replied_id = prev_sibling.get('id')
                        found_reply_target = True
                        break
                if not found_reply_target:
                    # 如果在兄弟中没找到，认为是回复父评论
                    calculated_replied_id = parent_comment_id
            else:
                # 如果没有指定回复用户，认为是回复父评论
                calculated_replied_id = parent_comment_id
        
        # 创建结构化评论对象
        structured_comment = {
            "commentId": comment_id,
            "noteId": comment_dict.get("noteId"),
            "content": comment_dict.get("content"),
            "authorId": parse_author_id(comment_dict.get("authorUrl")),
            "authorName": comment_dict.get("authorName"),
            "authorAvatar": comment_dict.get("authorAvatar"),
            "timestamp": parse_relative_timestamp(comment_dict.get("timestamp")),
            "repliedId": calculated_replied_id,
            "repliedOrder": reply_order,
            "fetchTimestamp": datetime.utcnow() # 使用当前时间
            # 可以在这里添加 likeCount, ipLocation 如果需要
            # "likeCount": comment_dict.get("likeCount"),
            # "ipLocation": comment_dict.get("ipLocation")
        }
        structured_comments_flat.append(structured_comment)

        # 递归处理子评论
        replies = comment_dict.get("replies", [])
        for index, reply_dict in enumerate(replies):
            _process_comment_recursive(reply_dict, parent_comment_id=comment_id, reply_order=index, sibling_comments=replies)

    # --- 开始处理顶级评论 ---
    for raw_comment in raw_comments:
        _process_comment_recursive(raw_comment)
        
    return structured_comments_flat 