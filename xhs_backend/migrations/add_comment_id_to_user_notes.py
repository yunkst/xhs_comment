#!/usr/bin/env python3
"""
数据库迁移脚本：为 user_notes 集合添加 commentId 字段

此脚本会：
1. 查找所有现有的 user_notes 记录
2. 通过用户ID和content匹配structured_comments中的评论
3. 为匹配的记录添加commentId字段

使用方法：
python add_comment_id_to_user_notes.py
"""

import asyncio
import logging
from datetime import datetime
from typing import Optional
import sys
import os

# 添加项目根目录到 Python 路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_database, USER_NOTES_COLLECTION, STRUCTURED_COMMENTS_COLLECTION

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def clean_content(content: str) -> str:
    """清理内容，移除多余的空白字符和特殊字符，用于内容匹配"""
    if not content:
        return ""
    
    # 移除多余的空白字符
    cleaned = " ".join(content.split())
    
    # 移除一些常见的特殊字符和符号
    cleaned = cleaned.replace("【", "").replace("】", "")
    cleaned = cleaned.replace("[", "").replace("]", "")
    cleaned = cleaned.replace("（", "").replace("）", "")
    cleaned = cleaned.replace("(", "").replace(")", "")
    
    return cleaned.strip()

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

async def find_comment_id_for_user_note(database, user_id: str, content: Optional[str]) -> Optional[str]:
    """通过用户ID和内容查找关联的评论ID"""
    if not user_id:
        return None
    
    structured_comments_collection = database[STRUCTURED_COMMENTS_COLLECTION]
    
    # 首先通过用户ID查找评论
    user_comments = await structured_comments_collection.find(
        {"authorId": user_id}
    ).to_list(length=None)
    
    if not user_comments:
        logger.debug(f"未找到用户 {user_id} 的任何评论，不进行匹配")
        return None
    
    logger.debug(f"找到用户 {user_id} 的 {len(user_comments)} 条评论")
    
    # 如果有content，尝试通过内容匹配找到最准确的评论
    if content:
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
                logger.debug(f"没有找到相似度大于 {similarity_threshold} 的评论内容，不进行匹配")
                return None
    
    # 如果没有提供content，不进行任何匹配
    logger.debug(f"未提供content内容，不进行评论匹配")
    return None

async def migrate_user_notes():
    """为现有的user_notes记录添加commentId字段"""
    try:
        database = await get_database()
        user_notes_collection = database[USER_NOTES_COLLECTION]
        
        # 查找所有没有commentId字段的user_notes记录
        query = {"commentId": {"$exists": False}}
        user_notes = await user_notes_collection.find(query).to_list(length=None)
        
        logger.info(f"找到 {len(user_notes)} 条需要迁移的用户备注记录")
        
        if not user_notes:
            logger.info("没有需要迁移的记录")
            return
        
        updated_count = 0
        matched_count = 0
        
        for note in user_notes:
            user_id = note.get('userId')
            content = note.get('content')
            notification_hash = note.get('notificationHash')
            
            if not user_id:
                logger.warning(f"跳过没有userId的记录: {note.get('_id')}")
                continue
            
            # 确认记录确实没有commentId（双重检查）
            if note.get('commentId'):
                logger.info(f"记录 {note.get('_id')} 已有commentId: {note.get('commentId')}，跳过")
                continue
            
            # 查找关联的评论ID
            comment_id = await find_comment_id_for_user_note(database, user_id, content)
            
            if comment_id:
                # 更新记录，添加commentId字段
                result = await user_notes_collection.update_one(
                    {"_id": note["_id"]},
                    {"$set": {"commentId": comment_id, "updatedAt": datetime.utcnow()}}
                )
                
                if result.modified_count > 0:
                    updated_count += 1
                    matched_count += 1
                    logger.info(f"成功为记录 {note.get('_id')} 添加commentId: {comment_id}")
                else:
                    logger.warning(f"无法更新记录 {note.get('_id')}")
            else:
                logger.info(f"未找到用户 {user_id} 的关联评论，保持commentId为空: {note.get('_id')}")
        
        logger.info(f"迁移完成: 总计 {len(user_notes)} 条记录，成功匹配并更新 {updated_count} 条，找到关联评论 {matched_count} 条")
        
    except Exception as e:
        logger.error(f"迁移过程中发生错误: {e}", exc_info=True)
        raise

async def main():
    """主函数"""
    logger.info("开始执行 user_notes commentId 字段迁移")
    
    try:
        await migrate_user_notes()
        logger.info("迁移任务完成")
    except Exception as e:
        logger.error(f"迁移任务失败: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code) 