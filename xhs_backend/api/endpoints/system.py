"""
系统管理相关端点 (向后兼容层)

此文件现在主要提供向后兼容性，实际功能已拆分到：
- capture_rules.py - 抓取规则管理
- network_data.py - 网络数据处理
- system_monitoring.py - 系统监控

新代码请使用拆分后的模块！
"""
from fastapi import APIRouter, HTTPException, Depends
import warnings
import logging

# 导入拆分后的路由器
from .capture_rules import router as capture_rules_router
from .network_data import router as network_data_router
from .system_monitoring import router as system_monitoring_router

# 配置日志
logger = logging.getLogger(__name__)

# 创建主路由器（向后兼容）
router = APIRouter()

# 发出弃用警告
warnings.warn(
    "直接使用 system.py 路由已弃用。请使用拆分后的模块：capture_rules, network_data, system_monitoring",
    DeprecationWarning,
    stacklevel=2
)

# === 向后兼容的路由重定向 ===

# 包含抓取规则路由（移除prefix以保持原有路径）
@router.get("/capture-rules")
async def get_capture_rules_compat(*args, **kwargs):
    """向后兼容：重定向到新的抓取规则模块"""
    from .capture_rules import get_capture_rules
    return await get_capture_rules(*args, **kwargs)

@router.get("/capture-rules/all")
async def get_all_capture_rules_compat(*args, **kwargs):
    """向后兼容：重定向到新的抓取规则模块"""
    from .capture_rules import get_all_capture_rules
    return await get_all_capture_rules(*args, **kwargs)

@router.post("/capture-rules")
async def create_capture_rule_compat(*args, **kwargs):
    """向后兼容：重定向到新的抓取规则模块"""
    from .capture_rules import create_capture_rule
    return await create_capture_rule(*args, **kwargs)

@router.put("/capture-rules/{rule_name}")
async def update_capture_rule_compat(*args, **kwargs):
    """向后兼容：重定向到新的抓取规则模块"""
    from .capture_rules import update_capture_rule
    return await update_capture_rule(*args, **kwargs)

@router.delete("/capture-rules/{rule_name}")
async def delete_capture_rule_compat(*args, **kwargs):
    """向后兼容：重定向到新的抓取规则模块"""
    from .capture_rules import delete_capture_rule
    return await delete_capture_rule(*args, **kwargs)

# 包含系统监控路由
@router.get("/status")
async def system_status_compat(*args, **kwargs):
    """向后兼容：重定向到新的系统监控模块"""
    from .system_monitoring import system_status
    return await system_status(*args, **kwargs)

@router.get("/database-stats")
async def database_stats_compat(*args, **kwargs):
    """向后兼容：重定向到新的系统监控模块"""
    from .system_monitoring import database_stats
    return await database_stats(*args, **kwargs)

@router.get("/version")
async def version_info_compat(*args, **kwargs):
    """向后兼容：重定向到新的系统监控模块"""
    from .system_monitoring import version_info
    return await version_info(*args, **kwargs)

@router.get("/health")
async def health_check_compat(*args, **kwargs):
    """向后兼容：重定向到新的系统监控模块"""
    from .system_monitoring import health_check
    return await health_check(*args, **kwargs)

# 包含网络数据路由
@router.post("/network-data")
async def receive_network_data_compat(*args, **kwargs):
    """向后兼容：重定向到新的网络数据模块"""
    from .network_data import receive_network_data
    return await receive_network_data(*args, **kwargs)

@router.post("/network-data/batch-process")
async def batch_process_network_data_compat(*args, **kwargs):
    """向后兼容：重定向到新的网络数据模块"""
    from .network_data import batch_process_network_data
    return await batch_process_network_data(*args, **kwargs)

@router.get("/network-data/stats")
async def get_network_data_stats_compat(*args, **kwargs):
    """向后兼容：重定向到新的网络数据模块"""
    from .network_data import get_network_data_stats
    return await get_network_data_stats(*args, **kwargs)

@router.get("/network-data")
async def get_network_data_compat(*args, **kwargs):
    """向后兼容：重定向到新的网络数据模块"""
    from .network_data import get_network_data
    return await get_network_data(*args, **kwargs)

# 记录模块拆分信息
logger.info("系统端点已模块化拆分 - 使用向后兼容模式")
logger.info("新模块：capture_rules.py, network_data.py, system_monitoring.py")
