from fastapi import APIRouter, HTTPException, Depends, status, Body, Query, Request
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime
from pydantic import BaseModel

from database import (
    USER_NOTES_COLLECTION,
    STRUCTURED_COMMENTS_COLLECTION,
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
    content: Optional[str] = None
    commentId: Optional[str] = None

# 批量查询请求模型
class BatchUserNotesRequest(BaseModel):
    user_ids: List[str]

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
    logger.info(f"创建/更新用户备注: userId={note_data.userId}, hash={note_data.notificationHash}, editor={current_user}")
    
    try:
        result = await save_user_note(
            note_data.userId, 
            note_data.notificationHash, 
            note_data.noteContent,
            note_data.content,
            current_user
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

@router.post("/batch", response_model=Dict[str, Any])
async def get_user_notes_batch_post(
    request_data: BatchUserNotesRequest,
    request: Request = None,
    current_user: str = Depends(get_current_user_combined)
):
    """
    批量获取多个用户的备注 (POST版本，推荐使用)
    
    Args:
        request_data: 包含用户ID列表的请求数据
        current_user: 当前用户
        
    Returns:
        多个用户的备注数据
    """
    user_id_list = request_data.user_ids
    logger.info(f"批量获取用户备注(POST兼容): userIds={user_id_list}, requestUser={current_user}")
    
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
        
        logger.info(f"批量获取用户备注成功(POST兼容): 查询{len(user_id_list)}个用户，返回{len(result_data)}条备注")
        
        return {
            "success": True,
            "message": f"批量获取到 {len(notes)} 条用户备注",
            "data": result_data
        }
    except Exception as e:
        logger.exception(f"批量获取用户备注时发生错误(POST兼容)")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"批量获取用户备注时出错: {str(e)}"
        )

@router.get("/batch", response_model=Dict[str, Any])
async def get_user_notes_batch(
    user_ids: str = Query(..., description="逗号分隔的用户ID列表"),
    request: Request = None,
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
    logger.info(f"批量获取用户备注(GET兼容): userIds={user_id_list}, requestUser={current_user}")
    
    # URL长度检查和警告
    if len(user_ids) > 1500:  # 保守估计，为其他参数留余量
        logger.warning(f"GET请求URL可能过长 ({len(user_ids)}字符)，建议使用POST /api/user-notes/batch 接口")
    
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
        
        logger.info(f"批量获取用户备注成功(GET兼容): 查询{len(user_id_list)}个用户，返回{len(result_data)}条备注")
        
        return {
            "success": True,
            "message": f"批量获取到 {len(notes)} 条用户备注",
            "data": result_data
        }
    except Exception as e:
        logger.exception(f"批量获取用户备注时发生错误(GET兼容)")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"批量获取用户备注时出错: {str(e)}"
        )

@router.get("/with-comments", response_model=Dict[str, Any])
async def get_user_notes_with_comments(
    user_id: Optional[str] = Query(None, description="用户ID，为空则查询所有"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    request: Request = None,
    current_user: str = Depends(get_current_user_combined)
):
    """
    获取关联了评论的用户备注信息
    
    Args:
        user_id: 可选的用户ID过滤
        page: 页码
        page_size: 每页数量
        current_user: 当前用户
        
    Returns:
        包含用户备注和关联评论信息的结果
    """
    logger.info(f"查询关联评论的用户备注: userId={user_id}, page={page}, pageSize={page_size}")
    
    try:
        # 获取数据库集合
        db = await get_database()
        user_notes_collection = db[USER_NOTES_COLLECTION]
        comments_collection = db[STRUCTURED_COMMENTS_COLLECTION]
        
        # 构建查询条件
        query = {"commentId": {"$exists": True, "$ne": None}}
        if user_id:
            query["userId"] = user_id
        
        # 计算总数
        total_count = await user_notes_collection.count_documents(query)
        
        # 分页查询用户备注
        skip = (page - 1) * page_size
        user_notes = await user_notes_collection.find(query)\
            .sort("updatedAt", -1)\
            .skip(skip)\
            .limit(page_size)\
            .to_list(length=None)
        
        # 处理结果（转换_id为字符串）
        for note in user_notes:
            if '_id' in note:
                note['_id'] = str(note['_id'])
        
        # 获取关联的评论信息
        comment_ids = [note.get('commentId') for note in user_notes if note.get('commentId')]
        comments_data = {}
        
        if comment_ids:
            comments = await comments_collection.find(
                {"commentId": {"$in": comment_ids}}
            ).to_list(length=None)
            
            for comment in comments:
                if '_id' in comment:
                    comment['_id'] = str(comment['_id'])
                comment_id = comment.get('commentId')
                if comment_id:
                    comments_data[comment_id] = comment
        
        # 组合结果
        result_data = []
        for note in user_notes:
            comment_id = note.get('commentId')
            note_with_comment = note.copy()
            
            if comment_id and comment_id in comments_data:
                note_with_comment['relatedComment'] = comments_data[comment_id]
            else:
                note_with_comment['relatedComment'] = None
            
            result_data.append(note_with_comment)
        
        # 计算分页信息
        total_pages = (total_count + page_size - 1) // page_size
        
        return {
            "success": True,
            "message": f"获取到 {len(result_data)} 条关联评论的用户备注",
            "data": {
                "items": result_data,
                "pagination": {
                    "page": page,
                    "pageSize": page_size,
                    "totalCount": total_count,
                    "totalPages": total_pages,
                    "hasNext": page < total_pages,
                    "hasPrev": page > 1
                }
            }
        }
        
    except Exception as e:
        logger.exception(f"查询关联评论的用户备注时发生错误")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"查询关联评论的用户备注时出错: {str(e)}"
        ) 