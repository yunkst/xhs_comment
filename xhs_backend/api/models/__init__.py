"""
API数据模型包

包含API使用的各种数据模型定义
"""

# 重新导出所有模型，提供一致的导入接口
from .common import UserInfo, IncomingPayload, CaptureRule, CaptureRulesResponse, NetworkDataPayload
from .notification import InteractionInfo, NotificationItem
from .content import CommentItem, StructuredComment, Note
from .user import (
    User, UserInRegister, UserInLogin, UserInDB, TokenResponse, UserNote
)
from .auth import (
    SSOLoginResponse, SSOSessionRequest, SSOSessionResponse, 
    SSOSessionStatusResponse, SSOCallbackResponse
)

# 新增网络数据模型
try:
    from .network import (
        RawNetworkData, ParsedNetworkData, DataProcessingResult, 
        NetworkDataStats, DataParserConfig, NetworkDataResponse, ProcessingResponse
    )
except ImportError:
    # 向后兼容，如果network模块不存在则跳过
    pass

__all__ = [
    # 通用模型
    'UserInfo', 'IncomingPayload', 'CaptureRule', 'CaptureRulesResponse', 'NetworkDataPayload',
    
    # 通知模型
    'InteractionInfo', 'NotificationItem',
    
    # 内容模型
    'CommentItem', 'StructuredComment', 'Note',
    
    # 用户模型
    'User', 'UserInRegister', 'UserInLogin', 'UserInDB', 'TokenResponse', 'UserNote',
    
    # 认证模型
    'SSOLoginResponse', 'SSOSessionRequest', 'SSOSessionResponse', 
    'SSOSessionStatusResponse', 'SSOCallbackResponse',
    
    # 网络数据模型
    'RawNetworkData', 'ParsedNetworkData', 'DataProcessingResult', 
    'NetworkDataStats', 'DataParserConfig', 'NetworkDataResponse', 'ProcessingResponse'
]
