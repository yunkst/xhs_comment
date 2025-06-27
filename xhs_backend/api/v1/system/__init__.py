"""
系统管理域

包含抓取规则、网络数据处理等功能
"""
from fastapi import APIRouter
from typing import Dict, Any

# 创建系统管理域的主路由
router = APIRouter(prefix="/system")

# 导入各个系统管理模块
from .capture_rules import router as capture_rules_router
from .network_data import router as network_data_router

# 添加简单的健康检查接口
@router.get("/health", response_model=Dict[str, Any], summary="健康检查")
async def health_check():
    """
    健康检查接口
    """
    return {
        "status": "healthy",
        "service": "xhs_backend",
        "version": "2.1.0",
        "timestamp": "2024-12-01"
    }

# 注册各个子模块路由
router.include_router(capture_rules_router)
router.include_router(network_data_router)

__all__ = ["router"] 