"""
会话管理服务

用于管理SSO登录会话状态，包括会话创建、状态查询、过期清理等功能
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

# 配置日志
logger = logging.getLogger(__name__)

# 会话过期时间（分钟）
SESSION_EXPIRY_MINUTES = 30

# 会话存储（内存版本，实际生产应使用Redis等）
# 格式: {session_id: {status: "pending"|"completed", tokens: {access_token, id_token, refresh_token}}}
sso_sessions: Dict[str, Dict[str, Any]] = {}

def create_session(session_id: str, client_type: str, expires_minutes: int = SESSION_EXPIRY_MINUTES) -> datetime:
    """
    创建新的SSO会话
    
    Args:
        session_id: 会话ID
        client_type: 客户端类型
        expires_minutes: 过期时间（分钟）
        
    Returns:
        会话过期时间
    """
    # 计算过期时间
    expires_at = datetime.now() + timedelta(minutes=expires_minutes)
    
    # 保存会话信息
    sso_sessions[session_id] = {
        "status": "pending",
        "client_type": client_type,
        "created_at": datetime.now(),
        "expires_at": expires_at,
        "tokens": None
    }
    
    # 清理过期会话
    cleanup_expired_sessions()
    
    logger.info(f"创建SSO会话: {session_id}, 客户端类型: {client_type}")
    return expires_at

def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    """
    获取会话信息
    
    Args:
        session_id: 会话ID
        
    Returns:
        会话信息，如果会话不存在或已过期则返回None
    """
    # 检查会话是否存在
    if session_id not in sso_sessions:
        return None
    
    session = sso_sessions[session_id]
    
    # 检查会话是否过期
    if datetime.now() > session["expires_at"]:
        # 删除过期会话
        del sso_sessions[session_id]
        return None
    
    return session

def update_session_tokens(session_id: str, tokens: Dict[str, str]) -> bool:
    """
    更新会话令牌信息
    
    Args:
        session_id: 会话ID
        tokens: 令牌信息
    
    Returns:
        更新是否成功
    """
    if session_id not in sso_sessions:
        return False
        
    session = sso_sessions[session_id]
    
    # 检查会话是否过期
    if datetime.now() > session["expires_at"]:
        del sso_sessions[session_id]
        return False
    
    # 更新会话状态和令牌
    session["status"] = "completed"
    session["tokens"] = tokens
    
    logger.info(f"更新会话令牌: {session_id}")
    return True

def cleanup_expired_sessions() -> int:
    """
    清理过期的SSO会话
    
    Returns:
        清理的会话数量
    """
    now = datetime.now()
    expired_sessions = [
        session_id for session_id, session in sso_sessions.items()
        if now > session["expires_at"]
    ]
    
    for session_id in expired_sessions:
        del sso_sessions[session_id]
    
    if expired_sessions:
        logger.info(f"已清理 {len(expired_sessions)} 个过期会话")
    
    return len(expired_sessions) 