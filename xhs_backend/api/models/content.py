"""
内容相关数据模型

包含评论、笔记等内容数据结构
"""
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field
from datetime import datetime

# --- 新增模型 ---
class IllegalInfo(BaseModel):
    """违规信息模型"""
    illegal_type: Optional[int] = None
    illegal_text: Optional[str] = None

# --- 小红书笔记详情模型 ---
class XhsVideoStream(BaseModel):
    """视频流信息"""
    
    class Config:
        extra = "allow"
    duration: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    avgBitrate: Optional[int] = None
    qualityType: Optional[str] = None
    size: Optional[int] = None
    masterUrl: Optional[str] = None
    backupUrls: Optional[List[str]] = []
    format: Optional[str] = None
    videoCodec: Optional[str] = None
    audioCodec: Optional[str] = None
    fps: Optional[int] = None
    
    # 补充可能的额外字段
    videoDuration: Optional[int] = None
    audioDuration: Optional[int] = None
    audioChannels: Optional[int] = None
    videoBitrate: Optional[int] = None
    audioBitrate: Optional[int] = None
    streamType: Optional[int] = None
    streamDesc: Optional[str] = None
    weight: Optional[int] = None
    rotate: Optional[int] = None
    hdrType: Optional[int] = None
    defaultStream: Optional[int] = None
    ssim: Optional[float] = None
    vmaf: Optional[float] = None
    psnr: Optional[float] = None
    volume: Optional[float] = None
    resolution: Optional[int] = None

class XhsVideoInfo(BaseModel):
    """视频信息"""
    
    class Config:
        extra = "allow"
    videoId: Optional[Union[int, str]] = None  # 支持大整数，使用Union类型
    duration: Optional[int] = None
    md5: Optional[str] = None
    streamTypes: Optional[List[int]] = []
    h264: Optional[List[XhsVideoStream]] = []
    h265: Optional[List[XhsVideoStream]] = []
    h266: Optional[List[XhsVideoStream]] = []
    av1: Optional[List[XhsVideoStream]] = []
    firstFrameFileid: Optional[str] = None
    thumbnailFileid: Optional[str] = None

class XhsImageInfo(BaseModel):
    """图片信息"""
    
    class Config:
        extra = "allow"
    urlPre: Optional[str] = None
    urlDefault: Optional[str] = None
    height: Optional[int] = None
    width: Optional[int] = None
    livePhoto: Optional[bool] = False
    fileId: Optional[str] = None
    infoList: Optional[List[Dict[str, Any]]] = []  # 改为Any类型支持更复杂结构
    
    # 补充可能的额外字段
    url: Optional[str] = None
    traceId: Optional[str] = None
    stream: Optional[Dict[str, Any]] = None

class XhsTagInfo(BaseModel):
    """话题标签信息"""
    id: Optional[str] = None
    name: Optional[str] = None
    type: Optional[str] = None

class XhsUserInfo(BaseModel):
    """用户信息"""
    
    class Config:
        extra = "allow"
    userId: Optional[str] = None
    nickname: Optional[str] = None
    avatar: Optional[str] = None
    xsecToken: Optional[str] = None

class XhsInteractInfo(BaseModel):
    """互动信息"""
    
    class Config:
        extra = "allow"
    liked: Optional[bool] = False
    collected: Optional[bool] = False
    followed: Optional[bool] = False
    likedCount: Optional[str] = "0"
    collectedCount: Optional[str] = "0"
    commentCount: Optional[str] = "0"
    shareCount: Optional[str] = "0"
    relation: Optional[str] = None

class XhsCommentUserInfo(BaseModel):
    """评论用户信息"""
    userId: Optional[str] = None
    nickname: Optional[str] = None
    image: Optional[str] = None
    xsecToken: Optional[str] = None

class XhsSubComment(BaseModel):
    """子评论信息"""
    id: Optional[str] = None
    content: Optional[str] = None
    createTime: Optional[int] = None
    likeCount: Optional[str] = "0"
    liked: Optional[bool] = False
    status: Optional[int] = None
    ipLocation: Optional[str] = None
    userInfo: Optional[XhsCommentUserInfo] = None
    targetComment: Optional[Dict[str, Any]] = None
    showTags: Optional[List[str]] = []
    atUsers: Optional[List[Dict[str, str]]] = []
    pictures: Optional[List[Dict[str, Any]]] = []

