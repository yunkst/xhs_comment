from fastapi import APIRouter, HTTPException, Depends, status
from typing import Dict, Any, List
import logging
import os
import psutil
import platform
from datetime import datetime, timedelta

from database import get_database, COMMENTS_COLLECTION, NOTES_COLLECTION, NOTIFICATIONS_COLLECTION
from api.deps import get_current_user

# 配置日志
logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter()

@router.get("/status", response_model=Dict[str, Any])
async def system_status(
    current_user: str = Depends(get_current_user)
):
    """
    获取系统状态信息
    
    Args:
        current_user: 当前用户
        
    Returns:
        系统状态信息
    """
    try:
        # 获取系统基本信息
        system_info = {
            "platform": platform.system(),
            "platform_release": platform.release(),
            "platform_version": platform.version(),
            "architecture": platform.machine(),
            "processor": platform.processor(),
            "hostname": platform.node(),
            "python_version": platform.python_version(),
            "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        
        # 获取CPU使用率
        cpu_usage = psutil.cpu_percent(interval=1)
        
        # 获取内存使用情况
        memory = psutil.virtual_memory()
        memory_info = {
            "total": memory.total,
            "available": memory.available,
            "used": memory.used,
            "percent": memory.percent
        }
        
        # 获取磁盘使用情况
        disk = psutil.disk_usage('/')
        disk_info = {
            "total": disk.total,
            "used": disk.used,
            "free": disk.free,
            "percent": disk.percent
        }
        
        # 获取网络信息
        net_io = psutil.net_io_counters()
        net_info = {
            "bytes_sent": net_io.bytes_sent,
            "bytes_recv": net_io.bytes_recv,
            "packets_sent": net_io.packets_sent,
            "packets_recv": net_io.packets_recv
        }
        
        return {
            "status": "running",
            "system_info": system_info,
            "cpu_usage": cpu_usage,
            "memory": memory_info,
            "disk": disk_info,
            "network": net_info
        }
    except Exception as e:
        logger.exception("获取系统状态时发生错误")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取系统状态时出错: {str(e)}"
        )

@router.get("/database-stats", response_model=Dict[str, Any])
async def database_stats(
    current_user: str = Depends(get_current_user)
):
    """
    获取数据库统计信息
    
    Args:
        current_user: 当前用户
        
    Returns:
        数据库统计信息
    """
    try:
        # 获取数据库
        db = await get_database()
        
        # 获取各集合数据统计
        comments_count = await db[COMMENTS_COLLECTION].count_documents({})
        structured_comments_count = await db["structured_comments"].count_documents({})
        notes_count = await db[NOTES_COLLECTION].count_documents({})
        notifications_count = await db[NOTIFICATIONS_COLLECTION].count_documents({})
        users_count = await db["users"].count_documents({})
        
        # 获取最近统计
        now = datetime.utcnow()
        yesterday = now - timedelta(days=1)
        last_week = now - timedelta(days=7)
        
        recent_comments = await db[COMMENTS_COLLECTION].count_documents({"fetch_time": {"$gte": yesterday}})
        recent_notes = await db[NOTES_COLLECTION].count_documents({"fetch_time": {"$gte": yesterday}})
        recent_notifications = await db[NOTIFICATIONS_COLLECTION].count_documents({"timestamp": {"$gte": yesterday}})
        
        weekly_comments = await db[COMMENTS_COLLECTION].count_documents({"fetch_time": {"$gte": last_week}})
        weekly_notes = await db[NOTES_COLLECTION].count_documents({"fetch_time": {"$gte": last_week}})
        weekly_notifications = await db[NOTIFICATIONS_COLLECTION].count_documents({"timestamp": {"$gte": last_week}})
        
        return {
            "total_stats": {
                "comments": comments_count,
                "structured_comments": structured_comments_count,
                "notes": notes_count,
                "notifications": notifications_count,
                "users": users_count
            },
            "daily_stats": {
                "comments": recent_comments,
                "notes": recent_notes,
                "notifications": recent_notifications
            },
            "weekly_stats": {
                "comments": weekly_comments,
                "notes": weekly_notes,
                "notifications": weekly_notifications
            },
            "timestamp": now.strftime("%Y-%m-%d %H:%M:%S")
        }
    except Exception as e:
        logger.exception("获取数据库统计时发生错误")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取数据库统计时出错: {str(e)}"
        )

@router.get("/version", response_model=Dict[str, Any])
async def version_info():
    """
    获取系统版本信息（无需认证）
    
    Returns:
        系统版本信息
    """
    return {
        "name": "小红书评论维护系统",
        "version": "1.0.0",
        "api_version": "v1",
        "build_date": "2023-11-10"
    }
