"""
登录和注册功能

提供用户登录、注册等基础认证功能
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from typing import Dict, Any, Optional
import logging

# 导入原有功能模块
from api.models.user import UserInRegister, UserInLogin, TokenResponse
from api.deps import get_current_user_combined
from api.v1.user.auth import router as auth_router

# 配置日志
logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter()

@router.post("/login", response_model=TokenResponse, summary="用户登录")
async def login(user_in: UserInLogin):
    """
    用户登录 (v1版本)
    
    Args:
        user_in: 登录信息，包含用户名、密码和OTP代码
        
    Returns:
        访问令牌
    """
    # 导入在函数内避免循环引用
    from api.v1.user.auth.token import create_access_token
    from api.services import verify_user_password
    
    # 验证用户名和密码
    user = await verify_user_password(user_in.username, user_in.password)
    if not user:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    
    # 校验OTP
    import pyotp
    totp = pyotp.TOTP(user["otp_secret"])
    if not totp.verify(user_in.otp_code):
        raise HTTPException(status_code=401, detail="动态验证码错误")
    
    # 生成访问令牌
    access_token = create_access_token(data={"sub": user["username"]})
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/register", response_model=TokenResponse, summary="注册新用户")
async def register(user_in: UserInRegister):
    """
    注册新用户 (v1版本)
    
    Args:
        user_in: 用户注册信息
        
    Returns:
        访问令牌
    """
    # 导入在函数内避免循环引用
    import os
    from api.v1.user.auth.token import create_access_token
    from api.services import get_user_by_username, create_user
    
    # 从环境变量获取配置
    ALLOW_REGISTER = os.getenv("ALLOW_REGISTER", "true").lower() == "true"
    
    logger.info(f"用户注册请求: username={user_in.username}")
    
    if not ALLOW_REGISTER:
        logger.warning(f"注册功能已关闭，拒绝用户 {user_in.username} 的注册请求")
        raise HTTPException(status_code=403, detail="注册功能已关闭")
    
    try:
        # 检查用户是否已存在
        existing_user = await get_user_by_username(user_in.username)
        if existing_user:
            logger.warning(f"用户名已存在: {user_in.username}")
            raise HTTPException(status_code=400, detail="用户名已存在")
        
        # 创建新用户 - 转为字典传递给database函数
        user_data = {"username": user_in.username, "password": user_in.password}
        user = await create_user(user_data, allow_register=ALLOW_REGISTER)
        
        logger.info(f"用户注册成功: username={user_in.username}")
        
        # 注册后直接登录
        access_token = create_access_token(data={"sub": user["username"]})
        return {"access_token": access_token, "token_type": "bearer"}
        
    except HTTPException:
        # 重新抛出HTTP异常
        raise
    except Exception as e:
        logger.exception(f"用户注册时发生错误: username={user_in.username}, error={str(e)}")
        raise HTTPException(status_code=500, detail=f"注册失败: {str(e)}")

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