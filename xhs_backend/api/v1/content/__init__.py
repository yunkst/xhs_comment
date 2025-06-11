"""
内容管理域

包含评论管理、笔记管理等内容相关功能
"""
from fastapi import APIRouter

# 导入各个内容管理模块
from .comments import router as comments_router
from .notes import router as notes_router

# 创建内容管理域的主路由
router = APIRouter(prefix="/content", tags=["内容管理"])

# 注册各个子模块路由
router.include_router(comments_router, prefix="/comments", tags=["评论管理"])
router.include_router(notes_router, prefix="/notes", tags=["笔记管理"])

__all__ = ["router"] 