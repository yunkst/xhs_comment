"""
评论管理

内容管理域 - 评论数据的查询、管理和统计功能
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime, timedelta

from database import get_database, COMMENTS_COLLECTION, STRUCTURED_COMMENTS_COLLECTION
from api.deps import get_current_user

# 配置日志
logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter()

@router.get("", summary="查询评论")
async def get_comments(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    keyword: Optional[str] = Query(None, description="关键字搜索"),
    note_id: Optional[str] = Query(None, description="笔记ID"),
    start_date: Optional[str] = Query(None, description="开始日期 YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="结束日期 YYYY-MM-DD"),
    current_user: str = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    查询评论数据
    
    支持分页、关键字搜索、按笔记ID过滤、按日期范围过滤
    """
    try:
        collection = db[COMMENTS_COLLECTION]
        
        # 构建查询条件
        query = {}
        
        if keyword:
            query["$or"] = [
                {"content": {"$regex": keyword, "$options": "i"}},
                {"user_name": {"$regex": keyword, "$options": "i"}}
            ]
        
        if note_id:
            query["note_id"] = note_id
            
        if start_date and end_date:
            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                end_dt = datetime.strptime(end_date + " 23:59:59", "%Y-%m-%d %H:%M:%S")
                query["fetch_time"] = {
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
        cursor = collection.find(query).sort("fetch_time", -1).skip(skip).limit(page_size)
        comments_list = []
        
        # 使用异步方式获取文档列表
        comments_list = await cursor.to_list(length=page_size)
        
        # 转换ObjectId为字符串
        for doc in comments_list:
            doc['_id'] = str(doc['_id'])
        
        # 获取总数
        total = await collection.count_documents(query)
        
        return {
            "success": True,
            "data": comments_list,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
            "message": f"成功获取 {len(comments_list)} 条评论数据"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("查询评论数据时发生错误")
        raise HTTPException(
            status_code=500,
            detail=f"查询评论数据失败: {str(e)}"
        )

@router.get("/stats", summary="评论统计")
async def get_comments_stats(
    current_user: str = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    获取评论统计信息
    """
    try:
        collection = db[COMMENTS_COLLECTION]
        structured_collection = db[STRUCTURED_COMMENTS_COLLECTION]
        
        # 基础统计
        total_comments = await collection.count_documents({})
        structured_comments = await structured_collection.count_documents({})
        
        # 时间范围统计
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday_start = today_start - timedelta(days=1)
        week_start = now - timedelta(days=7)
        month_start = now - timedelta(days=30)
        
        today_comments = await collection.count_documents({"fetch_time": {"$gte": today_start}})
        yesterday_comments = await collection.count_documents({
            "fetch_time": {"$gte": yesterday_start, "$lt": today_start}
        })
        week_comments = await collection.count_documents({"fetch_time": {"$gte": week_start}})
        month_comments = await collection.count_documents({"fetch_time": {"$gte": month_start}})
        
        # 按笔记统计 (Top 10)
        notes_pipeline = [
            {"$group": {"_id": "$note_id", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        # 使用异步方式获取聚合结果
        notes_cursor = collection.aggregate(notes_pipeline)
        top_notes = await notes_cursor.to_list(length=10)
        
        # 按用户统计 (Top 10)
        users_pipeline = [
            {"$group": {"_id": "$user_name", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        # 使用异步方式获取聚合结果
        users_cursor = collection.aggregate(users_pipeline)
        top_users = await users_cursor.to_list(length=10)
        
        return {
            "success": True,
            "stats": {
                "total": {
                    "comments": total_comments,
                    "structured_comments": structured_comments
                },
                "period": {
                    "today": today_comments,
                    "yesterday": yesterday_comments,
                    "week": week_comments,
                    "month": month_comments
                },
                "top_notes": [{"note_id": item["_id"], "count": item["count"]} for item in top_notes],
                "top_users": [{"user_name": item["_id"], "count": item["count"]} for item in top_users]
            },
            "timestamp": now.strftime("%Y-%m-%d %H:%M:%S")
        }
        
    except Exception as e:
        logger.exception("获取评论统计时发生错误")
        raise HTTPException(
            status_code=500,
            detail=f"获取评论统计失败: {str(e)}"
        )

@router.get("/{comment_id}", summary="获取单条评论")
async def get_comment(
    comment_id: str,
    current_user: str = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    获取单条评论详情
    """
    try:
        from bson import ObjectId
        
        collection = db[COMMENTS_COLLECTION]
        
        comment = await collection.find_one({"_id": ObjectId(comment_id)})
        
        if not comment:
            raise HTTPException(
                status_code=404,
                detail=f"未找到评论: {comment_id}"
            )
        
        comment['_id'] = str(comment['_id'])
        
        return {
            "success": True,
            "data": comment,
            "message": "成功获取评论详情"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("获取评论详情时发生错误")
        raise HTTPException(
            status_code=500,
            detail=f"获取评论详情失败: {str(e)}"
        )

@router.delete("/{comment_id}", summary="删除评论")
async def delete_comment(
    comment_id: str,
    current_user: str = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    删除评论
    """
    try:
        from bson import ObjectId
        
        collection = db[COMMENTS_COLLECTION]
        
        result = await collection.delete_one({"_id": ObjectId(comment_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(
                status_code=404,
                detail=f"未找到评论: {comment_id}"
            )
        
        return {
            "success": True,
            "message": f"成功删除评论: {comment_id}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("删除评论时发生错误")
        raise HTTPException(
            status_code=500,
            detail=f"删除评论失败: {str(e)}"
        )