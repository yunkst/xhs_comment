"""
向后兼容层

为保持现有API调用的兼容性，提供原有路径到新领域路径的重定向
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import RedirectResponse
import logging

# 配置日志
logger = logging.getLogger(__name__)

# 创建兼容性路由器
router = APIRouter(tags=["向后兼容"])

# 原有API路径到新路径的映射
REDIRECT_MAPPING = {
    # 系统管理域重定向
    "/api/system/capture-rules": "/api/v1/system/capture-rules",
    "/api/system/network-data": "/api/v1/system/network-data", 
    "/api/system/status": "/api/v1/system/monitoring/status",
    "/api/system/database-stats": "/api/v1/system/monitoring/database-stats",
    "/api/system/version": "/api/v1/system/monitoring/version",
    "/api/health": "/api/v1/system/monitoring/health",
    "/api/system/metrics": "/api/v1/system/monitoring/metrics",
    
    # 内容管理域重定向
    "/api/comments": "/api/v1/content/comments",
    "/api/notes": "/api/v1/content/notes",
    
    # 用户管理域重定向
    "/api/auth/sso-refresh": "/api/v1/user/auth/sso-refresh",
    "/api/auth/me": "/api/v1/user/auth/me",
    "/api/users": "/api/v1/user/profile",
    
    # 通知管理域重定向
    "/api/notifications": "/api/v1/notification/notifications"
}

@router.get("/api/migrate-info", summary="API迁移信息")
async def get_migration_info():
    """
    获取API迁移信息和新的路径映射
    """
    return {
        "message": "API已重构为领域驱动架构",
        "version": "v1",
        "migration_date": "2024-12-01",
        "domains": {
            "system": {
                "description": "系统管理域",
                "prefix": "/api/v1/system",
                "modules": ["capture-rules", "network-data", "monitoring"]
            },
            "content": {
                "description": "内容管理域", 
                "prefix": "/api/v1/content",
                "modules": ["comments", "notes"]
            },
            "user": {
                "description": "用户管理域",
                "prefix": "/api/v1/user", 
                "modules": ["auth", "profile"]
            },
            "notification": {
                "description": "通知管理域",
                "prefix": "/api/v1/notification",
                "modules": ["notifications"]
            }
        },
        "redirect_mapping": REDIRECT_MAPPING,
        "compatibility": {
            "status": "active",
            "deprecation_warning": "原有API路径将在下一个主版本中移除，请迁移到新的领域化路径",
            "support_until": "v3.0.0"
        }
    }

# 创建重定向路由
def create_redirect_routes():
    """
    动态创建重定向路由
    """
    for old_path, new_path in REDIRECT_MAPPING.items():
        # 为每个方法创建重定向
        for method in ["GET", "POST", "PUT", "DELETE", "PATCH"]:
            @router.api_route(old_path, methods=[method], include_in_schema=False)
            async def redirect_handler(request: Request, old=old_path, new=new_path):
                """动态重定向处理器"""
                # 保留查询参数
                query_string = str(request.url.query)
                redirect_url = new + ("?" + query_string if query_string else "")
                
                logger.warning(f"API重定向: {old} -> {new} (请更新到新路径)")
                
                # 返回永久重定向
                return RedirectResponse(
                    url=redirect_url,
                    status_code=308  # 永久重定向，保持HTTP方法
                )

# 执行路由创建
create_redirect_routes() 