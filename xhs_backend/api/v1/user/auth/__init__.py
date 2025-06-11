"""
用户认证模块

包含登录、注册、SSO认证等功能
"""
from fastapi import APIRouter

# 创建认证路由
router = APIRouter()

# 导入各个认证功能
from .sso import router as sso_router
from .login import router as login_router

# 包含各子模块路由
router.include_router(sso_router)
router.include_router(login_router)

__all__ = ["router"] 