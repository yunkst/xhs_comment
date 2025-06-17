"""
用户资料管理

用户管理域 - 用户资料查询、管理和统计功能
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime, timedelta

from database import get_database, USERS_COLLECTION, USER_INFO_COLLECTION
from api.deps import get_current_user, PaginationParams, get_pagination
from api.models.user import UserListResponse
from api.services import get_user_info, batch_get_user_info, get_all_user_info_paginated

# 配置日志
logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter()

@router.get("/list", summary="查询用户", response_model=UserListResponse)
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
            query["username"] = {"$regex": keyword, "$options": "i"}
        
        # 计算分页
        skip = (page - 1) * page_size
        
        # 查询数据
        cursor = collection.find(query).sort("created_at", -1).skip(skip).limit(page_size)
        users_docs = await cursor.to_list(length=page_size)
        
        # FastAPI's response_model with Pydantic will handle data filtering and validation.
        # The UserPublic model expects `_id` and will map it to `id`.
        # We just need to ensure `_id` is a string.
        for doc in users_docs:
            doc['_id'] = str(doc['_id'])
        
        # 获取总数
        total = await collection.count_documents(query)
        
        return {
            "items": users_docs,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("查询用户数据时发生错误")
        raise HTTPException(
            status_code=500,
            detail=f"查询用户数据失败: {str(e)}"
        )

# 小红书用户信息相关API

@router.get("/xhs/list", summary="获取小红书用户列表", tags=["小红书用户"])
async def list_xhs_users(
    pagination: PaginationParams = Depends(get_pagination),
    user_id: Optional[str] = Query(None, description="按用户ID搜索"),
    name: Optional[str] = Query(None, description="按用户名称搜索"),
    current_user: str = Depends(get_current_user)
):
    """
    分页获取小红书用户信息列表

    Args:
        pagination: 分页参数
        user_id: 用户ID搜索条件
        name: 用户名称搜索条件
        current_user: 当前认证用户名

    Returns:
        分页的小红书用户信息列表
    """
    logger.info(f"分页查询小红书用户信息: page={pagination.page}, page_size={pagination.page_size}")
    
    try:
        # 调用现有的分页服务函数
        user_data = await get_all_user_info_paginated(
            page=pagination.page, 
            page_size=pagination.page_size
        )
        
        # 如果有搜索条件，进一步过滤
        if user_id or name:
            db = await get_database()
            collection = db[USER_INFO_COLLECTION]
            
            # 构建查询条件
            query = {}
            if user_id:
                query["id"] = {"$regex": user_id, "$options": "i"}
            if name:
                query["name"] = {"$regex": name, "$options": "i"}
            
            # 重新查询
            skip = (pagination.page - 1) * pagination.page_size
            total = await collection.count_documents(query)
            
            cursor = collection.find(query).skip(skip).limit(pagination.page_size).sort("updatedAt", -1)
            users = await cursor.to_list(length=pagination.page_size)

            # 处理结果
            for user in users:
                if '_id' in user:
                    user['_id'] = str(user['_id'])
                if 'createdAt' in user and isinstance(user['createdAt'], datetime):
                    user['createdAt'] = user['createdAt'].isoformat()
                if 'updatedAt' in user and isinstance(user['updatedAt'], datetime):
                    user['updatedAt'] = user['updatedAt'].isoformat()

            user_data = {
                "items": users,
                "total": total,
                "page": pagination.page,
                "page_size": pagination.page_size
            }
        
        return {
            "success": True,
            "message": "获取小红书用户列表成功",
            "data": user_data
        }
        
    except Exception as e:
        logger.exception(f"获取小红书用户列表时出错: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"获取小红书用户列表失败: {str(e)}"
        )

@router.get("/xhs/{user_id}", summary="获取小红书用户详情", tags=["小红书用户"])
async def get_xhs_user_info(
    user_id: str,
    current_user: str = Depends(get_current_user)
):
    """
    获取小红书用户的详细信息
    
    Args:
        user_id: 小红书用户ID
        current_user: 当前认证用户名
        
    Returns:
        用户详细信息或404
    """
    logger.info(f"查询小红书用户信息: userId={user_id}")
    
    try:
        user_info = await get_user_info(user_id)
        if not user_info:
            raise HTTPException(status_code=404, detail="未找到该小红书用户信息")
        
        return {
            "success": True,
            "message": "获取小红书用户信息成功",
            "data": user_info
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"获取小红书用户信息时出错: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"获取小红书用户信息失败: {str(e)}"
        )

@router.get("/xhs/batch", summary="批量获取小红书用户信息", tags=["小红书用户"])
async def get_multiple_xhs_user_info(
    user_ids: str = Query(..., description="逗号分隔的用户ID列表"),
    current_user: str = Depends(get_current_user)
):
    """
    批量获取多个小红书用户的信息
    
    Args:
        user_ids: 逗号分隔的小红书用户ID列表
        current_user: 当前认证用户名
        
    Returns:
        用户信息映射
    """
    user_id_list = user_ids.split(',')
    logger.info(f"批量查询小红书用户信息: userIds={user_id_list}")
    
    try:
        if not user_id_list:
            return {
                "success": True,
                "message": "未提供有效的用户ID列表",
                "data": {}
            }
        
        user_infos = await batch_get_user_info(user_id_list)
        
        return {
            "success": True,
            "message": f"获取到 {len(user_infos)} 个小红书用户信息",
            "data": user_infos
        }
        
    except Exception as e:
        logger.exception(f"批量获取小红书用户信息时出错: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"批量获取小红书用户信息失败: {str(e)}"
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