from fastapi import APIRouter, HTTPException, Depends, status, Body, Query, Request
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime

from api.models.common import IncomingPayload
from api.models.content import StructuredComment
from database import (
    STRUCTURED_COMMENTS_COLLECTION,
    COMMENTS_COLLECTION,
    connect_to_mongo,
    get_database
)
from processing import transform_raw_comments_to_structured
from api.deps import get_current_user, get_current_user_combined, get_pagination, PaginationParams
from api.services.comment import save_comments_with_upsert, save_structured_comments, get_user_historical_comments
from api.services.user import save_user_info
# 配置日志
logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter()

@router.get("", response_model=Dict[str, Any])
async def get_comments(
    keyword: Optional[str] = None,
    status: Optional[str] = None,
    noteId: Optional[str] = None,
    authorName: Optional[str] = None,
    authorId_filter: Optional[str] = Query(None, alias="authorId"),
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    pagination: PaginationParams = Depends(get_pagination),
    request: Request = None,
    current_user: str = Depends(get_current_user_combined)
):
    """
    获取评论列表，支持多种过滤条件
    
    Args:
        keyword: 关键词（将用于搜索评论内容、作者名称、笔记ID、作者ID）
        status: 评论状态 (暂未使用)
        noteId: 精确匹配笔记ID (如果提供，keyword中的笔记ID搜索可能被覆盖或结合)
        authorName: 精确匹配作者名称 (如果提供，keyword中的作者名搜索可能被覆盖或结合)
        authorId_filter: 精确匹配作者ID (参数名在URL中为 authorId)
        startDate: 开始日期 (YYYY-MM-DD)
        endDate: 结束日期 (YYYY-MM-DD)
        pagination: 分页参数
        current_user: 当前用户
        
    Returns:
        评论列表和总数
    """
    # 构建查询条件
    query_conditions = []
    
    if keyword:
        keyword_regex = {"$regex": keyword, "$options": "i"}
        query_conditions.append({
            "$or": [
                {"content": keyword_regex},
                {"authorName": keyword_regex},
                {"noteId": keyword_regex},
                {"authorId": keyword_regex}
            ]
        })
    
    # 如果提供了精确的noteId或authorName，可以添加到主查询条件中
    # 这里的逻辑是 AND，如果希望是 OR，则需要调整
    if noteId:
        query_conditions.append({"noteId": noteId})
    
    if authorName:
        query_conditions.append({"authorName": {"$regex": authorName, "$options": "i"}}) # 或者精确匹配: authorName
        
    if authorId_filter:
        query_conditions.append({"authorId": authorId_filter})
    
    # 状态查询 (如果将来启用)
    # if status:
    #     query_conditions.append({"status": status})
    
    # 处理日期范围 (基于评论实际发布时间 timestamp)
    date_query = {}
    if startDate:
        try:
            date_query["$gte"] = datetime.strptime(startDate, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail=f"无效的开始日期格式: {startDate}. 请使用 YYYY-MM-DD.")
    if endDate:
        try:
            # 将结束日期设为当天的最后一秒，以包含整个结束日期
            dt_endDate = datetime.strptime(endDate, "%Y-%m-%d")
            date_query["$lte"] = dt_endDate.replace(hour=23, minute=59, second=59, microsecond=999999)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"无效的结束日期格式: {endDate}. 请使用 YYYY-MM-DD.")
            
    if date_query:
        query_conditions.append({"timestamp": date_query})
    
    # 合并所有查询条件
    final_query = {}
    if query_conditions:
        final_query["$and"] = query_conditions
    
    # 获取数据库集合
    db = await get_database()
    comments_collection = db[STRUCTURED_COMMENTS_COLLECTION]
    
    # 获取总数
    total = await comments_collection.count_documents(final_query)
    
    # 获取评论列表
    # 通常按评论时间降序排序
    comments_cursor = comments_collection.find(final_query) \
        .sort("timestamp", -1) \
        .skip(pagination.skip) \
        .limit(pagination.limit)
    
    comments = await comments_cursor.to_list(length=pagination.limit)
    
    # 处理结果（特别是将_id转换为字符串）
    for comment in comments:
        if '_id' in comment:
            comment['_id'] = str(comment['_id'])
    
    return {
        "items": comments,
        "total": total,
        "page": pagination.page,
        "page_size": pagination.page_size
    }

@router.get("/{comment_id}", response_model=Dict[str, Any])
async def get_comment_by_id(
    comment_id: str,
    current_user: str = Depends(get_current_user)
):
    """
    根据ID获取评论详情
    
    Args:
        comment_id: 评论ID
        current_user: 当前用户
        
    Returns:
        评论详情
    """
    # 获取数据库集合
    db = await get_database()
    comments_collection = db[STRUCTURED_COMMENTS_COLLECTION]
    
    # 查询评论
    comment = await comments_collection.find_one({"commentId": comment_id})
    
    if not comment:
        raise HTTPException(status_code=404, detail="评论不存在")
    
    # 处理结果
    if '_id' in comment:
        comment['_id'] = str(comment['_id'])
    
    return comment

