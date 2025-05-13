from fastapi import APIRouter

# 创建主路由
api_router = APIRouter()

# 在运行时导入各个端点路由
from .endpoints import users, comments, notes, notifications, system

# 注册各模块路由
api_router.include_router(users.router, prefix="/users", tags=["用户"])
api_router.include_router(comments.router, prefix="/comments", tags=["评论"])
api_router.include_router(notes.router, prefix="/notes", tags=["笔记"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["通知"])
api_router.include_router(system.router, prefix="/system", tags=["系统"])

# 添加不符合RESTful路径风格的特殊路由
from .endpoints.users import router as users_router
api_router.include_router(users_router, tags=["认证"])  # 用于/login和/register等特殊路径
