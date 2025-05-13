from fastapi import APIRouter, HTTPException, Depends, status, Body
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
from database import get_user_by_username, create_user, verify_user_password
from api.deps import get_current_user

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
async def get_otp_qrcode(username: str):
    """
    获取OTP二维码
    
    Args:
        username: 用户名
        
    Returns:
        OTP二维码图像
    """
    # 获取用户信息
    user = await get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    # 生成OTP URL
    otp_secret = user.get("otp_secret")
    if not otp_secret:
        raise HTTPException(status_code=400, detail="用户OTP密钥未配置")
    
    otp_url = pyotp.totp.TOTP(otp_secret).provisioning_uri(name=username, issuer_name="XHS评论系统")
    
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
async def get_current_user_info(current_user: str = Depends(get_current_user)):
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
