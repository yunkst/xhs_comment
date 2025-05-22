"""
内容相关数据模型

包含评论、笔记等内容数据结构
"""
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime

# --- 评论相关模型 (Raw) ---
class CommentItem(BaseModel):
    """原始评论数据模型"""
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
    replies: List['CommentItem'] = []
    fetchTimestamp: datetime = Field(default_factory=datetime.utcnow)

# --- 结构化评论模型 ---
class StructuredComment(BaseModel):
    """结构化的评论数据模型"""
    commentId: str  # 评论自身的ID
    noteId: Optional[str] = None  # 所属笔记ID
    content: Optional[str] = None  # 评论内容
    authorId: Optional[str] = None  # 评论作者ID
    authorName: Optional[str] = None  # 评论作者昵称
    authorAvatar: Optional[str] = None  # 评论作者头像
    timestamp: Optional[datetime] = None  # 解析后的评论时间
    repliedId: Optional[str] = None  # 回复的评论ID（父评论或兄弟评论）
    repliedOrder: Optional[int] = None  # 在父评论下的回复顺序 (从0开始)
    isRepliedByAuthor: Optional[bool] = None  # 是否被笔记作者回复
    fetchTimestamp: datetime = Field(default_factory=datetime.utcnow)  # 获取时间

# --- 笔记模型 ---
class Note(BaseModel):
    """笔记数据模型"""
    noteId: str  # 笔记ID
    noteContent: Optional[str] = None  # 笔记内容
    noteLike: Optional[int] = 0  # 点赞数
    noteCommitCount: Optional[int] = 0  # 评论数
    publishTime: Optional[datetime] = None  # 发布时间
    authorId: Optional[str] = None  # 作者ID
    title: Optional[str] = None  # 标题
    fetchTimestamp: datetime = Field(default_factory=datetime.utcnow)  # 获取时间

# 更新向前引用
CommentItem.update_forward_refs() 