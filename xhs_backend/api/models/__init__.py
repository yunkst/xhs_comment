"""
API 模型统一导入模块

提供所有数据模型的统一导入接口
"""

# 用户相关模型
from .user import (
    User,
    UserInRegister,
    UserInLogin,
    TokenResponse,
    UserNote
)

# 通知相关模型
from .notification import InteractionInfo

# 网络数据相关模型
from .network import (
    RawNetworkData,
    DataProcessingResult
)

# 内容相关模型
from .content import CommentItem, Note, IllegalInfo

# 认证相关模型
from .auth import (
    SSOSessionRequest,
    SSOSessionResponse,
    SSOSessionStatusResponse,
    SSOCallbackResponse
)

# 通用模型
from .common import UserInfo

# 导出所有模型
__all__ = [
    # 用户模型
    'User',
    'UserInRegister',
    'UserInLogin',
    'TokenResponse',
    'UserNote',

    # 通知模型
    'InteractionInfo',

    # 网络数据模型
    'RawNetworkData',
    'DataProcessingResult',

    # 内容模型
    'CommentItem',
    'Note',
    'IllegalInfo',

    # 认证模型
    'SSOSessionRequest',
    'SSOSessionResponse',
    'SSOSessionStatusResponse',
    'SSOCallbackResponse',

    # 通用模型
    'UserInfo'
]
