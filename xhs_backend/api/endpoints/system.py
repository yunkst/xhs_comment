"""
系统管理相关端点

提供系统状态查询、配置管理、抓取规则管理等功能
"""
from fastapi import APIRouter, HTTPException, Depends, status, Request
from typing import Dict, Any, List
import logging
import os
import psutil
import platform
from datetime import datetime, timedelta

from database import get_database, COMMENTS_COLLECTION, NOTES_COLLECTION, NOTIFICATIONS_COLLECTION, STRUCTURED_COMMENTS_COLLECTION, USER_INFO_COLLECTION, USERS_COLLECTION
from api.deps import get_current_user_combined
from api.models.common import CaptureRule, CaptureRulesResponse, NetworkDataPayload

# 配置日志
logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter()

# 默认抓取规则配置
DEFAULT_CAPTURE_RULES = [
    {
        "name": "通知接口",
        "pattern": "*/api/sns/web/v1/notify/*",
        "enabled": True,
        "description": "小红书通知相关API",
        "data_type": "notification",
        "priority": 10
    },
    {
        "name": "评论接口",
        "pattern": "*/api/sns/web/v1/comment/*",
        "enabled": True,
        "description": "小红书评论相关API",
        "data_type": "comment",
        "priority": 10
    },
    {
        "name": "用户信息接口",
        "pattern": "*/api/sns/web/v1/user/*",
        "enabled": True,
        "description": "小红书用户信息API",
        "data_type": "user",
        "priority": 8
    },
    {
        "name": "笔记内容接口",
        "pattern": "*/api/sns/web/v1/feed/*",
        "enabled": True,
        "description": "小红书笔记内容API",
        "data_type": "note",
        "priority": 9
    },
    {
        "name": "搜索接口",
        "pattern": "*/api/sns/web/v1/search/*",
        "enabled": True,
        "description": "小红书搜索API",
        "data_type": "search",
        "priority": 5
    },
    {
        "name": "热门推荐接口",
        "pattern": "*/api/sns/web/v1/homefeed/*",
        "enabled": True,
        "description": "小红书首页推荐API",
        "data_type": "recommendation",
        "priority": 3
    }
]

# === 抓取规则管理接口 ===

@router.get("/capture-rules", response_model=CaptureRulesResponse)
async def get_capture_rules(db=Depends(get_database)):
    """
    获取URL抓取规则配置
    
    此接口供插件调用，获取需要监控的URL规则
    无需认证，以便插件快速获取配置
    """
    try:
        # 从数据库获取抓取规则
        collection = db.capture_rules
        
        # 如果数据库中没有规则，初始化默认规则
        if await collection.count_documents({}) == 0:
            # 插入默认规则
            rules_to_insert = []
            for rule_data in DEFAULT_CAPTURE_RULES:
                rule_data['created_at'] = datetime.utcnow()
                rule_data['updated_at'] = datetime.utcnow()
                rules_to_insert.append(rule_data)
            
            await collection.insert_many(rules_to_insert)
        
        # 查询启用的规则，按优先级排序
        rules_cursor = collection.find(
            {"enabled": True}
        ).sort("priority", -1)
        
        rules = []
        async for rule_doc in rules_cursor:
            # 移除MongoDB的_id字段
            rule_doc.pop('_id', None)
            rules.append(CaptureRule(**rule_doc))
        
        return CaptureRulesResponse(
            success=True,
            rules=rules,
            total_count=len(rules),
            message=f"成功获取 {len(rules)} 条抓取规则"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取抓取规则失败: {str(e)}"
        )

