"""
笔记服务模块

提供笔记数据处理、保存和查询的业务逻辑
"""
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

# 配置日志
logger = logging.getLogger(__name__)

async def save_notes(data: List[Dict[str, Any]]):
    """保存笔记列表，如果笔记已存在则更新"""
    # 在函数内部导入模块
    from database import get_database, NOTES_COLLECTION
    
    if not data:
        logger.info("没有笔记数据需要保存")
        return {"inserted": 0, "updated": 0}

    database = await get_database()
    collection = database[NOTES_COLLECTION]
    inserted_count = 0
    updated_count = 0

    for note_data in data:
        note_id = note_data.get("noteId")

        if not note_id:
            logger.warning(f"跳过笔记，缺少 noteId: {note_data.get('noteContent', '')[:50]}...")
            continue

        try:
            # 确保 fetchTimestamp 字段存在且是 datetime 类型
            if 'fetchTimestamp' not in note_data or not isinstance(note_data['fetchTimestamp'], datetime):
                note_data['fetchTimestamp'] = datetime.utcnow()
            
            # 处理 publishTime 字段，将其转换为 datetime 类型
            if 'publishTime' in note_data and note_data['publishTime']:
                # 使用 parse_relative_timestamp 函数解析发布时间
                try:
                    from utils.time_utils import parse_relative_timestamp  # 假设有此工具函数
                    
                    publish_time_str = note_data['publishTime']
                    parsed_publish_time = parse_relative_timestamp(publish_time_str)
                    
                    if parsed_publish_time:
                        note_data['publishTime'] = parsed_publish_time
                    else:
                        logger.warning(f"无法解析笔记发布时间: {publish_time_str}，维持原始值")
                except ImportError:
                    logger.warning("时间解析工具不可用，保留原始发布时间")
                
            # 尝试查找已存在的笔记
            existing_note = await collection.find_one({"noteId": note_id})

            if existing_note:
                # 更新现有笔记
                result = await collection.replace_one({"_id": existing_note["_id"]}, note_data)
                if result.modified_count > 0:
                    updated_count += 1
                    logger.debug(f"更新笔记: noteId={note_id}")
                else:
                    logger.warning(f"尝试更新笔记但 modified_count 为 0: noteId={note_id}")
            else:
                # 插入新笔记
                result = await collection.insert_one(note_data)
                if result.inserted_id:
                    inserted_count += 1
                    logger.debug(f"插入新笔记: noteId={note_id}")
                else:
                    logger.warning(f"尝试插入新笔记但未获取 inserted_id: noteId={note_id}")

        except Exception as e:
            logger.error(f"处理笔记 noteId={note_id} 时出错: {e}")
            # 继续处理下一个

    logger.info(f"笔记保存/更新完成。插入: {inserted_count}, 更新: {updated_count}")
    return {"inserted": inserted_count, "updated": updated_count}

async def get_note_by_id(note_id: str) -> Optional[Dict[str, Any]]:
    """根据ID获取笔记详情"""
    # 在函数内部导入模块
    from database import get_database, NOTES_COLLECTION
    
    if not note_id:
        return None
        
    database = await get_database()
    note = await database[NOTES_COLLECTION].find_one({"noteId": note_id})
    
    # 处理结果
    if note and '_id' in note:
        note['_id'] = str(note['_id'])
        
    return note

async def search_notes(
    noteId: Optional[str] = None,
    authorName: Optional[str] = None,
    keyword: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    page: int = 1,
    page_size: int = 10
) -> Dict[str, Any]:
    """搜索笔记，支持多种过滤条件"""
    # 在函数内部导入模块
    from database import get_database, NOTES_COLLECTION
    
    database = await get_database()
    collection = database[NOTES_COLLECTION]
    
    # 构建查询条件
    query = {}
    
    if noteId:
        query["noteId"] = noteId
    
    if authorName:
        query["user.nickname"] = {"$regex": authorName, "$options": "i"}
    
    if keyword:
        query["$or"] = [
            {"title": {"$regex": keyword, "$options": "i"}},
            {"noteContent": {"$regex": keyword, "$options": "i"}}
        ]
    
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
        query["publishTime"] = date_query
    
    # 计算分页参数
    skip = (page - 1) * page_size
    
    # 获取总数
    total = await collection.count_documents(query)
    
    # 获取笔记列表
    cursor = collection.find(query).sort("publishTime", -1).skip(skip).limit(page_size)
    notes = await cursor.to_list(length=page_size)
    
    # 处理结果（特别是将_id转换为字符串）
    for note in notes:
        if '_id' in note:
            note['_id'] = str(note['_id'])
        # 处理日期字段为ISO格式
        if 'publishTime' in note and isinstance(note['publishTime'], datetime):
            note['publishTime'] = note['publishTime'].isoformat()
        if 'fetchTimestamp' in note and isinstance(note['fetchTimestamp'], datetime):
            note['fetchTimestamp'] = note['fetchTimestamp'].isoformat()
    
    return {
        "items": notes,
        "total": total,
        "page": page,
        "page_size": page_size
    } 