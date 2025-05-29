from fastapi import APIRouter

# 创建主路由
api_router = APIRouter()

# ========================
# 新的领域驱动架构 (推荐使用)
# ========================

# 导入V1 API主路由
from .v1 import router as v1_router

# 导入向后兼容层
from .v1.compatibility import router as compatibility_router

# 注册V1 API路由 (新的领域驱动架构)
api_router.include_router(v1_router, tags=["API V1 - 领域驱动架构"])

# 注册向后兼容路由
api_router.include_router(compatibility_router, tags=["向后兼容层"])

# ========================
# 原有架构 (兼容性保留)
# ========================

# 项目结构说明：
# - models包: 存放数据模型定义
# - services包: 存放业务逻辑和服务功能
# - endpoints包: 存放API端点定义和路由
# 
# 以上包都不需要在这里直接导入，它们会在各模块中按需导入

# 在运行时导入各个端点路由 (保留现有功能)
try:
    from .endpoints import users, comments, notes, notifications, system, user_notes, keycloak_auth
    
    # 导入新拆分的模块
    from .endpoints import capture_rules, network_data, system_monitoring
    
    # 注册各模块路由 (保持原有路径)
    api_router.include_router(users.router, prefix="/users", tags=["用户(原有)"])
    api_router.include_router(comments.router, prefix="/comments", tags=["评论(原有)"])
    api_router.include_router(notes.router, prefix="/notes", tags=["笔记(原有)"])
    api_router.include_router(notifications.router, prefix="/notifications", tags=["通知(原有)"])
    
    # 注册新拆分的功能模块（推荐使用）
    api_router.include_router(capture_rules.router, prefix="/system", tags=["抓取规则管理(原有)"])
    api_router.include_router(network_data.router, prefix="/system", tags=["网络数据处理(原有)"])
    api_router.include_router(system_monitoring.router, prefix="/system", tags=["系统监控(原有)"])
    
    # 保持向后兼容的系统路由（已弃用，建议使用上面的新模块）
    api_router.include_router(system.router, prefix="/system", tags=["系统(兼容层)"])
    
    api_router.include_router(user_notes.router, prefix="/user-notes", tags=["用户备注(原有)"])
    api_router.include_router(keycloak_auth.router, prefix="/auth", tags=["SSO认证(原有)"])
    
    # 添加不符合RESTful路径风格的特殊路由
    from .endpoints.users import router as users_router
    api_router.include_router(users_router, tags=["认证(原有)"])  # 用于/login和/register等特殊路径

except ImportError as e:
    # 如果原有模块导入失败，只使用新架构
    import logging
    logger = logging.getLogger(__name__)
    logger.warning(f"原有模块导入失败，仅使用新架构: {e}")

# ========================
# 架构迁移说明
# ========================
"""
API架构已重构为领域驱动设计 (DDD)：

新架构路径:
- 系统管理: /api/v1/system/*
- 内容管理: /api/v1/content/*  
- 用户管理: /api/v1/user/*
- 通知管理: /api/v1/notification/*

向后兼容:
- 原有路径自动重定向到新路径
- 兼容性支持将在 v3.0.0 移除
- 请尽快迁移到新的领域化路径

迁移信息: GET /api/migrate-info
"""
