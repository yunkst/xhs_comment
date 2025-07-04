"""
用户相关数据模型

包含用户认证、用户备注等数据结构
"""
from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime

from .common import UserInfo

# --- 用户认证相关模型 ---
class User(BaseModel):
    """用户模型"""
    username: str
    password_hash: str
    otp_secret: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserInRegister(BaseModel):
    """用户注册请求模型"""
    username: str
    password: str

class UserInLogin(BaseModel):
    """用户登录请求模型"""
    username: str
    password: str
    otp_code: Optional[str] = None

class TokenResponse(BaseModel):
    """认证令牌响应模型"""
    access_token: str
    token_type: str = "bearer"

# --- 用户备注相关模型 ---
class UserNote(BaseModel):
    """用户备注模型"""
    userId: str  # 用户ID
    notificationHash: str  # 通知的唯一哈希值
    noteContent: str  # 备注内容
    content: Optional[str] = None  # 新增通知内容
    editor: Optional[str] = None # 编辑人
    updatedAt: datetime = Field(default_factory=datetime.utcnow)  # 更新时间 
    commentId: Optional[str] = None  # 关联的评论ID