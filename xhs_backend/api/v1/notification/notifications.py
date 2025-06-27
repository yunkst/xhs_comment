"""
通知管理

通知管理域 - 通知消息的查询、管理和统计功能
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime, timedelta

from database import get_database, NOTIFICATIONS_COLLECTION
from api.deps import get_current_user

# 配置日志
logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter()

@router.get("", summary="查询通知")
async def get_notifications(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    keyword: Optional[str] = Query(None, description="关键字搜索"),
    notification_type: Optional[str] = Query(None, description="通知类型"),
    start_date: Optional[str] = Query(None, description="开始日期 YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="结束日期 YYYY-MM-DD"),
    current_user: str = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    查询通知数据
    
    支持分页、关键字搜索、按类型过滤、按日期范围过滤
    """
    try:
        collection = db[NOTIFICATIONS_COLLECTION]
        
        # 构建查询条件
        query = {}
        
        if keyword:
            query["$or"] = [
                {"content": {"$regex": keyword, "$options": "i"}},
                {"title": {"$regex": keyword, "$options": "i"}},
                {"username": {"$regex": keyword, "$options": "i"}}
            ]
        
        if notification_type:
            query["type"] = notification_type
            
        if start_date and end_date:
            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                end_dt = datetime.strptime(end_date + " 23:59:59", "%Y-%m-%d %H:%M:%S")
                query["timestamp"] = {
                    "$gte": start_dt,
                    "$lte": end_dt
                }
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail="日期格式错误，请使用 YYYY-MM-DD 格式"
                )
        
        # 计算分页
        skip = (page - 1) * page_size
        
        # 查询数据
        cursor = collection.find(query).sort("timestamp", -1).skip(skip).limit(page_size)
        notifications_docs = await cursor.to_list(length=page_size)
        notifications_list = []
        
        for doc in notifications_docs:
            doc['_id'] = str(doc['_id'])
            notifications_list.append(doc)
        
        # 获取总数
        total = await collection.count_documents(query)
        
        return {
            "success": True,
            "data": notifications_list,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
            "message": f"成功获取 {len(notifications_list)} 条通知数据"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("查询通知数据时发生错误")
        raise HTTPException(
            status_code=500,
            detail=f"查询通知数据失败: {str(e)}"
        )

@router.get("/stats", summary="通知统计")
async def get_notifications_stats(
    current_user: str = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    获取通知统计信息
    """
    try:
        collection = db[NOTIFICATIONS_COLLECTION]
        
        # 基础统计
        total_notifications = await collection.count_documents({})
        
        # 时间范围统计
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday_start = today_start - timedelta(days=1)
        week_start = now - timedelta(days=7)
        month_start = now - timedelta(days=30)
        
        today_notifications = await collection.count_documents({"timestamp": {"$gte": today_start}})
        yesterday_notifications = await collection.count_documents({
            "timestamp": {"$gte": yesterday_start, "$lt": today_start}
        })
        week_notifications = await collection.count_documents({"timestamp": {"$gte": week_start}})
        month_notifications = await collection.count_documents({"timestamp": {"$gte": month_start}})
        
        # 按类型统计
        types_pipeline = [
            {"$group": {"_id": "$type", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        types_result = await collection.aggregate(types_pipeline).to_list(length=None)
        types_stats = {item["_id"]: item["count"] for item in types_result}
        
        # 按用户统计 (Top 10)
        users_pipeline = [
            {"$group": {"_id": "$username", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        top_users = await collection.aggregate(users_pipeline).to_list(length=10)
        
        return {
            "success": True,
            "stats": {
                "total": {
                    "notifications": total_notifications
                },
                "period": {
                    "today": today_notifications,
                    "yesterday": yesterday_notifications,
                    "week": week_notifications,
                    "month": month_notifications
                },
                "by_type": types_stats,
                "top_users": [{"username": item["_id"], "count": item["count"]} for item in top_users]
            },
            "timestamp": now.strftime("%Y-%m-%d %H:%M:%S")
        }
        
    except Exception as e:
        logger.exception("获取通知统计时发生错误")
        raise HTTPException(
            status_code=500,
            detail=f"获取通知统计失败: {str(e)}"
        )

@router.get("/types", summary="获取通知类型")
async def get_notification_types(
    current_user: str = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    获取所有通知类型
    """
    try:
        collection = db[NOTIFICATIONS_COLLECTION]
        
        # 获取所有通知类型
        pipeline = [
            {"$group": {"_id": "$type", "count": {"$sum": 1}, "latest": {"$max": "$timestamp"}}},
            {"$sort": {"count": -1}}
        ]
        
        types_result = await collection.aggregate(pipeline).to_list(length=None)
        
        return {
            "success": True,
            "types": [
                {
                    "type": item["_id"],
                    "count": item["count"],
                    "latest": item["latest"]
                }
                for item in types_result
            ],
            "message": f"成功获取 {len(types_result)} 种通知类型"
        }
        
    except Exception as e:
        logger.exception("获取通知类型时发生错误")
        raise HTTPException(
            status_code=500,
            detail=f"获取通知类型失败: {str(e)}"
        )

@router.get("/{notification_id}", summary="获取单条通知")
async def get_notification(
    notification_id: str,
    current_user: str = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    获取单条通知详情
    """
    try:
        from bson import ObjectId
        
        collection = db[NOTIFICATIONS_COLLECTION]
        
        notification = await collection.find_one({"_id": ObjectId(notification_id)})
        
        if not notification:
            raise HTTPException(
                status_code=404,
                detail=f"未找到通知: {notification_id}"
            )
        
        notification['_id'] = str(notification['_id'])
        
        return {
            "success": True,
            "data": notification,
            "message": "成功获取通知详情"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("获取通知详情时发生错误")
        raise HTTPException(
            status_code=500,
            detail=f"获取通知详情失败: {str(e)}"
        )

 