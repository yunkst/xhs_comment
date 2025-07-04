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
from api.services import get_user_info, batch_get_user_info, get_all_user_info_paginated

# 配置日志
logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter()



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



 