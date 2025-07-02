"""
通知服务模块

提供通知数据处理、保存和查询的业务逻辑
"""
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
from api.models.common import UserInfo # 假设 UserInfo 在这里或 common.py 中定义
from pydantic import BaseModel # 确保 BaseModel 已导入

# 配置日志
logger = logging.getLogger(__name__)

# --- 用户备注相关功能 ---
async def save_user_note(user_id: str, notification_hash: str, note_content: str, content: Optional[str] = None, editor: Optional[str] = None):
    """保存或更新用户备注，并自动关联相应的评论ID"""
    # 在函数内部导入模块
    from database import get_database, USER_NOTES_COLLECTION, STRUCTURED_COMMENTS_COLLECTION
    
    if not user_id or not notification_hash:
        logger.error("保存备注时缺少用户ID或通知哈希")
        return None
    
    database = await get_database()
    collection = database[USER_NOTES_COLLECTION]
    
    # 检查是否已存在记录，如果已有commentId则不重新计算
    existing_note = await collection.find_one(
        {"userId": user_id, "notificationHash": notification_hash}
    )
    
    comment_id = None
    if existing_note and existing_note.get("commentId"):
        # 如果已经有commentId，就不重新计算
        comment_id = existing_note.get("commentId")
        logger.info(f"使用已存在的commentId: {comment_id} for user {user_id}")
    else:
        # 查找关联的评论ID
        comment_id = await find_related_comment_id(database, user_id, content)
    
    # 构建备注数据
    note_data = {
        "userId": user_id,
        "notificationHash": notification_hash,
        "noteContent": note_content,
        "updatedAt": datetime.utcnow()
    }
    
    if content:
        note_data["content"] = content
    if editor:
        note_data["editor"] = editor
    if comment_id:
        note_data["commentId"] = comment_id
        logger.info(f"设置关联评论ID: {comment_id} for user {user_id}")
    
    # 更新或插入备注
    result = await collection.update_one(
        {"userId": user_id, "notificationHash": notification_hash},
        {"$set": note_data},
        upsert=True
    )
    
    if result.upserted_id or result.modified_count > 0:
        logger.info(f"成功保存/更新用户备注: userId={user_id}, hash={notification_hash}, commentId={comment_id}")
        return note_data
    else:
        logger.warning(f"备注数据未变化: userId={user_id}, hash={notification_hash}")
        return note_data

def calculate_content_similarity(content1: str, content2: str) -> float:
    """计算两个文本内容的相似度，返回0-1之间的值"""
    if not content1 or not content2:
        return 0.0
    
    # 完全相同的话返回1.0
    if content1 == content2:
        return 1.0
    
    # 使用编辑距离算法计算相似度
    def levenshtein_distance(s1: str, s2: str) -> int:
        """计算两个字符串的编辑距离"""
        if len(s1) < len(s2):
            return levenshtein_distance(s2, s1)
        
        if len(s2) == 0:
            return len(s1)
        
        previous_row = range(len(s2) + 1)
        for i, c1 in enumerate(s1):
            current_row = [i + 1]
            for j, c2 in enumerate(s2):
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (c1 != c2)
                current_row.append(min(insertions, deletions, substitutions))
            previous_row = current_row
        
        return previous_row[-1]
    
    # 计算编辑距离
    distance = levenshtein_distance(content1.lower(), content2.lower())
    max_len = max(len(content1), len(content2))
    
    if max_len == 0:
        return 1.0
    
    # 转换为相似度 (1 - 归一化后的距离)
    similarity = 1.0 - (distance / max_len)
    return max(0.0, similarity)

async def find_related_comment_id(database, user_id: str, content: Optional[str]) -> Optional[str]:
    """通过用户ID和内容查找关联的评论ID"""
    from database import STRUCTURED_COMMENTS_COLLECTION
    
    if not user_id:
        return None
    
    structured_comments_collection = database[STRUCTURED_COMMENTS_COLLECTION]
    
    # 首先通过用户ID查找评论
    user_comments = await structured_comments_collection.find(
        {"authorId": user_id}
    ).to_list(length=None)
    
    if not user_comments:
        logger.info(f"未找到用户 {user_id} 的任何评论，不进行匹配")
        return None
    
    logger.info(f"找到用户 {user_id} 的 {len(user_comments)} 条评论")
    
    # 如果有content，尝试通过内容匹配找到最准确的评论
    if content:
        from .comment import clean_content
        cleaned_target_content = clean_content(content)
        
        if cleaned_target_content:
            # 首先尝试完全匹配
            for comment in user_comments:
                comment_content = comment.get('content', '')
                cleaned_comment_content = clean_content(comment_content)
                
                if cleaned_comment_content == cleaned_target_content:
                    logger.info(f"通过内容完全匹配找到评论: {comment.get('commentId')} for user {user_id}")
                    return comment.get('commentId')
            
            # 如果没有完全匹配，使用相似度匹配
            best_match = None
            best_similarity = 0.0
            similarity_threshold = 0.3  # 相似度阈值
            
            for comment in user_comments:
                comment_content = comment.get('content', '')
                cleaned_comment_content = clean_content(comment_content)
                
                similarity = calculate_content_similarity(cleaned_target_content, cleaned_comment_content)
                
                if similarity > best_similarity and similarity >= similarity_threshold:
                    best_similarity = similarity
                    best_match = comment
            
            if best_match:
                logger.info(f"通过内容相似度匹配找到评论: {best_match.get('commentId')} for user {user_id}, 相似度: {best_similarity:.2f}")
                return best_match.get('commentId')
            else:
                logger.info(f"没有找到相似度大于 {similarity_threshold} 的评论内容，不进行匹配")
                return None
    
    # 如果没有提供content，不进行任何匹配
    logger.info(f"未提供content内容，不进行评论匹配")
    return None

async def get_user_notes(user_id: str):
    """获取用户的所有备注"""
    # 在函数内部导入模块
    from database import get_database, USER_NOTES_COLLECTION
    
    if not user_id:
        logger.error("获取备注时缺少用户ID")
        return []
    
    database = await get_database()
    collection = database[USER_NOTES_COLLECTION]
    
    user_notes = await collection.find({"userId": user_id}).to_list(length=None)
    logger.info(f"获取到用户 {user_id} 的 {len(user_notes)} 条备注")
    
    # 处理结果
    for note in user_notes:
        if '_id' in note:
            note['_id'] = str(note['_id'])
        if 'updatedAt' in note and isinstance(note['updatedAt'], datetime):
            note['updatedAt'] = note['updatedAt'].isoformat()
    
    return user_notes 