class XhsComment(BaseModel):
    """评论信息"""
    id: Optional[str] = None
    content: Optional[str] = None
    createTime: Optional[int] = None
    likeCount: Optional[str] = "0"
    liked: Optional[bool] = False
    status: Optional[int] = None
    ipLocation: Optional[str] = None
    userInfo: Optional[XhsCommentUserInfo] = None
    showTags: Optional[List[str]] = []
    atUsers: Optional[List[Dict[str, str]]] = []
    pictures: Optional[List[Dict[str, Any]]] = []
    subCommentCount: Optional[str] = "0"
    subComments: Optional[List[XhsSubComment]] = []
    subCommentCursor: Optional[str] = None
    subCommentHasMore: Optional[bool] = False
    expended: Optional[bool] = False
    hasMore: Optional[bool] = False

class XhsCommentsInfo(BaseModel):
    """评论列表信息"""
    list: Optional[List[XhsComment]] = []
    cursor: Optional[str] = None
    hasMore: Optional[bool] = False
    loading: Optional[bool] = False
    firstRequestFinish: Optional[bool] = False

class XhsNoteDetail(BaseModel):
    """小红书笔记详情完整模型"""
    
    class Config:
        # 允许额外字段，以兼容小红书数据结构的变化
        extra = "allow"
    
    noteId: str
    type: Optional[str] = None  # "video" 或 "normal"
    title: Optional[str] = None
    desc: Optional[str] = None
    time: Optional[int] = None  # 发布时间戳
    lastUpdateTime: Optional[int] = None
    ipLocation: Optional[str] = None
    xsecToken: Optional[str] = None
    
    @property
    def publishTime(self) -> Optional[datetime]:
        """将时间戳转换为datetime对象"""
        if self.time:
            return datetime.fromtimestamp(self.time / 1000)  # 假设是毫秒时间戳
        return None
    
    # 用户信息
    user: Optional[XhsUserInfo] = None
    
    # 互动信息
    interactInfo: Optional[XhsInteractInfo] = None
    
    # 媒体内容
    imageList: Optional[List[XhsImageInfo]] = []
    video: Optional[XhsVideoInfo] = None
    
    # 话题标签
    tagList: Optional[List[XhsTagInfo]] = []
    
    # 其他信息
    atUserList: Optional[List[Dict[str, str]]] = []
    shareInfo: Optional[Dict[str, Any]] = None
    
    # 评论信息
    comments: Optional[XhsCommentsInfo] = None
    
    # 系统字段
    fetchTimestamp: datetime = Field(default_factory=datetime.utcnow)
    source: str = "noteDetailMap"  # 标识数据来源
    
    # 插件添加的额外字段
    currentTime: Optional[int] = None  # 小红书页面的当前时间
    extractTimestamp: Optional[int] = None  # 插件提取时的时间戳

# --- 评论相关模型 (Raw) ---
class CommentItem(BaseModel):
    """原始评论数据模型"""
    id: str
    noteId: Optional[str] = None
    authorId: Optional[str] = None
    authorName: Optional[str] = None
    authorUrl: Optional[str] = None
    authorAvatar: Optional[str] = None
    content: Optional[str] = None
    repliedToUser: Optional[str] = None
    timestamp: Optional[datetime] = None
    likeCount: Optional[str] = '0'
    ipLocation: Optional[str] = None
    replies: List['CommentItem'] = []
    fetchTimestamp: datetime = Field(default_factory=datetime.utcnow)
    illegal_info: Optional[IllegalInfo] = None
    target_comment: Optional[Dict] = None # 用于存储被回复的评论信息
    parentCommentId: Optional[str] = None # 父评论ID，从target_comment中提取

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
    illegal_info: Optional[IllegalInfo] = None

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
    illegal_info: Optional[IllegalInfo] = None

# 更新向前引用
CommentItem.update_forward_refs() 