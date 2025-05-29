"""
通知管理域

包含通知消息管理等功能
"""
from fastapi import APIRouter

# 导入通知管理模块
from .notifications import router as notifications_router

# 创建通知管理域的主路由
router = APIRouter(prefix="/notification", tags=["通知管理"])

# 注册通知模块路由
router.include_router(notifications_router, prefix="/notifications", tags=["通知消息"])

__all__ = ["router"] 