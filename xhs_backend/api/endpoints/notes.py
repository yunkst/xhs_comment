from fastapi import APIRouter, HTTPException, Depends, status, Body, Query, Request
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime

from database import (
    save_notes,
    NOTES_COLLECTION,
    get_database
)
from api.deps import get_current_user, get_current_user_combined, get_pagination, PaginationParams
from models import IncomingPayload

# 配置日志
logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter()

@router.get("", response_model=Dict[str, Any])
async def get_notes(
    noteId: Optional[str] = None,
    authorName: Optional[str] = None,
    keyword: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    pagination: PaginationParams = Depends(get_pagination),
    request: Request = None,
    current_user: str = Depends(get_current_user_combined)
):
    """
    获取笔记列表，支持多种过滤条件
    
    Args:
        noteId: 笔记ID
        authorName: 作者名称
        keyword: 关键词（笔记内容）
        startDate: 开始日期
        endDate: 结束日期
        pagination: 分页参数
        request: 请求对象
        current_user: 当前用户
        
    Returns:
        笔记列表和总数
    """
    # 构建查询条件
    query = {}
    
    if noteId:
        query["note_id"] = noteId
    
    if authorName:
        query["user.nickname"] = {"$regex": authorName, "$options": "i"}
    
    if keyword:
        query["title"] = {"$regex": keyword, "$options": "i"}
    
    # 处理日期范围
    date_query = {}
    if startDate:
        date_query["$gte"] = datetime.strptime(startDate, "%Y-%m-%d")
    if endDate:
        date_query["$lte"] = datetime.strptime(endDate, "%Y-%m-%d")
    if date_query:
        query["display_time"] = date_query
    
    # 获取数据库集合
    db = await get_database()
    notes_collection = db[NOTES_COLLECTION]
    
    # 获取总数
    total = await notes_collection.count_documents(query)
    
    # 获取笔记列表
    notes = await notes_collection.find(query) \
        .sort("display_time", -1) \
        .skip(pagination.skip) \
        .limit(pagination.limit) \
        .to_list(length=pagination.limit)
    
    # 处理结果（特别是将_id转换为字符串）
    for note in notes:
        if '_id' in note:
            note['_id'] = str(note['_id'])
    
    return {
        "items": notes,
        "total": total,
        "page": pagination.page,
        "page_size": pagination.page_size
    }

@router.get("/{note_id}", response_model=Dict[str, Any])
async def get_note_by_id(
    note_id: str,
    request: Request = None,
    current_user: str = Depends(get_current_user_combined)
):
    """
    根据ID获取笔记详情
    
    Args:
        note_id: 笔记ID
        request: 请求对象
        current_user: 当前用户
        
    Returns:
        笔记详情
    """
    # 获取数据库集合
    db = await get_database()
    notes_collection = db[NOTES_COLLECTION]
    
    # 查询笔记
    note = await notes_collection.find_one({"note_id": note_id})
    
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")
    
    # 处理结果
    if '_id' in note:
        note['_id'] = str(note['_id'])
    
    return note

@router.post("/data", tags=["数据接收"], status_code=status.HTTP_201_CREATED)
async def receive_notes_data(
    payload: IncomingPayload,
    request: Request = None,
    current_user: str = Depends(get_current_user_combined)
) -> Dict[str, Any]:
    """
    接收笔记数据
    
    Args:
        payload: 包含笔记数据的有效载荷
        request: 请求对象
        current_user: 当前用户
        
    Returns:
        保存结果
    """
    if payload.type != "笔记":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的数据类型，期望类型为'笔记'"
        )
    
    logger.info(f"接收到类型为 '笔记' 的数据，共 {len(payload.data)} 条")
    
    try:
        # 保存笔记数据
        logger.info("开始保存笔记数据...")
        result = await save_notes(payload.data)
        inserted = result.get('inserted', 0)
        updated = result.get('updated', 0)
        logger.info(f"笔记数据保存完成 - 插入: {inserted}, 更新: {updated}")
        
        message = f"成功保存 {inserted + updated} 条笔记数据 (插入: {inserted}, 更新: {updated})"
        return {
            "message": message,
            "inserted": inserted,
            "updated": updated
        }
    except Exception as e:
        logger.exception(f"保存笔记数据时发生错误")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"保存笔记数据时出错: {str(e)}"
        )
