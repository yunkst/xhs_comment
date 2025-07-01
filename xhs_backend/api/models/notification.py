"""
通知相关的数据模型

包含通知消息结构、交互信息等数据结构
"""
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

from .common import UserInfo

# --- 通知相关模型 ---
class InteractionInfo(BaseModel):
    """互动信息模型"""
    object_id: str = Field(..., description="互动对象的ID (如笔记ID)")
    type: str = Field(..., description="互动类型 (如 like_note, comment_note)")
    user: UserInfo = Field(..., description="发起互动的用户信息")
    content: Optional[str] = Field(None, description="互动内容 (如评论内容)")
    timestamp: datetime = Field(..., description="互动时间")

    class Config:
        orm_mode = True 