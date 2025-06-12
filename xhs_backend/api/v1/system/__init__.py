"""
系统管理域

包含系统配置、监控、抓取规则等功能
"""
from fastapi import APIRouter
from typing import Dict, Any

# 创建系统管理域的主路由
router = APIRouter(prefix="/system")

# 导入各个系统管理模块
from .monitoring import router as monitoring_router
from .capture_rules import router as capture_rules_router
from .network_data import router as network_data_router

# 添加便捷的health接口（代理到monitoring模块）
@router.get("/health", response_model=Dict[str, Any], summary="健康检查")
async def health_check():
    """
    健康检查接口（便捷路径）
    
    代理到 monitoring.health_check
    """
    from .monitoring import health_check as monitoring_health_check
    return await monitoring_health_check()

# 注册各个子模块路由
router.include_router(monitoring_router)
router.include_router(capture_rules_router)
router.include_router(network_data_router)

__all__ = ["router"] 