"""
用户备注管理模块

提供用户备注的CRUD操作，包括批量获取功能
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import logging
from database import get_database, USER_NOTES_COLLECTION
from ...deps import get_current_user_combined

# 配置日志
logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter()

# 批量查询请求模型
class BatchUserNotesRequest(BaseModel):
    user_ids: List[str]

@router.post("/batch", response_model=Dict[str, Any])
async def get_user_notes_batch_post(
    request_data: BatchUserNotesRequest,
    current_user: str = Depends(get_current_user_combined)
):
    """
    批量获取多个用户的备注 (POST版本，推荐使用)
    
    Args:
        request_data: 包含用户ID列表的请求数据
        
    Returns:
        多个用户的备注数据
    """
    user_id_list = request_data.user_ids
    logger.info(f"批量获取用户备注(POST): userIds={user_id_list}, requestUser={current_user}")
    
    if not user_id_list:
        return {
            "success": True,
            "message": "未提供有效的用户ID列表",
            "data": {}
        }
    
    try:
        # 获取数据库集合
        db = await get_database()
        collection = db[USER_NOTES_COLLECTION]
        
        # 构建批量查询
        query = {"userId": {"$in": user_id_list}}
        notes = await collection.find(query).to_list(length=None)
        
        # 处理结果（特别是将_id转换为字符串）
        result_data = {}
        for note in notes:
            if '_id' in note:
                note['_id'] = str(note['_id'])
            
            # 按照通知哈希组织结果
            hash_key = note.get('notificationHash')
            if hash_key:
                result_data[hash_key] = note.get('noteContent', '')
        
        logger.info(f"批量获取用户备注成功(POST): 查询{len(user_id_list)}个用户，返回{len(result_data)}条备注")
        
        return {
            "success": True,
            "message": f"批量获取到 {len(notes)} 条用户备注",
            "data": result_data
        }
    except Exception as e:
        logger.error(f"批量获取用户备注时发生错误(POST): {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"批量获取用户备注时出错: {str(e)}"
        )

@router.get("/batch", response_model=Dict[str, Any])
async def get_user_notes_batch_get(
    user_ids: str = Query(..., description="逗号分隔的用户ID列表"),
    current_user: str = Depends(get_current_user_combined)
):
    """
    批量获取多个用户的备注 (GET版本，向后兼容，建议用户ID较少时使用)
    
    Args:
        user_ids: 逗号分隔的用户ID列表
        current_user: 当前用户
        
    Returns:
        多个用户的备注数据
    """
    user_id_list = user_ids.split(',')
    logger.info(f"批量获取用户备注(GET): userIds={user_id_list}, requestUser={current_user}")
    
    # URL长度检查和警告
    if len(user_ids) > 1500:  # 保守估计，为其他参数留余量
        logger.warning(f"GET请求URL可能过长 ({len(user_ids)}字符)，建议使用POST /api/v1/user/notes/batch 接口")
    
    if not user_id_list:
        return {
            "success": True,
            "message": "未提供有效的用户ID列表",
            "data": {}
        }
    
    try:
        # 获取数据库集合
        db = await get_database()
        collection = db[USER_NOTES_COLLECTION]
        
        # 构建批量查询
        query = {"userId": {"$in": user_id_list}}
        notes = await collection.find(query).to_list(length=None)
        
        # 处理结果（特别是将_id转换为字符串）
        result_data = {}
        for note in notes:
            if '_id' in note:
                note['_id'] = str(note['_id'])
            
            # 按照通知哈希组织结果
            hash_key = note.get('notificationHash')
            if hash_key:
                result_data[hash_key] = note.get('noteContent', '')
        
        logger.info(f"批量获取用户备注成功(GET): 查询{len(user_id_list)}个用户，返回{len(result_data)}条备注")
        
        return {
            "success": True,
            "message": f"批量获取到 {len(notes)} 条用户备注",
            "data": result_data
        }
    except Exception as e:
        logger.error(f"批量获取用户备注时发生错误(GET): {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"批量获取用户备注时出错: {str(e)}"
        )

@router.get("/{user_id}", response_model=Dict[str, Any])
async def get_user_notes(
    user_id: str,
    current_user: str = Depends(get_current_user_combined)
):
    """
    获取指定用户的所有备注
    
    Args:
        user_id: 用户ID
        current_user: 当前用户
        
    Returns:
        用户备注列表
    """
    logger.info(f"获取用户备注: userId={user_id}, requestUser={current_user}")
    
    try:
        # 获取数据库集合
        db = await get_database()
        collection = db[USER_NOTES_COLLECTION]
        
        # 查询用户备注
        notes = await collection.find({"userId": user_id}).to_list(length=None)
        
        # 处理结果（特别是将_id转换为字符串）
        for note in notes:
            if '_id' in note:
                note['_id'] = str(note['_id'])
        
        logger.info(f"获取用户备注成功: userId={user_id}, 备注数量={len(notes)}")
        
        return {
            "success": True,
            "message": f"获取到 {len(notes)} 条用户备注",
            "data": notes
        }
    except Exception as e:
        logger.error(f"获取用户备注时发生错误: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"获取用户备注时出错: {str(e)}"
        ) 