"""
系统监控端点

提供系统状态查询、健康检查、版本信息和数据库统计功能
"""
from fastapi import APIRouter, HTTPException, Depends, status, Request
from typing import Dict, Any
import logging
import os
import psutil
import platform
from datetime import datetime, timedelta

from database import get_database, COMMENTS_COLLECTION, NOTES_COLLECTION, NOTIFICATIONS_COLLECTION, STRUCTURED_COMMENTS_COLLECTION, USER_INFO_COLLECTION, USERS_COLLECTION
from api.deps import get_current_user, get_current_user_combined

# 配置日志
logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter(prefix="/system", tags=["系统监控"])

@router.get("/status", response_model=Dict[str, Any])
async def system_status(
    request: Request, current_user: str = Depends(get_current_user_combined)
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
    request: Request, current_user: str = Depends(get_current_user_combined)
):
    """
    获取数据库统计信息
    """
    try:
        # 获取数据库
        db = await get_database()
        
        # 获取各集合数据统计
        comments_count = await db[COMMENTS_COLLECTION].count_documents({})
        structured_comments_count = await db[STRUCTURED_COMMENTS_COLLECTION].count_documents({})
        notes_count = await db[NOTES_COLLECTION].count_documents({})
        notifications_count = await db[NOTIFICATIONS_COLLECTION].count_documents({})
        users_count = await db[USERS_COLLECTION].count_documents({})
        capture_rules_count = await db.capture_rules.count_documents({})
        
        # 网络数据统计
        try:
            network_requests_count = await db.network_requests.count_documents({})
            processed_network_requests = await db.network_requests.count_documents({"processed": True})
        except:
            network_requests_count = 0
            processed_network_requests = 0
        
        # 获取最近统计
        now = datetime.utcnow()
        yesterday = now - timedelta(days=1)
        last_week = now - timedelta(days=7)
        
        recent_comments = await db[COMMENTS_COLLECTION].count_documents({"fetch_time": {"$gte": yesterday}})
        recent_notes = await db[NOTES_COLLECTION].count_documents({"fetch_time": {"$gte": yesterday}})
        recent_notifications = await db[NOTIFICATIONS_COLLECTION].count_documents({"timestamp": {"$gte": yesterday}})
        recent_network_requests = await db.network_requests.count_documents({"received_at": {"$gte": yesterday}}) if hasattr(db, 'network_requests') else 0
        
        weekly_comments = await db[COMMENTS_COLLECTION].count_documents({"fetch_time": {"$gte": last_week}})
        weekly_notes = await db[NOTES_COLLECTION].count_documents({"fetch_time": {"$gte": last_week}})
        weekly_notifications = await db[NOTIFICATIONS_COLLECTION].count_documents({"timestamp": {"$gte": last_week}})
        weekly_network_requests = await db.network_requests.count_documents({"received_at": {"$gte": last_week}}) if hasattr(db, 'network_requests') else 0
        
        return {
            "total_stats": {
                "comments": comments_count,
                "structured_comments": structured_comments_count,
                "notes": notes_count,
                "notifications": notifications_count,
                "users": users_count,
                "capture_rules": capture_rules_count,
                "network_requests": network_requests_count,
                "processed_network_requests": processed_network_requests
            },
            "daily_stats": {
                "comments": recent_comments,
                "notes": recent_notes,
                "notifications": recent_notifications,
                "network_requests": recent_network_requests
            },
            "weekly_stats": {
                "comments": weekly_comments,
                "notes": weekly_notes,
                "notifications": weekly_notifications,
                "network_requests": weekly_network_requests
            },
            "processing_stats": {
                "network_processing_rate": round((processed_network_requests / network_requests_count * 100) if network_requests_count > 0 else 0, 2)
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
    获取系统版本信息
    """
    return {
        "version": "2.1.0",
        "api_version": "v1", 
        "build_date": "2024-12-01",
        "description": "小红书评论维护系统",
        "features": [
            "用户认证与管理",
            "评论数据采集与管理",
            "通知数据处理", 
            "笔记数据分析",
            "URL抓取规则管理",
            "网络数据智能处理",
            "系统监控与状态查询",
            "模块化架构设计"
        ],
        "modules": [
            "抓取规则管理",
            "网络数据处理",
            "系统监控",
            "用户管理",
            "内容管理"
        ]
    }

@router.get("/health", response_model=Dict[str, Any])
async def health_check():
    """
    健康检查接口
    
    无需认证的健康检查接口，用于负载均衡器和监控系统
    """
    try:
        # 简单的健康检查
        health_status = {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "service": "小红书评论维护系统",
            "version": "2.1.0"
        }
        
        # 检查数据库连接
        try:
            db = await get_database()
            await db.command("ping")
            health_status["database"] = "connected"
        except Exception as db_error:
            health_status["database"] = "disconnected"
            health_status["database_error"] = str(db_error)
            health_status["status"] = "degraded"
        
        # 检查系统资源
        try:
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            health_status["resources"] = {
                "memory_percent": memory.percent,
                "disk_percent": disk.percent
            }
            
            # 如果资源使用率过高，标记为警告
            if memory.percent > 90 or disk.percent > 90:
                health_status["status"] = "warning"
                health_status["warning"] = "High resource usage"
                
        except Exception as resource_error:
            health_status["resources"] = "unavailable"
            health_status["resource_error"] = str(resource_error)
        
        return health_status
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"服务不可用: {str(e)}"
        )

@router.get("/metrics")
async def get_system_metrics(
    current_user: str = Depends(get_current_user),
):
    """
    获取系统度量指标（Prometheus格式兼容）
    """
    try:
        # 获取数据库
        db = await get_database()
        
        # 收集各种度量指标
        now = datetime.utcnow()
        
        # 数据库度量
        total_comments = await db[COMMENTS_COLLECTION].count_documents({})
        total_notes = await db[NOTES_COLLECTION].count_documents({})
        total_users = await db[USERS_COLLECTION].count_documents({})
        
        # 网络数据度量
        total_network_requests = 0
        processed_network_requests = 0
        failed_network_requests = 0
        
        try:
            total_network_requests = await db.network_requests.count_documents({})
            processed_network_requests = await db.network_requests.count_documents({"processed": True})
            failed_network_requests = await db.network_requests.count_documents({"processed": False, "processing_error": {"$exists": True}})
        except:
            pass
        
        # 系统度量
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        cpu_percent = psutil.cpu_percent()
        
        metrics = {
            "timestamp": now.isoformat(),
            "database_metrics": {
                "total_comments": total_comments,
                "total_notes": total_notes,
                "total_users": total_users,
                "total_network_requests": total_network_requests,
                "processed_network_requests": processed_network_requests,
                "failed_network_requests": failed_network_requests,
                "processing_success_rate": round((processed_network_requests / total_network_requests * 100) if total_network_requests > 0 else 0, 2)
            },
            "system_metrics": {
                "memory_usage_percent": memory.percent,
                "memory_total_bytes": memory.total,
                "memory_used_bytes": memory.used,
                "disk_usage_percent": disk.percent,
                "disk_total_bytes": disk.total,
                "disk_used_bytes": disk.used,
                "cpu_usage_percent": cpu_percent
            }
        }
        
        return metrics
        
    except Exception as e:
        logger.exception("获取系统度量时发生错误")
        raise HTTPException(
            status_code=500,
            detail=f"获取系统度量失败: {str(e)}"
        ) 