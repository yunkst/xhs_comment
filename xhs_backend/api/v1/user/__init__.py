"""
用户管理域

包含用户认证、用户管理等功能
"""
from fastapi import APIRouter

# 导入各个用户管理模块
from .auth import router as auth_router
from .profile import router as profile_router

# 创建用户管理域的主路由
router = APIRouter(prefix="/user", tags=["用户管理"])

# 注册各个子模块路由
router.include_router(auth_router, prefix="/auth", tags=["用户认证"])
router.include_router(profile_router, prefix="/profile", tags=["用户资料"])

__all__ = ["router"] 