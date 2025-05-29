"""
API V1 主路由

按领域驱动设计组织的模块化API架构
"""
from fastapi import APIRouter

# 导入各个领域模块
from .system import router as system_router
from .content import router as content_router
from .user import router as user_router
from .notification import router as notification_router

# 创建V1 API主路由
router = APIRouter(prefix="/v1", tags=["API V1"])

# 注册各个领域路由
router.include_router(system_router, tags=["系统管理域"])
router.include_router(content_router, tags=["内容管理域"])
router.include_router(user_router, tags=["用户管理域"])
router.include_router(notification_router, tags=["通知管理域"])

__all__ = ["router"] 