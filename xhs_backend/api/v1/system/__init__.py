"""
系统管理域

包含抓取规则管理、网络数据处理、系统监控等功能
"""
from fastapi import APIRouter

# 导入各个系统管理模块
from .capture_rules import router as capture_rules_router
from .network_data import router as network_data_router  
from .monitoring import router as monitoring_router

# 创建系统管理域的主路由
router = APIRouter(prefix="/system", tags=["系统管理"])

# 注册各个子模块路由
router.include_router(capture_rules_router, prefix="/capture-rules", tags=["抓取规则"])
router.include_router(network_data_router, prefix="/network-data", tags=["网络数据"])
router.include_router(monitoring_router, prefix="/monitoring", tags=["系统监控"])

__all__ = ["router"] 