@router.put("/{comment_id}/status", response_model=Dict[str, Any])
async def update_comment_status(
    comment_id: str,
    status_data: Dict[str, Any] = Body(...),
    current_user: str = Depends(get_current_user)
):
    """
    更新评论状态
    
    Args:
        comment_id: 评论ID
        status_data: 包含新状态的数据
        current_user: 当前用户
        
    Returns:
        更新结果
    """
    new_status = status_data.get("status")
    if not new_status:
        raise HTTPException(status_code=400, detail="状态不能为空")
    
    # 获取数据库集合
    db = await get_database()
    comments_collection = db[STRUCTURED_COMMENTS_COLLECTION]
    
    # 更新状态
    result = await comments_collection.update_one(
        {"commentId": comment_id},
        {"$set": {"status": new_status, "updatedAt": datetime.utcnow()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="评论不存在")
    
    return {"success": True, "message": f"已更新评论状态为 {new_status}"}

@router.delete("/{comment_id}", response_model=Dict[str, Any])
async def delete_comment(
    comment_id: str,
    current_user: str = Depends(get_current_user)
):
    """
    删除评论
    
    Args:
        comment_id: 评论ID
        current_user: 当前用户
        
    Returns:
        删除结果
    """
    # 获取数据库集合
    db = await get_database()
    comments_collection = db[STRUCTURED_COMMENTS_COLLECTION]
    
    # 删除评论
    result = await comments_collection.delete_one({"commentId": comment_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="评论不存在")
    
    return {"success": True, "message": "评论已删除"}

@router.put("/batch/status", response_model=Dict[str, Any])
async def batch_update_status(
    data: Dict[str, Any] = Body(...),
    current_user: str = Depends(get_current_user)
):
    """
    批量更新评论状态
    
    Args:
        data: 包含评论ID列表和新状态的数据
        current_user: 当前用户
        
    Returns:
        更新结果
    """
    comment_ids = data.get("commentIds", [])
    new_status = data.get("status")
    
    if not comment_ids or not new_status:
        raise HTTPException(status_code=400, detail="评论ID列表和状态不能为空")
    
    # 获取数据库集合
    db = await get_database()
    comments_collection = db[STRUCTURED_COMMENTS_COLLECTION]
    
    # 批量更新状态
    result = await comments_collection.update_many(
        {"commentId": {"$in": comment_ids}},
        {"$set": {"status": new_status, "updatedAt": datetime.utcnow()}}
    )
    
    return {
        "success": True,
        "message": f"已更新 {result.modified_count} 条评论状态为 {new_status}",
        "modified_count": result.modified_count,
        "matched_count": result.matched_count
    }

@router.post("/batch/delete", response_model=Dict[str, Any])
async def batch_delete(
    data: Dict[str, Any] = Body(...),
    current_user: str = Depends(get_current_user)
):
    """
    批量删除评论
    
    Args:
        data: 包含评论ID列表的数据
        current_user: 当前用户
        
    Returns:
        删除结果
    """
    comment_ids = data.get("commentIds", [])
    
    if not comment_ids:
        raise HTTPException(status_code=400, detail="评论ID列表不能为空")
    
    # 获取数据库集合
    db = await get_database()
    comments_collection = db[STRUCTURED_COMMENTS_COLLECTION]
    
    # 批量删除评论
    result = await comments_collection.delete_many({"commentId": {"$in": comment_ids}})
    
    return {
        "success": True,
        "message": f"已删除 {result.deleted_count} 条评论",
        "deleted_count": result.deleted_count
    }

@router.get("/user/{user_id}", response_model=List[Dict[str, Any]])
async def get_user_comments(
    user_id: str,
    current_user: str = Depends(get_current_user)
):
    """
    获取指定用户ID的所有历史评论
    
    Args:
        user_id: 用户ID
        current_user: 认证用户名
        
    Returns:
        包含用户评论及相关笔记信息的列表，按时间降序排序
    """
    logger.info(f"查询用户 {user_id} 的历史评论")
    
    try:
        # 调用数据库函数获取历史评论
        comments = await get_user_historical_comments(user_id)
        
        if not comments:
            logger.info(f"未找到用户 {user_id} 的历史评论")
            return []
        
        logger.info(f"成功获取用户 {user_id} 的历史评论，共 {len(comments)} 条笔记")
        return comments
    except Exception as e:
        logger.exception(f"获取用户 {user_id} 的历史评论时发生错误")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"获取历史评论时出错: {str(e)}"
        )

@router.post("/data", tags=["数据接收"], status_code=status.HTTP_201_CREATED)
async def receive_comments_data(
    payload: IncomingPayload,
    current_user: str = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    接收评论数据
    
    Args:
        payload: 包含评论数据的有效载荷
        current_user: 当前用户
        
    Returns:
        保存结果
    """
    if payload.type != "评论":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的数据类型，期望类型为'评论'"
        )
    
    logger.info(f"接收到类型为 '评论' 的数据，共 {len(payload.data)} 条")
    
    try:
        # 1. 提取和保存用户信息
        users_saved = 0
        try:
            logger.info("开始提取用户信息...")
            for comment_data in payload.data:
                # 提取作者信息
                author_id = None
                if comment_data.get("authorUrl"):
                    from processing import parse_author_id
                    author_id = parse_author_id(comment_data.get("authorUrl"))
                
                if author_id and comment_data.get("authorName"):
                    # 创建用户信息对象
                    user_info = {
                        "id": author_id,
                        "name": comment_data.get("authorName"),
                        "avatar": comment_data.get("authorAvatar"),
                        "url": comment_data.get("authorUrl"),
                    }
                    # 保存用户信息
                    save_result = await save_user_info(user_info)
                    if save_result.get("success", False):
                        users_saved += 1
                
                # 处理评论回复，也提取用户信息
                for reply in comment_data.get("replies", []):
                    reply_author_id = None
                    if reply.get("authorUrl"):
                        from processing import parse_author_id
                        reply_author_id = parse_author_id(reply.get("authorUrl"))
                    
                    if reply_author_id and reply.get("authorName"):
                        # 创建用户信息对象
                        reply_user_info = {
                            "id": reply_author_id,
                            "name": reply.get("authorName"),
                            "avatar": reply.get("authorAvatar"),
                            "url": reply.get("authorUrl"),
                        }
                        # 保存用户信息
                        save_result = await save_user_info(reply_user_info)
                        if save_result.get("success", False):
                            users_saved += 1
            
            logger.info(f"用户信息处理完成，成功保存/更新 {users_saved} 条用户信息")
        except Exception as e:
            logger.error(f"处理用户信息时出错: {e}", exc_info=True)
            # 即使处理用户信息失败，仍继续处理评论数据
            logger.info("继续处理评论数据...")
        
        # 2. 保存原始评论数据
        logger.info("开始保存原始评论数据...")
        raw_save_result = await save_comments_with_upsert(payload.data)
        raw_inserted = raw_save_result.get('inserted', 0)
        raw_updated = raw_save_result.get('updated', 0)
        logger.info(f"原始评论数据保存完成 - 插入: {raw_inserted}, 更新: {raw_updated}")

        # 3. 转换评论数据为结构化格式
        logger.info("开始转换评论数据为结构化格式...")
        try:
            structured_data = transform_raw_comments_to_structured(payload.data)
            logger.info(f"成功转换 {len(structured_data)} 条评论为结构化格式")
        except Exception as e:
            logger.error(f"转换评论数据时出错: {e}", exc_info=True)
            # 即使转换失败，原始数据已保存，可以返回部分成功信息
            message = f"成功保存 {raw_inserted + raw_updated} 条原始评论 (插入: {raw_inserted}, 更新: {raw_updated})，但结构化处理失败。用户信息: {users_saved} 条。"
            # 返回 500 错误可能更合适，表示处理未完全成功
            raise HTTPException(status_code=500, detail=f"原始评论已保存，但结构化处理失败: {e}")

        # 4. 保存结构化评论数据
        if structured_data:
            logger.info("开始保存结构化评论数据...")
            structured_save_result = await save_structured_comments(structured_data)
            struct_upserted = structured_save_result.get('upserted', 0)
            struct_matched = structured_save_result.get('matched', 0)
            struct_modified = structured_save_result.get('modified', 0)
            struct_failed = structured_save_result.get('failed', 0)
            logger.info(f"结构化评论数据保存完成 - 新增/Upserted: {struct_upserted}, 匹配/Matched: {struct_matched}, 修改/Modified: {struct_modified}, 失败: {struct_failed}")
            
            message = (f"处理完成。原始评论: 插入={raw_inserted}, 更新={raw_updated}. "
                       f"结构化评论: 新增/更新={struct_upserted}, 匹配={struct_matched}, 修改={struct_modified}, 失败={struct_failed}. "
                       f"用户信息: {users_saved} 条。")
            return {
                "message": message,
                "raw_inserted": raw_inserted,
                "raw_updated": raw_updated,
                "structured_upserted": struct_upserted,
                "structured_matched": struct_matched,
                "structured_modified": struct_modified,
                "structured_failed": struct_failed,
                "users_saved": users_saved
            }
        else:
            logger.info("没有生成结构化评论数据需要保存。")
            message = f"成功保存 {raw_inserted + raw_updated} 条原始评论 (插入: {raw_inserted}, 更新: {raw_updated})。未生成结构化数据。用户信息: {users_saved} 条。"
            return {
                "message": message,
                "raw_inserted": raw_inserted,
                "raw_updated": raw_updated,
                "users_saved": users_saved
            }
    except HTTPException:
        # 重新抛出已经处理过的HTTP异常
        raise
    except Exception as e:
        logger.exception(f"处理评论数据时发生错误")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"保存评论数据时出错: {str(e)}"
        )
