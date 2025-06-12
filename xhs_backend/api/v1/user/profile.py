"""
用户资料管理

用户管理域 - 用户资料查询、管理和统计功能
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime, timedelta

from database import get_database, USERS_COLLECTION, USER_INFO_COLLECTION
from api.deps import get_current_user

# 配置日志
logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter()

@router.get("/list", summary="查询用户")
async def get_users(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    keyword: Optional[str] = Query(None, description="关键字搜索"),
    current_user: str = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    查询用户数据
    
    支持分页、关键字搜索
    """
    try:
        collection = db[USERS_COLLECTION]
        
        # 构建查询条件
        query = {}
        
        if keyword:
            query["$or"] = [
                {"username": {"$regex": keyword, "$options": "i"}},
                {"nickname": {"$regex": keyword, "$options": "i"}},
                {"email": {"$regex": keyword, "$options": "i"}}
            ]
        
        # 计算分页
        skip = (page - 1) * page_size
        
        # 查询数据，排除敏感字段
        projection = {"password": 0, "token": 0}
        cursor = collection.find(query, projection).sort("created_at", -1).skip(skip).limit(page_size)
        users_docs = await cursor.to_list(length=page_size)
        users_list = []
        
        for doc in users_docs:
            doc['_id'] = str(doc['_id'])
            users_list.append(doc)
        
        # 获取总数
        total = await collection.count_documents(query)
        
        return {
            "success": True,
            "data": users_list,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
            "message": f"成功获取 {len(users_list)} 条用户数据"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("查询用户数据时发生错误")
        raise HTTPException(
            status_code=500,
            detail=f"查询用户数据失败: {str(e)}"
        )

@router.get("/stats", summary="用户统计")
async def get_users_stats(
    current_user: str = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    获取用户统计信息
    """
    try:
        users_collection = db[USERS_COLLECTION]
        user_info_collection = db[USER_INFO_COLLECTION]
        
        # 基础统计
        total_users = await users_collection.count_documents({})
        total_user_info = await user_info_collection.count_documents({})
        
        # 时间范围统计
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday_start = today_start - timedelta(days=1)
        week_start = now - timedelta(days=7)
        month_start = now - timedelta(days=30)
        
        today_users = await users_collection.count_documents({"created_at": {"$gte": today_start}})
        yesterday_users = await users_collection.count_documents({
            "created_at": {"$gte": yesterday_start, "$lt": today_start}
        })
        week_users = await users_collection.count_documents({"created_at": {"$gte": week_start}})
        month_users = await users_collection.count_documents({"created_at": {"$gte": month_start}})
        
        # 活跃用户统计 (最近登录)
        has_login_field = await users_collection.find_one({"last_login": {"$exists": True}})
        recent_active = await users_collection.count_documents({
            "last_login": {"$gte": week_start}
        }) if has_login_field else 0
        
        return {
            "success": True,
            "stats": {
                "total": {
                    "users": total_users,
                    "user_info_records": total_user_info
                },
                "period": {
                    "today": today_users,
                    "yesterday": yesterday_users,
                    "week": week_users,
                    "month": month_users
                },
                "activity": {
                    "recent_active": recent_active,
                    "activity_rate": round((recent_active / total_users * 100) if total_users > 0 else 0, 2)
                }
            },
            "timestamp": now.strftime("%Y-%m-%d %H:%M:%S")
        }
        
    except Exception as e:
        logger.exception("获取用户统计时发生错误")
        raise HTTPException(
            status_code=500,
            detail=f"获取用户统计失败: {str(e)}"
        )

@router.get("/{user_id}", summary="获取单个用户")
async def get_user(
    user_id: str,
    current_user: str = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    获取单个用户详情
    """
    try:
        collection = db[USERS_COLLECTION]
        
        # 尝试通过MongoDB ObjectId查询
        try:
            from bson import ObjectId
            user = await collection.find_one({"_id": ObjectId(user_id)}, {"password": 0, "token": 0})
        except:
            # 如果不是有效的ObjectId，尝试按username查询
            user = await collection.find_one({"username": user_id}, {"password": 0, "token": 0})
        
        if not user:
            raise HTTPException(
                status_code=404,
                detail=f"未找到用户: {user_id}"
            )
        
        user['_id'] = str(user['_id'])
        
        return {
            "success": True,
            "data": user,
            "message": "成功获取用户详情"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("获取用户详情时发生错误")
        raise HTTPException(
            status_code=500,
            detail=f"获取用户详情失败: {str(e)}"
        ) 