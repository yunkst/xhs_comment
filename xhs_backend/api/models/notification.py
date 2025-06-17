"""
通知相关数据模型

包含通知消息结构、交互信息等数据结构
"""
from typing import Optional, Dict
from pydantic import BaseModel, Field
from datetime import datetime

from .common import UserInfo

# --- 通知相关模型 ---
class InteractionInfo(BaseModel):
    """互动信息模型"""
    type: Optional[str] = None
    time: Optional[str] = None

class NotificationItem(BaseModel):
    """
    提及（Mention）类型的通知项模型
    用于存储从 /api/sns/web/v1/you/mentions 接口获取的数据
    """
    id: str = Field(..., description="通知的唯一ID")
    notification_name: Optional[str] = Field(None, description="通知类型名称，如 'COMMENT_MENTION'")
    title: Optional[str] = Field(None, description="通知标题，如 'XXX 回复了你的评论'")
    time: Optional[datetime] = Field(None, description="通知发生的时间")
    
    # 关联信息
    user_id: Optional[str] = Field(None, description="触发此通知的用户的ID")
    item_id: Optional[str] = Field(None, description="关联笔记的ID")
    comment_id: Optional[str] = Field(None, description="关联评论的ID")
    
    # 原始关联对象信息（用于上下文或冗余备份）
    user_info: Optional[UserInfo] = Field(None, description="触发此通知的用户信息")
    item_info: Optional[Dict] = Field(None, description="关联的笔记信息摘要")

    # 系统字段
    created_at: datetime = Field(default_factory=datetime.utcnow, description="记录创建时间")

    class Config:
        orm_mode = True 