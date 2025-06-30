"""
认证相关的数据模型定义

此模块包含与认证、会话管理、SSO登录相关的所有数据模型
"""
from pydantic import BaseModel
from typing import Dict, Any, Optional
from datetime import datetime

# SSO会话请求模型
class SSOSessionRequest(BaseModel):
    """
    创建SSO会话的请求模型
    """
    client_type: str = "plugin"  # 可以区分不同客户端类型，如"plugin"、"web"等

# SSO会话响应模型
class SSOSessionResponse(BaseModel):
    """
    SSO会话创建的响应模型
    """
    session_id: str
    initiate_url: str  # 指向Admin UI的SSO初始化页面
    expires_at: datetime

# SSO会话状态响应模型
class SSOSessionStatusResponse(BaseModel):
    """
    SSO会话状态查询的响应模型
    """
    status: str  # "pending" 或 "completed"
    tokens: Optional[Dict[str, str]] = None  # 会话完成时包含令牌

# SSO回调响应模型
class SSOCallbackResponse(BaseModel):
    """
    SSO回调或令牌刷新的响应模型
    """
    access_token: str
    token_type: str
    id_token: Optional[str] = None
    refresh_token: Optional[str] = None
    expires_in: int 