@router.get("/capture-rules/all", response_model=CaptureRulesResponse)
async def get_all_capture_rules(
    current_user: str = Depends(get_current_user_combined),
    db=Depends(get_database)
):
    """
    获取所有抓取规则（包括禁用的）
    
    管理员接口，需要认证
    """
    try:
        collection = db.capture_rules
        
        # 查询所有规则，按优先级排序
        rules_cursor = collection.find().sort("priority", -1)
        
        rules = []
        async for rule_doc in rules_cursor:
            rule_doc.pop('_id', None)
            rules.append(CaptureRule(**rule_doc))
        
        return CaptureRulesResponse(
            success=True,
            rules=rules,
            total_count=len(rules),
            message=f"成功获取 {len(rules)} 条抓取规则"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取抓取规则失败: {str(e)}"
        )

@router.post("/capture-rules")
async def create_capture_rule(
    rule: CaptureRule,
    current_user: str = Depends(get_current_user_combined),
    db=Depends(get_database)
):
    """
    创建新的抓取规则
    
    管理员接口，需要认证
    """
    try:
        collection = db.capture_rules
        
        # 检查规则名称是否已存在
        existing_rule = await collection.find_one({"name": rule.name})
        if existing_rule:
            raise HTTPException(
                status_code=400,
                detail=f"规则名称 '{rule.name}' 已存在"
            )
        
        # 插入新规则
        rule_dict = rule.dict()
        rule_dict['created_at'] = datetime.utcnow()
        rule_dict['updated_at'] = datetime.utcnow()
        
        result = await collection.insert_one(rule_dict)
        
        return {
            "success": True,
            "message": f"成功创建抓取规则: {rule.name}",
            "rule_id": str(result.inserted_id)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"创建抓取规则失败: {str(e)}"
        )

@router.put("/capture-rules/{rule_name}")
async def update_capture_rule(
    rule_name: str,
    rule_update: CaptureRule,
    current_user: str = Depends(get_current_user_combined),
    db=Depends(get_database)
):
    """
    更新抓取规则
    
    管理员接口，需要认证
    """
    try:
        collection = db.capture_rules
        
        # 更新规则
        rule_dict = rule_update.dict()
        rule_dict['updated_at'] = datetime.utcnow()
        
        result = await collection.update_one(
            {"name": rule_name},
            {"$set": rule_dict}
        )
        
        if result.matched_count == 0:
            raise HTTPException(
                status_code=404,
                detail=f"未找到规则: {rule_name}"
            )
        
        return {
            "success": True,
            "message": f"成功更新抓取规则: {rule_name}",
            "modified_count": result.modified_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"更新抓取规则失败: {str(e)}"
        )

@router.delete("/capture-rules/{rule_name}")
async def delete_capture_rule(
    rule_name: str,
    current_user: str = Depends(get_current_user_combined),
    db=Depends(get_database)
):
    """
    删除抓取规则
    
    管理员接口，需要认证
    """
    try:
        collection = db.capture_rules
        
        result = await collection.delete_one({"name": rule_name})
        
        if result.deleted_count == 0:
            raise HTTPException(
                status_code=404,
                detail=f"未找到规则: {rule_name}"
            )
        
        return {
            "success": True,
            "message": f"成功删除抓取规则: {rule_name}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"删除抓取规则失败: {str(e)}"
        )

