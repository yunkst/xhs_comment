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
    """保存或更新用户备注"""
    # 在函数内部导入模块
    from database import get_database, USER_NOTES_COLLECTION
    
    if not user_id or not notification_hash:
        logger.error("保存备注时缺少用户ID或通知哈希")
        return None
    
    database = await get_database()
    collection = database[USER_NOTES_COLLECTION]
    
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
    
    # 更新或插入备注
    result = await collection.update_one(
        {"userId": user_id, "notificationHash": notification_hash},
        {"$set": note_data},
        upsert=True
    )
    
    if result.upserted_id or result.modified_count > 0:
        logger.info(f"成功保存/更新用户备注: userId={user_id}, hash={notification_hash}")
        return note_data
    else:
        logger.warning(f"备注数据未变化: userId={user_id}, hash={notification_hash}")
        return note_data

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