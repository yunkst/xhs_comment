"""
用户认证

用户管理域 - SSO认证、令牌管理等功能
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Dict, Any
import logging

from api.deps import get_current_user_combined
# from api.auth.sso_refresh import router as sso_router # Commented out due to ModuleNotFoundError

# 配置日志
logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter()

# 包含SSO认证路由
# router.include_router(sso_router, tags=["SSO认证"]) # Commented out due to ModuleNotFoundError

@router.get("/me", summary="获取当前用户信息")
async def get_current_user_info(
    request: Request, 
    current_user: str = Depends(get_current_user_combined)
):
    """
    获取当前登录用户的信息
    """
    try:
        return {
            "success": True,
            "user": {
                "username": current_user,
                "authenticated": True,
                "login_time": request.state.get("login_time"),
                "roles": ["user"]  # 可以根据需要扩展角色系统
            },
            "message": "成功获取用户信息"
        }
    except Exception as e:
        logger.exception("获取用户信息时发生错误")
        raise HTTPException(
            status_code=500,
            detail=f"获取用户信息失败: {str(e)}"
        ) 