# === 系统状态接口 ===

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
                "users": users_count,
                "capture_rules": capture_rules_count
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
    获取系统版本信息
    """
    return {
        "version": "2.0.0",
        "api_version": "v1", 
        "build_date": "2024-12-01",
        "description": "小红书评论维护系统",
        "features": [
            "用户认证与管理",
            "评论数据采集与管理",
            "通知数据处理", 
            "笔记数据分析",
            "URL抓取规则管理",
            "系统监控与状态查询"
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
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "service": "小红书评论维护系统",
            "version": "2.0.0"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"服务不可用: {str(e)}"
        )

# === 网络数据接收接口 ===

@router.post("/network-data")
async def receive_network_data(
    data: NetworkDataPayload,
    db=Depends(get_database)
):
    """
    接收插件发送的网络请求数据
    
    插件无需认证即可发送数据，方便数据采集
    """
    try:
        # 保存原始网络数据
        network_data_dict = data.dict()
        network_data_dict['received_at'] = datetime.utcnow()
        
        # 保存到网络数据集合
        result = await db.network_requests.insert_one(network_data_dict)
        
        return {
            "success": True,
            "message": f"成功接收网络数据，规则: {data.rule_name}",
            "data_id": str(result.inserted_id),
            "rule_name": data.rule_name,
            "url": data.url
        }
        
    except Exception as e:
        logger.exception("接收网络数据时发生错误")
        raise HTTPException(
            status_code=500,
            detail=f"接收网络数据失败: {str(e)}"
        )

@router.get("/network-data")
async def get_network_data(
    page: int = 1,
    page_size: int = 20,
    rule_name: str = None,
    data_type: str = None,
    start_time: str = None,
    end_time: str = None,
    current_user: str = Depends(get_current_user_combined),
    db=Depends(get_database)
):
    """
    查询网络请求数据
    
    管理员接口，需要认证
    """
    try:
        collection = db.network_requests
        
        # 构建查询条件
        query = {}
        
        if rule_name:
            query['rule_name'] = rule_name
            
        if data_type:
            query['data_type'] = data_type
            
        if start_time and end_time:
            try:
                start_dt = datetime.strptime(start_time, "%Y-%m-%d %H:%M:%S")
                end_dt = datetime.strptime(end_time, "%Y-%m-%d %H:%M:%S")
                query['received_at'] = {
                    "$gte": start_dt,
                    "$lte": end_dt
                }
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail="时间格式错误，请使用 YYYY-MM-DD HH:MM:SS 格式"
                )
        
        # 计算分页
        skip = (page - 1) * page_size
        
        # 查询数据
        cursor = collection.find(query).sort("received_at", -1).skip(skip).limit(page_size)
        data_list = []
        
        async for doc in cursor:
            doc['_id'] = str(doc['_id'])
            data_list.append(doc)
        
        # 获取总数
        total = await collection.count_documents(query)
        
        # 统计数据
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        hour_ago = now - timedelta(hours=1)
        
        total_requests = await collection.count_documents({})
        today_requests = await collection.count_documents({"received_at": {"$gte": today_start}})
        recent_hour_requests = await collection.count_documents({"received_at": {"$gte": hour_ago}})
        
        # 获取活跃规则数
        active_rules_pipeline = [
            {"$group": {"_id": "$rule_name"}},
            {"$count": "count"}
        ]
        active_rules_result = []
        async for result in collection.aggregate(active_rules_pipeline):
            active_rules_result.append(result)
        active_rules_count = active_rules_result[0]["count"] if active_rules_result else 0
        
        # 获取所有可用规则
        available_rules_pipeline = [
            {"$group": {"_id": "$rule_name"}},
            {"$project": {"rule_name": "$_id", "_id": 0}}
        ]
        available_rules_result = []
        async for result in collection.aggregate(available_rules_pipeline):
            available_rules_result.append(result)
        available_rules = [item["rule_name"] for item in available_rules_result]
        
        return {
            "success": True,
            "data": data_list,
            "total": total,
            "page": page,
            "page_size": page_size,
            "stats": {
                "total": total_requests,
                "today": today_requests,
                "recent_hour": recent_hour_requests,
                "active_rules": active_rules_count
            },
            "available_rules": available_rules,
            "message": f"成功获取 {len(data_list)} 条网络数据"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("查询网络数据时发生错误")
        raise HTTPException(
            status_code=500,
            detail=f"查询网络数据失败: {str(e)}"
        )

# === 系统设置管理接口 ===

@router.get("/settings")
async def get_system_settings(
    current_user: str = Depends(get_current_user_combined),
    db=Depends(get_database)
):
    """
    获取系统设置
    """
    try:
        collection = db.system_settings
        settings = await collection.find_one({"type": "system"}) or {}
        
        # 移除MongoDB的_id字段
        settings.pop('_id', None)
        
        # 提供默认设置
        default_settings = {
            "passwordExpiration": 90,
            "loginLockEnabled": True,
            "loginLockThreshold": 5,
            "loginLockTime": 30,
            "sessionTimeout": 120,
            "enableNotifications": True,
            "notificationEmail": "",
            "maxFileSize": 100,  # MB
            "allowedFileTypes": [".jpg", ".png", ".pdf", ".txt"],
            "backupRetentionDays": 30
        }
        
        # 合并默认设置和数据库设置
        result_settings = {**default_settings, **settings}
        result_settings.pop('type', None)  # 移除内部字段
        
        return {
            "success": True,
            "data": result_settings,
            "message": "成功获取系统设置"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取系统设置失败: {str(e)}"
        )

@router.put("/settings")
async def update_system_settings(
    settings: Dict[str, Any],
    current_user: str = Depends(get_current_user_combined),
    db=Depends(get_database)
):
    """
    更新系统设置
    """
    try:
        collection = db.system_settings
        
        # 添加更新时间和类型标识
        settings_data = {
            **settings,
            "type": "system",
            "updated_at": datetime.utcnow(),
            "updated_by": current_user
        }
        
        # 更新或插入设置
        result = await collection.update_one(
            {"type": "system"},
            {"$set": settings_data},
            upsert=True
        )
        
        return {
            "success": True,
            "message": "系统设置更新成功",
            "modified_count": result.modified_count
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"更新系统设置失败: {str(e)}"
        )

@router.post("/backup")
async def backup_data(
    current_user: str = Depends(get_current_user_combined),
    db=Depends(get_database)
):
    """
    备份系统数据
    """
    try:
        import json
        from datetime import datetime
        
        # 生成备份文件名
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"backup_{timestamp}.json"
        
        # 收集要备份的数据
        backup_data = {
            "created_at": datetime.utcnow().isoformat(),
            "created_by": current_user,
            "version": "1.0.0",
            "collections": {}
        }
        
        # 备份主要集合
        collections_to_backup = [
            COMMENTS_COLLECTION,
            NOTES_COLLECTION,
            NOTIFICATIONS_COLLECTION,
            STRUCTURED_COMMENTS_COLLECTION,
            USER_INFO_COLLECTION,
            "system_settings",
            "capture_rules"
        ]
        
        for collection_name in collections_to_backup:
            collection = db[collection_name]
            documents = []
            
            async for doc in collection.find():
                # 转换ObjectId为字符串
                if '_id' in doc:
                    doc['_id'] = str(doc['_id'])
                documents.append(doc)
            
            backup_data["collections"][collection_name] = documents
        
        # 保存备份记录到数据库
        backup_record = {
            "filename": backup_filename,
            "created_at": datetime.utcnow(),
            "created_by": current_user,
            "size": len(json.dumps(backup_data)),
            "collections_count": len(collections_to_backup),
            "total_documents": sum(len(docs) for docs in backup_data["collections"].values())
        }
        
        await db.backup_history.insert_one(backup_record)
        
        return {
            "success": True,
            "message": "数据备份成功",
            "filename": backup_filename,
            "backup_info": {
                "collections_count": backup_record["collections_count"],
                "total_documents": backup_record["total_documents"],
                "size": backup_record["size"]
            }
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"数据备份失败: {str(e)}"
        )

@router.get("/backup/history")
async def get_backup_history(
    current_user: str = Depends(get_current_user_combined),
    db=Depends(get_database)
):
    """
    获取备份历史
    """
    try:
        collection = db.backup_history
        
        # 查询备份历史，按创建时间倒序
        backup_history = []
        async for backup in collection.find().sort("created_at", -1):
            backup['_id'] = str(backup['_id'])
            backup_history.append(backup)
        
        return {
            "success": True,
            "data": backup_history,
            "total": len(backup_history),
            "message": f"成功获取 {len(backup_history)} 条备份记录"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取备份历史失败: {str(e)}"
        )
