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

async def save_notifications(data: List[Dict[str, Any]]):
    """将通知数据列表直接插入到集合中"""
    # 在函数内部导入模块
    from database import get_database, NOTIFICATIONS_COLLECTION
    
    if not data:
        logger.info("没有通知数据需要保存")
        return {"inserted_count": 0}

    database = await get_database()
    collection = database[NOTIFICATIONS_COLLECTION]
    try:
        logger.info(f"向集合 '{NOTIFICATIONS_COLLECTION}' 插入 {len(data)} 条通知记录...")
        result = await collection.insert_many(data)
        inserted_count = len(result.inserted_ids)
        logger.info(f"成功插入 {inserted_count} 条记录到集合 '{NOTIFICATIONS_COLLECTION}'")
        return {"inserted_count": inserted_count}
    except Exception as e:
        logger.error(f"保存通知数据到集合 '{NOTIFICATIONS_COLLECTION}' 时出错: {e}")
        raise

async def search_notifications(
    userId: Optional[str] = None,
    type: Optional[str] = None,
    status: Optional[str] = None,
    keyword: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    page: int = 1,
    page_size: int = 10
) -> Dict[str, Any]:
    """搜索通知，支持多种过滤条件"""
    # 在函数内部导入模块
    from database import get_database, NOTIFICATIONS_COLLECTION
    
    database = await get_database()
    collection = database[NOTIFICATIONS_COLLECTION]
    
    # 构建查询条件
    query = {}
    
    if userId:
        query["userId"] = userId
    
    if type:
        query["type"] = type
    
    if status:
        query["status"] = status
    
    if keyword:
        query["content"] = {"$regex": keyword, "$options": "i"}
    
    # 处理日期范围
    date_query = {}
    if startDate:
        try:
            date_query["$gte"] = datetime.strptime(startDate, "%Y-%m-%d")
        except ValueError:
            logger.warning(f"无效的开始日期格式: {startDate}")
    if endDate:
        try:
            end_date = datetime.strptime(endDate, "%Y-%m-%d")
            end_date = end_date.replace(hour=23, minute=59, second=59)
            date_query["$lte"] = end_date
        except ValueError:
            logger.warning(f"无效的结束日期格式: {endDate}")
    
    if date_query:
        query["timestamp"] = date_query
    
    # 计算分页参数
    skip = (page - 1) * page_size
    
    # 获取总数
    total = await collection.count_documents(query)
    
    # 获取通知列表
    cursor = collection.find(query).sort("timestamp", -1).skip(skip).limit(page_size)
    notifications = await cursor.to_list(length=page_size)
    
    # 处理结果（特别是将_id转换为字符串）
    for notification in notifications:
        if '_id' in notification:
            notification['_id'] = str(notification['_id'])
        # 处理日期字段为ISO格式
        if 'timestamp' in notification and isinstance(notification['timestamp'], datetime):
            notification['timestamp'] = notification['timestamp'].isoformat()
    
    return {
        "items": notifications,
        "total": total,
        "page": page,
        "page_size": page_size
    }

async def get_notification_by_id(notification_id: str) -> Optional[Dict[str, Any]]:
    """根据ID获取通知详情"""
    # 在函数内部导入模块
    from database import get_database, NOTIFICATIONS_COLLECTION
    
    if not notification_id:
        return None
        
    database = await get_database()
    notification = await database[NOTIFICATIONS_COLLECTION].find_one({"_id": notification_id})
    
    # 处理结果
    if notification and '_id' in notification:
        notification['_id'] = str(notification['_id'])
        
    return notification

# --- 用户备注相关功能 ---
async def save_user_note(user_id: str, notification_hash: str, note_content: str, user_info: Optional[UserInfo] = None, content: Optional[str] = None):
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
    
    if user_info:
        note_data["userInfo"] = user_info.dict() if isinstance(user_info, BaseModel) else user_info
    if content:
        note_data["content"] = content
    
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