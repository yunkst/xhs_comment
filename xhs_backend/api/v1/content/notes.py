"""
笔记管理

内容管理域 - 笔记数据的查询、管理和统计功能
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime, timedelta

from database import get_database, NOTES_COLLECTION
from api.deps import get_current_user

# 配置日志
logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter()

@router.get("", summary="查询笔记")
async def get_notes(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    keyword: Optional[str] = Query(None, description="关键字搜索"),
    author: Optional[str] = Query(None, description="作者名称"),
    start_date: Optional[str] = Query(None, description="开始日期 YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="结束日期 YYYY-MM-DD"),
    current_user: str = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    查询笔记数据
    
    支持分页、关键字搜索、按作者过滤、按日期范围过滤
    """
    try:
        collection = db[NOTES_COLLECTION]
        
        # 构建查询条件
        query = {}
        
        if keyword:
            query["$or"] = [
                {"title": {"$regex": keyword, "$options": "i"}},
                {"content": {"$regex": keyword, "$options": "i"}},
                {"user.nickname": {"$regex": keyword, "$options": "i"}}
            ]
        
        if author:
            query["user.nickname"] = {"$regex": author, "$options": "i"}
            
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
        notes_list = []
        
        for doc in cursor:
            doc['_id'] = str(doc['_id'])
            notes_list.append(doc)
        
        # 获取总数
        total = collection.count_documents(query)
        
        return {
            "success": True,
            "data": notes_list,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
            "message": f"成功获取 {len(notes_list)} 条笔记数据"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("查询笔记数据时发生错误")
        raise HTTPException(
            status_code=500,
            detail=f"查询笔记数据失败: {str(e)}"
        )

@router.get("/stats", summary="笔记统计")
async def get_notes_stats(
    current_user: str = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    获取笔记统计信息
    """
    try:
        collection = db[NOTES_COLLECTION]
        
        # 基础统计
        total_notes = collection.count_documents({})
        
        # 时间范围统计
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday_start = today_start - timedelta(days=1)
        week_start = now - timedelta(days=7)
        month_start = now - timedelta(days=30)
        
        today_notes = collection.count_documents({"fetch_time": {"$gte": today_start}})
        yesterday_notes = collection.count_documents({
            "fetch_time": {"$gte": yesterday_start, "$lt": today_start}
        })
        week_notes = collection.count_documents({"fetch_time": {"$gte": week_start}})
        month_notes = collection.count_documents({"fetch_time": {"$gte": month_start}})
        
        # 按作者统计 (Top 10)
        authors_pipeline = [
            {"$group": {"_id": "$user.nickname", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        top_authors = list(collection.aggregate(authors_pipeline))
        
        # 获取平均点赞数和收藏数
        engagement_pipeline = [
            {
                "$group": {
                    "_id": None,
                    "avg_liked_count": {"$avg": "$liked_count"},
                    "avg_collected_count": {"$avg": "$collected_count"},
                    "total_liked": {"$sum": "$liked_count"},
                    "total_collected": {"$sum": "$collected_count"}
                }
            }
        ]
        engagement_result = list(collection.aggregate(engagement_pipeline))
        engagement_stats = engagement_result[0] if engagement_result else {
            "avg_liked_count": 0,
            "avg_collected_count": 0,
            "total_liked": 0,
            "total_collected": 0
        }
        
        return {
            "success": True,
            "stats": {
                "total": {
                    "notes": total_notes
                },
                "period": {
                    "today": today_notes,
                    "yesterday": yesterday_notes,
                    "week": week_notes,
                    "month": month_notes
                },
                "top_authors": [{"author": item["_id"], "count": item["count"]} for item in top_authors],
                "engagement": {
                    "avg_liked": round(engagement_stats.get("avg_liked_count", 0), 2),
                    "avg_collected": round(engagement_stats.get("avg_collected_count", 0), 2),
                    "total_liked": engagement_stats.get("total_liked", 0),
                    "total_collected": engagement_stats.get("total_collected", 0)
                }
            },
            "timestamp": now.strftime("%Y-%m-%d %H:%M:%S")
        }
        
    except Exception as e:
        logger.exception("获取笔记统计时发生错误")
        raise HTTPException(
            status_code=500,
            detail=f"获取笔记统计失败: {str(e)}"
        )

@router.get("/{note_id}", summary="获取单条笔记")
async def get_note(
    note_id: str,
    current_user: str = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    获取单条笔记详情
    """
    try:
        collection = db[NOTES_COLLECTION]
        
        # 尝试通过MongoDB ObjectId查询
        try:
            from bson import ObjectId
            note = collection.find_one({"_id": ObjectId(note_id)})
        except:
            # 如果不是有效的ObjectId，尝试按note_id字段查询
            note = collection.find_one({"note_id": note_id})
        
        if not note:
            raise HTTPException(
                status_code=404,
                detail=f"未找到笔记: {note_id}"
            )
        
        note['_id'] = str(note['_id'])
        
        return {
            "success": True,
            "data": note,
            "message": "成功获取笔记详情"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("获取笔记详情时发生错误")
        raise HTTPException(
            status_code=500,
            detail=f"获取笔记详情失败: {str(e)}"
        )

@router.delete("/{note_id}", summary="删除笔记")
async def delete_note(
    note_id: str,
    current_user: str = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    删除笔记
    """
    try:
        collection = db[NOTES_COLLECTION]
        
        # 尝试通过MongoDB ObjectId删除
        try:
            from bson import ObjectId
            result = collection.delete_one({"_id": ObjectId(note_id)})
        except:
            # 如果不是有效的ObjectId，尝试按note_id字段删除
            result = collection.delete_one({"note_id": note_id})
        
        if result.deleted_count == 0:
            raise HTTPException(
                status_code=404,
                detail=f"未找到笔记: {note_id}"
            )
        
        return {
            "success": True,
            "message": f"成功删除笔记: {note_id}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("删除笔记时发生错误")
        raise HTTPException(
            status_code=500,
            detail=f"删除笔记失败: {str(e)}"
        ) 