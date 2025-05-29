"""
通知相关数据模型

包含通知消息结构、交互信息等数据结构
"""
from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime

from .common import UserInfo

# --- 通知相关模型 ---
class InteractionInfo(BaseModel):
    """互动信息模型"""
    type: Optional[str] = None
    time: Optional[str] = None

class NotificationItem(BaseModel):
    
    """通知项模型"""
    id: str
    tabType: Optional[str] = None
    userInfo: Optional[UserInfo] = None
    interaction: Optional[InteractionInfo] = None
    content: Optional[str] = None
    quoteContent: Optional[str] = None
    extraImage: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow) 