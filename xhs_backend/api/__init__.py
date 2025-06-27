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
# 向后兼容接口 (插件专用)
# ========================

# 保留插件仍在使用的旧版接口
try:
    from .endpoints import user_notes
    
    # 注册插件仍在使用的旧版接口
    api_router.include_router(user_notes.router, prefix="/user-notes", tags=["用户备注(兼容)"])
    
except ImportError as e:
    # 如果导入失败，记录警告
    import logging
    logger = logging.getLogger(__name__)
    logger.warning(f"向后兼容接口导入失败: {e}")

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
- 插件使用的 /api/user-notes 接口保持兼容
- 其他旧版接口已迁移到v1版本
- 建议插件也迁移到新的v1接口

迁移信息: GET /api/v1/system/migrate-info
"""
