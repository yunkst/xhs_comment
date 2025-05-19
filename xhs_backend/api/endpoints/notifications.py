from fastapi import APIRouter, HTTPException, Depends, status, Body, Query, Request
from fastapi.responses import JSONResponse
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime
import json

from database import (
    NOTIFICATIONS_COLLECTION,
    get_database
)
from api.deps import get_current_user, get_current_user_combined, get_pagination, PaginationParams
from api.models.common import IncomingPayload
from api.services.notification import save_notifications
# 配置日志
logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter()

@router.get("", response_model=Dict[str, Any])
async def get_notifications(
    userId: Optional[str] = None,
    type: Optional[str] = None,
    status: Optional[str] = None,
    keyword: Optional[str] = None,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    pagination: PaginationParams = Depends(get_pagination),
    request: Request = None,
    current_user: str = Depends(get_current_user_combined)
):
    """
    获取通知列表，支持多种过滤条件
    
    Args:
        userId: 用户ID
        type: 通知类型（如评论、点赞）
        status: 通知状态
        keyword: 关键词（通知内容）
        startDate: 开始日期
        endDate: 结束日期
        pagination: 分页参数
        current_user: 当前用户
        
    Returns:
        通知列表和总数
    """
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
        date_query["$gte"] = datetime.strptime(startDate, "%Y-%m-%d")
    if endDate:
        date_query["$lte"] = datetime.strptime(endDate, "%Y-%m-%d")
    if date_query:
        query["timestamp"] = date_query
    
    # 获取数据库集合
    db = await get_database()
    notifications_collection = db[NOTIFICATIONS_COLLECTION]
    
    # 获取总数
    total = await notifications_collection.count_documents(query)
    
    # 获取通知列表
    notifications = await notifications_collection.find(query) \
        .sort("timestamp", -1) \
        .skip(pagination.skip) \
        .limit(pagination.limit) \
        .to_list(length=pagination.limit)
    
    # 处理结果（特别是将_id转换为字符串）
    for notification in notifications:
        if '_id' in notification:
            notification['_id'] = str(notification['_id'])
    
    return {
        "items": notifications,
        "total": total,
        "page": pagination.page,
        "page_size": pagination.page_size
    }

@router.get("/{notification_id}", response_model=Dict[str, Any])
async def get_notification_by_id(
    notification_id: str,
    request: Request = None,
    current_user: str = Depends(get_current_user_combined)
):
    """
    根据ID获取通知详情
    
    Args:
        notification_id: 通知ID
        current_user: 当前用户
        
    Returns:
        通知详情
    """
    # 获取数据库集合
    db = await get_database()
    notifications_collection = db[NOTIFICATIONS_COLLECTION]
    
    # 查询通知
    notification = await notifications_collection.find_one({"_id": notification_id})
    
    if not notification:
        raise HTTPException(status_code=404, detail="通知不存在")
    
    # 处理结果
    if '_id' in notification:
        notification['_id'] = str(notification['_id'])
    
    return notification

@router.post("/data", tags=["数据接收"], status_code=status.HTTP_201_CREATED)
async def receive_notifications_data(
    payload: IncomingPayload,
    request: Request = None,
    current_user: str = Depends(get_current_user_combined)
) -> Dict[str, Any]:
    """
    接收通知数据
    
    Args:
        payload: 包含通知数据的有效载荷
        current_user: 当前用户
        
    Returns:
        保存结果
    """
    if payload.type != "通知":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的数据类型，期望类型为'通知'"
        )
    
    logger.info(f"接收到类型为 '通知' 的数据，共 {len(payload.data)} 条")
    
    try:
        # 保存通知数据
        result = await save_notifications(payload.data)
        inserted = result.get('inserted_count', 0)
        message = f"成功接收并保存了 {inserted} 条 '通知' 数据"
        logger.info(message)
        return {"message": message, "inserted": inserted}
    except Exception as e:
        logger.exception(f"保存通知数据时发生错误")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"保存通知数据时出错: {str(e)}"
        )
