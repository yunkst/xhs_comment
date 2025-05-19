"""
通用数据模型定义

包含多个功能模块共用的基础数据结构
"""
from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime

# --- 通用模型 ---
class UserInfo(BaseModel):
    """用户基本信息模型"""
    id: Optional[str] = None
    name: Optional[str] = None
    avatar: Optional[str] = None
    url: Optional[str] = None
    tag: Optional[str] = None

# --- 传入数据负载模型 ---
class IncomingPayload(BaseModel):
    """API请求的数据负载模型"""
    type: str  # "通知", "评论", "笔记"
    data: list 