from __future__ import annotations # 必须在文件最开始
from typing import List, Optional, Dict, Any, Literal, Union
from pydantic import BaseModel, Field
from datetime import datetime

# --- 通用模型 ---
class UserInfo(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None
    avatar: Optional[str] = None
    url: Optional[str] = None
    tag: Optional[str] = None

# --- 通知相关模型 ---
class InteractionInfo(BaseModel):
    type: Optional[str] = None
    time: Optional[str] = None

class NotificationItem(BaseModel):
    id: str
    tabType: Optional[str] = None
    userInfo: Optional[UserInfo] = None
    interaction: Optional[InteractionInfo] = None
    content: Optional[str] = None
    quoteContent: Optional[str] = None
    extraImage: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

# --- 评论相关模型 (Raw) ---
class CommentItem(BaseModel):
    id: str
    noteId: Optional[str] = None
    authorName: Optional[str] = None
    authorUrl: Optional[str] = None
    authorAvatar: Optional[str] = None
    content: Optional[str] = None
    repliedToUser: Optional[str] = None
    timestamp: Optional[str] = None
    likeCount: Optional[str] = '0'
    ipLocation: Optional[str] = None
    replies: List[CommentItem] = []
    fetchTimestamp: datetime = Field(default_factory=datetime.utcnow)

# --- 新增：结构化评论模型 ---
class StructuredComment(BaseModel):
    commentId: str # 评论自身的ID
    noteId: Optional[str] = None # 所属笔记ID
    content: Optional[str] = None # 评论内容
    authorId: Optional[str] = None # 评论作者ID
    authorName: Optional[str] = None # 评论作者昵称
    authorAvatar: Optional[str] = None # 评论作者头像
    timestamp: Optional[datetime] = None # 解析后的评论时间
    repliedId: Optional[str] = None # 回复的评论ID（父评论或兄弟评论）
    repliedOrder: Optional[int] = None # 在父评论下的回复顺序 (从0开始)
    fetchTimestamp: datetime = Field(default_factory=datetime.utcnow) # 获取时间

# --- 新增：笔记模型 ---
class Note(BaseModel):
    noteId: str # 笔记ID
    noteContent: Optional[str] = None # 笔记内容
    noteLike: Optional[int] = 0 # 点赞数
    noteCommitCount: Optional[int] = 0 # 评论数
    publishTime: Optional[datetime] = None # 发布时间
    authorId: Optional[str] = None # 作者ID
    fetchTimestamp: datetime = Field(default_factory=datetime.utcnow) # 获取时间

# --- 传入数据负载模型 ---
class IncomingPayload(BaseModel):
    type: Literal["通知", "评论", "笔记"]
    data: List[Dict[str, Any]]

# --- 用户相关模型 ---
class User(BaseModel):
    username: str
    password_hash: str
    otp_secret: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserInRegister(BaseModel):
    username: str
    password: str

class UserInLogin(BaseModel):
    username: str
    password: str
    otp_code: str

class UserInDB(User):
    pass

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

# 更新向前引用
CommentItem.update_forward_refs() 