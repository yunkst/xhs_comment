"""
用户认证

用户管理域 - 基础认证、SSO认证、令牌管理等功能
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from typing import Dict, Any, Optional
import logging
import os
import pyotp
import qrcode
import io
import base64
from fastapi.responses import StreamingResponse
import jwt as pyjwt
import bcrypt
from datetime import datetime, timedelta

from api.deps import get_current_user_combined
from api.models.user import UserInRegister, UserInLogin, TokenResponse
from api.services import (
    get_user_by_username,
    create_user, 
    verify_user_password
)

# 配置日志
logger = logging.getLogger(__name__)

# 从环境变量获取配置
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change_this_secret")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7天
ALLOW_REGISTER = os.getenv("ALLOW_REGISTER", "true").lower() == "true"

# 创建路由器
router = APIRouter()

def create_access_token(data: dict, expires_delta: timedelta = None):
    """创建JWT访问令牌"""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    encoded_jwt = pyjwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

@router.get("/register-status", summary="检查注册状态")
async def check_register_status():
    """
    检查系统是否允许注册
    
    Returns:
        注册状态信息
    """
    return {
        "allow_register": ALLOW_REGISTER,
        "message": "注册功能已开启" if ALLOW_REGISTER else "注册功能已关闭"
    }

@router.post("/register", response_model=TokenResponse, summary="注册新用户")
async def register(user_in: UserInRegister):
    """
    注册新用户 (新架构路径)
    
    Args:
        user_in: 用户注册信息
        
    Returns:
        访问令牌
    """
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

@router.post("/login", response_model=TokenResponse, summary="用户登录")
async def login(user_in: UserInLogin):
    """
    用户登录 (新架构路径)
    
    Args:
        user_in: 登录信息，包含用户名、密码和OTP代码
        
    Returns:
        访问令牌
    """
    # 验证用户名和密码
    user = await verify_user_password(user_in.username, user_in.password)
    if not user:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    
    # 校验OTP
    totp = pyotp.TOTP(user["otp_secret"])
    if not totp.verify(user_in.otp_code):
        raise HTTPException(status_code=401, detail="动态验证码错误")
    
    # 生成访问令牌
    access_token = create_access_token(data={"sub": user["username"]})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/otp-qrcode", summary="获取OTP二维码")
async def get_otp_qrcode(username: str = Query(..., description="用户名")):
    """
    获取指定用户名的OTP二维码 (新架构路径)
    
    Args:
        username: 用户名
        
    Returns:
        OTP二维码的base64编码和相关信息
    """
    try:
        # 检查用户是否存在，如果不存在则创建
        user = await get_user_by_username(username)
        if not user:
            # 用户不存在，为新用户生成密钥
            secret = pyotp.random_base32()
            logger.info(f"为新用户 {username} 生成OTP密钥")
        else:
            secret = user["otp_secret"]
        
        # 生成二维码
        totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(
            name=username,
            issuer_name="小红书评论维护系统"
        )
        
        # 创建二维码图像
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(totp_uri)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        # 将图像转为base64编码
        img_io = io.BytesIO()
        img.save(img_io, 'PNG')
        img_io.seek(0)
        img_base64 = base64.b64encode(img_io.getvalue()).decode('utf-8')
        
        return {
            "qrcode_url": f"data:image/png;base64,{img_base64}",
            "username": username,
            "issuer": "小红书评论维护系统",
            "message": "OTP二维码生成成功"
        }
        
    except Exception as e:
        logger.exception(f"生成OTP二维码时发生错误: {str(e)}")
        raise HTTPException(status_code=500, detail=f"生成二维码失败: {str(e)}")

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