from fastapi import APIRouter, HTTPException, Depends, status, Body, Query, Request
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime
from pydantic import BaseModel

from database import (
    USER_NOTES_COLLECTION,
    get_database
)
from api.deps import get_current_user, get_current_user_combined
from api.services.notification import save_user_note, get_user_notes
# 配置日志
logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter()

# 用户备注模型
class UserNoteCreate(BaseModel):
    userId: str
    notificationHash: str
    noteContent: str

@router.post("", response_model=Dict[str, Any])
async def create_user_note(
    note_data: UserNoteCreate,
    request: Request = None,
    current_user: str = Depends(get_current_user_combined)
):
    """
    创建或更新用户备注
    
    Args:
        note_data: 包含用户ID、通知哈希和备注内容的数据
        current_user: 当前用户
        
    Returns:
        操作结果
    """
    logger.info(f"创建/更新用户备注: userId={note_data.userId}, hash={note_data.notificationHash}")
    
    try:
        result = await save_user_note(
            note_data.userId, 
            note_data.notificationHash, 
            note_data.noteContent
        )
        
        if result:
            return {
                "success": True,
                "message": "备注保存成功",
                "data": result
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="保存备注失败"
            )
    except Exception as e:
        logger.exception(f"保存用户备注时发生错误")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"保存用户备注时出错: {str(e)}"
        )

@router.get("", response_model=Dict[str, Any])
async def get_user_notes_by_id(
    user_id: str,
    request: Request = None,
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
    logger.info(f"获取用户备注: userId={user_id}")
    
    try:
        notes = await get_user_notes(user_id)
        
        # 处理结果（特别是将_id转换为字符串）
        for note in notes:
            if '_id' in note:
                note['_id'] = str(note['_id'])
        
        return {
            "success": True,
            "message": f"获取到 {len(notes)} 条用户备注",
            "data": notes
        }
    except Exception as e:
        logger.exception(f"获取用户备注时发生错误")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取用户备注时出错: {str(e)}"
        )

@router.get("/batch", response_model=Dict[str, Any])
async def get_user_notes_batch(
    user_ids: str = Query(..., description="逗号分隔的用户ID列表"),
    request: Request = None,
    current_user: str = Depends(get_current_user_combined)
):
    """
    批量获取多个用户的备注
    
    Args:
        user_ids: 逗号分隔的用户ID列表
        current_user: 当前用户
        
    Returns:
        多个用户的备注数据
    """
    user_id_list = user_ids.split(',')
    logger.info(f"批量获取用户备注: userIds={user_id_list}")
    
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
        
        return {
            "success": True,
            "message": f"批量获取到 {len(notes)} 条用户备注",
            "data": result_data
        }
    except Exception as e:
        logger.exception(f"批量获取用户备注时发生错误")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"批量获取用户备注时出错: {str(e)}"
        ) 