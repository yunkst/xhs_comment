from fastapi import APIRouter, HTTPException, Depends, status, Body, Query, Request
from fastapi.security import OAuth2PasswordBearer
from typing import Dict, Any, List
import os
import logging
from datetime import datetime, timedelta
import pyotp
import qrcode
import io
from fastapi.responses import StreamingResponse
from jose import jwt

from models import UserInRegister, UserInLogin, TokenResponse
from database import get_user_by_username, create_user, verify_user_password, get_user_info, batch_get_user_info, get_all_user_info_paginated
from api.deps import get_current_user, get_current_user_combined, PaginationParams, get_pagination

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
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# 注册接口
@router.post("/register", response_model=TokenResponse, tags=["认证"])
async def register(user_in: UserInRegister):
    """
    注册新用户
    
    Args:
        user_in: 用户注册信息
        
    Returns:
        访问令牌
    """
    if not ALLOW_REGISTER:
        raise HTTPException(status_code=403, detail="注册功能已关闭")
    
    # 检查用户是否已存在
    existing_user = await get_user_by_username(user_in.username)
    if existing_user:
        raise HTTPException(status_code=400, detail="用户名已存在")
    
    # 创建新用户
    user = await create_user(user_in, allow_register=ALLOW_REGISTER)
    
    # 注册后直接登录
    access_token = create_access_token(data={"sub": user["username"]})
    return {"access_token": access_token, "token_type": "bearer"}

# 登录接口
@router.post("/login", response_model=TokenResponse, tags=["认证"])
async def login(user_in: UserInLogin):
    """
    用户登录
    
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

# OTP二维码生成接口
@router.get("/otp-qrcode", tags=["用户"])
async def get_otp_qrcode(request: Request, current_user: str = Depends(get_current_user_combined)):
    """
    获取当前登录用户的OTP二维码
    
    Args:
        current_user: 当前用户名
        
    Returns:
        OTP二维码图像
    """
    # 获取用户信息
    user = await get_user_by_username(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    # 生成OTP URL
    otp_secret = user.get("otp_secret")
    if not otp_secret:
        raise HTTPException(status_code=400, detail="用户OTP密钥未配置")
    
    otp_url = pyotp.totp.TOTP(otp_secret).provisioning_uri(name=current_user, issuer_name="XHS评论系统")
    
    # 生成二维码
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(otp_url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # 将图像保存到内存缓冲区
    buf = io.BytesIO()
    img.save(buf)
    buf.seek(0)
    
    # 返回图像
    return StreamingResponse(buf, media_type="image/png")

# 获取当前用户信息
@router.get("/me", tags=["用户"])
async def get_current_user_info(request: Request, current_user: str = Depends(get_current_user_combined)):
    """
    获取当前登录用户信息
    
    Args:
        current_user: 当前用户名
        
    Returns:
        用户信息
    """
    user = await get_user_by_username(current_user)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    # 移除敏感信息
    if "password_hash" in user:
        del user["password_hash"]
    if "otp_secret" in user:
        del user["otp_secret"]
        
    return user

# 小红书用户信息相关API

@router.get("/info/list", tags=["小红书用户"])
async def list_xhs_users(
    request: Request,
    pagination: PaginationParams = Depends(get_pagination),
    current_user: str = Depends(get_current_user_combined)
):
    """
    分页获取小红书用户信息列表

    Args:
        pagination: 分页参数
        current_user: 当前认证用户名

    Returns:
        分页的用户信息列表
    """
    logger.info(f"分页查询小红书用户信息: page={pagination.page}, page_size={pagination.page_size}")
    
    user_data = await get_all_user_info_paginated(page=pagination.page, page_size=pagination.page_size)
    
    return {
        "success": True,
        "message": "获取用户列表成功",
        "data": user_data
    }

@router.get("/info/{user_id}", tags=["小红书用户"])
async def get_xhs_user_info(
    user_id: str,
    request: Request,
    current_user: str = Depends(get_current_user_combined)
):
    """
    获取小红书用户的信息
    
    Args:
        user_id: 小红书用户ID
        current_user: 当前认证用户名
        
    Returns:
        用户信息或404
    """
    logger.info(f"查询小红书用户信息: userId={user_id}")
    
    user_info = await get_user_info(user_id)
    if not user_info:
        raise HTTPException(status_code=404, detail="未找到该用户信息")
    
    return {
        "success": True,
        "message": "获取用户信息成功",
        "data": user_info
    }

@router.get("/info", tags=["小红书用户"])
async def get_multiple_xhs_user_info(
    request: Request,
    user_ids: str = Query(..., description="逗号分隔的用户ID列表"),
    current_user: str = Depends(get_current_user_combined)
):
    """
    批量获取多个小红书用户的信息
    
    Args:
        user_ids: 逗号分隔的小红书用户ID列表
        current_user: 当前认证用户名
        
    Returns:
        用户信息映射
    """
    user_id_list = user_ids.split(',')
    logger.info(f"批量查询小红书用户信息: userIds={user_id_list}")
    
    if not user_id_list:
        return {
            "success": True,
            "message": "未提供有效的用户ID列表",
            "data": {}
        }
    
    user_infos = await batch_get_user_info(user_id_list)
    
    return {
        "success": True,
        "message": f"获取到 {len(user_infos)} 个用户信息",
        "data": user_infos
    }
