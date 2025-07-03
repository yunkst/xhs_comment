"""
笔记管理

内容管理域 - 笔记数据的查询、管理和统计功能
"""
from fastapi import APIRouter, HTTPException, Depends, Query, Body
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime, timedelta
from bson import ObjectId
from pymongo import UpdateOne

from database import get_database, NOTES_COLLECTION, NOTE_DETAILS_COLLECTION
from api.deps import get_current_user, get_current_user_combined
from api.models.content import XhsNoteDetail

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
        notes_docs = await cursor.to_list(length=page_size)
        notes_list = []
        
        for doc in notes_docs:
            doc['_id'] = str(doc['_id'])
            notes_list.append(doc)
        
        # 获取总数
        total = await collection.count_documents(query)
        
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
        total_notes = await collection.count_documents({})
        
        # 时间范围统计
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday_start = today_start - timedelta(days=1)
        week_start = now - timedelta(days=7)
        month_start = now - timedelta(days=30)
        
        today_notes = await collection.count_documents({"fetch_time": {"$gte": today_start}})
        yesterday_notes = await collection.count_documents({
            "fetch_time": {"$gte": yesterday_start, "$lt": today_start}
        })
        week_notes = await collection.count_documents({"fetch_time": {"$gte": week_start}})
        month_notes = await collection.count_documents({"fetch_time": {"$gte": month_start}})
        
        # 按作者统计 (Top 10)
        authors_pipeline = [
            {"$group": {"_id": "$user.nickname", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        top_authors = await collection.aggregate(authors_pipeline).to_list(length=10)
        
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
        engagement_result = await collection.aggregate(engagement_pipeline).to_list(length=1)
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
            note = await collection.find_one({"_id": ObjectId(note_id)})
        except:
            # 如果不是有效的ObjectId，尝试通过noteId查询
            note = await collection.find_one({"noteId": note_id})
        
        if not note:
            raise HTTPException(
                status_code=404,
                detail="笔记不存在"
            )
        
        # 转换ObjectId为字符串
        note['_id'] = str(note['_id'])
        
        return {
            "success": True,
            "data": note
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("获取笔记详情时发生错误")
        raise HTTPException(
            status_code=500,
            detail=f"获取笔记详情失败: {str(e)}"
        )

@router.post("/details/upload", summary="上传笔记详情数据")
async def upload_note_details(
    note_details: List[XhsNoteDetail],
    user: str = Depends(get_current_user_combined),
    db=Depends(get_database)
):
    """
    接收并存储来自插件的笔记详情数据
    
    - 支持批量上传
    - 根据 note_id 实现去重（更新旧数据）
    - 不存储 comments 字段以节省空间
    """
    if not note_details:
        raise HTTPException(
            status_code=400,
            detail="笔记详情数据不能为空"
        )
    
    try:
        collection = db[NOTE_DETAILS_COLLECTION]
        
        operations = []
        for detail in note_details:
            # 转换为字典，并排除 comments 字段
            detail_dict = detail.dict(by_alias=True)
            detail_dict.pop('comments', None)
            
            # 添加处理元数据
            detail_dict['processed_by'] = user
            detail_dict['processed_at'] = datetime.utcnow()
            
            # 创建 UpdateOne 操作，使用 upsert=True
            # 如果找到匹配的 noteId，则替换整个文档；否则插入新文档
            op = UpdateOne(
                {"noteId": detail_dict["noteId"]},
                {"$set": detail_dict},
                upsert=True
            )
            operations.append(op)
            
        if not operations:
            return {"success": True, "message": "没有需要处理的数据"}
            
        # 执行批量写入操作
        result = await collection.bulk_write(operations)
        
        logger.info(
            f"用户 '{user}' 上传了 {len(note_details)} 条笔记详情，"
            f"插入: {result.upserted_count}, 更新: {result.modified_count}"
        )
        
        return {
            "success": True,
            "inserted": result.upserted_count,
            "updated": result.modified_count,
            "message": "笔记详情数据处理完成"
        }
        
    except Exception as e:
        logger.exception("上传笔记详情数据时发生错误")
        raise HTTPException(
            status_code=500,
            detail=f"处理笔记详情数据失败: {str(e)}"
        )

@router.get("/details/list", summary="查询笔记详情列表")
async def get_note_details(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    keyword: Optional[str] = Query(None, description="关键字搜索"),
    author: Optional[str] = Query(None, description="作者名称"),
    note_type: Optional[str] = Query(None, description="笔记类型：video 或 normal"),
    start_date: Optional[str] = Query(None, description="开始日期 YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="结束日期 YYYY-MM-DD"),
    current_user: str = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    查询笔记详情数据列表
    """
    try:
        collection = db[NOTE_DETAILS_COLLECTION]
        
        # 构建查询条件
        query = {}
        
        if keyword:
            query["$or"] = [
                {"title": {"$regex": keyword, "$options": "i"}},
                {"desc": {"$regex": keyword, "$options": "i"}},
                {"user.nickname": {"$regex": keyword, "$options": "i"}}
            ]
        
        if author:
            query["user.nickname"] = {"$regex": author, "$options": "i"}
        
        if note_type:
            query["type"] = note_type
            
        if start_date and end_date:
            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                end_dt = datetime.strptime(end_date + " 23:59:59", "%Y-%m-%d %H:%M:%S")
                query["fetchTimestamp"] = {
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
        
        # 查询数据 - 只返回基本信息，不包含完整评论
        projection = {
            "noteId": 1,
            "type": 1,
            "title": 1,
            "desc": 1,
            "time": 1,
            "ipLocation": 1,
            "user": 1,
            "interactInfo": 1,
            "tagList": 1,
            "fetchTimestamp": 1,
            "comments.cursor": 1,
            "comments.hasMore": 1,
            "comments.firstRequestFinish": 1,
            "imageList": {"$slice": 3},  # 只返回前3张图片
            "video.duration": 1,
            "video.firstFrameFileid": 1,
            "video.thumbnailFileid": 1
        }
        
        cursor = collection.find(query, projection).sort("fetchTimestamp", -1).skip(skip).limit(page_size)
        notes_docs = await cursor.to_list(length=page_size)
        
        # 处理结果
        notes_list = []
        for doc in notes_docs:
            doc['_id'] = str(doc['_id'])
            if 'fetchTimestamp' in doc and doc['fetchTimestamp']:
                doc['fetchTimestamp'] = doc['fetchTimestamp'].isoformat()
            # 转换time时间戳为publishTime
            if 'time' in doc and doc['time']:
                try:
                    doc['publishTime'] = datetime.fromtimestamp(doc['time'] / 1000).isoformat()
                except (ValueError, TypeError):
                    doc['publishTime'] = None
            notes_list.append(doc)
        
        # 获取总数
        total = await collection.count_documents(query)
        
        return {
            "success": True,
            "data": notes_list,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
            "message": f"成功获取 {len(notes_list)} 条笔记详情数据"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("查询笔记详情数据时发生错误")
        raise HTTPException(
            status_code=500,
            detail=f"查询笔记详情数据失败: {str(e)}"
        )

@router.get("/details/{note_id}", summary="获取单条笔记详情")
async def get_note_detail(
    note_id: str,
    current_user: str = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    获取单条笔记的完整详情数据，包括评论
    """
    try:
        collection = db[NOTE_DETAILS_COLLECTION]
        
        # 通过noteId查询
        note = await collection.find_one({"noteId": note_id})
        
        if not note:
            raise HTTPException(
                status_code=404,
                detail="笔记详情不存在"
            )
        
        # 处理结果
        note['_id'] = str(note['_id'])
        if 'fetchTimestamp' in note and note['fetchTimestamp']:
            note['fetchTimestamp'] = note['fetchTimestamp'].isoformat()
        # 转换time时间戳为publishTime
        if 'time' in note and note['time']:
            try:
                note['publishTime'] = datetime.fromtimestamp(note['time'] / 1000).isoformat()
            except (ValueError, TypeError):
                note['publishTime'] = None
        
        return {
            "success": True,
            "data": note
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("获取笔记详情时发生错误")
        raise HTTPException(
            status_code=500,
            detail=f"获取笔记详情失败: {str(e)}"
        )

 