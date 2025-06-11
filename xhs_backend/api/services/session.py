"""
会话管理服务

用于管理SSO登录会话状态，包括会话创建、状态查询、过期清理等功能
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import redis
import json
import os

# 配置日志
logger = logging.getLogger(__name__)

# --- 从旧的 services.py 迁移过来的 Redis 相关配置和会话逻辑 ---
# 默认会话过期时间（分钟）
SESSION_EXPIRY_MINUTES = int(os.environ.get("SESSION_EXPIRY_MINUTES", 60)) # 从环境变量获取或默认60

# 从环境变量获取 Redis 配置，提供默认值
REDIS_HOST = os.environ.get("REDIS_HOST", "redis")
REDIS_PORT = int(os.environ.get("REDIS_PORT", 6379))
REDIS_DB = int(os.environ.get("REDIS_DB", 0))

sessions_db = None
try:
    sessions_db = redis.StrictRedis(
        host=REDIS_HOST,
        port=REDIS_PORT,
        db=REDIS_DB,
        decode_responses=False # 重要：存储时用json.dumps转为bytes，取出时再loads
    )
    sessions_db.ping() # 检查连接
    logger.info(f"成功连接到 Redis 服务器 ({REDIS_HOST}:{REDIS_PORT}, DB: {REDIS_DB}) 进行会话管理 (来自 session.py)。")
except redis.exceptions.ConnectionError as e:
    logger.error(f"无法连接到 Redis ({REDIS_HOST}:{REDIS_PORT}, DB: {REDIS_DB}) 进行会话管理 (来自 session.py): {e}. 请检查 Redis 服务器。SSO功能将受影响。")
    sessions_db = None
except Exception as e: #捕获其他潜在的redis初始化错误
    logger.error(f"初始化 Redis 连接时发生未知错误 (来自 session.py): {e}", exc_info=True)
    sessions_db = None

# 新的 create_session (基于 Redis, 接受 status 和 tokens)
def create_session(
    session_id: str,
    client_type: str,
    status: str = "pending",
    tokens: Optional[Dict[str, Any]] = None,
    expires_in_minutes: int = SESSION_EXPIRY_MINUTES
):
    if not sessions_db:
        logger.error("Redis 服务不可用 (session.py)，无法创建会话。")
        raise ConnectionError("会话存储服务不可用。")

    expires_at = datetime.utcnow() + timedelta(minutes=expires_in_minutes)
    session_data = {
        "client_type": client_type,
        "created_at": datetime.utcnow().isoformat(),
        "expires_at": expires_at.isoformat(),
        "status": status,
        "tokens": tokens
    }
    try:
        sessions_db.setex(
            session_id,
            timedelta(minutes=expires_in_minutes),
            json.dumps(session_data) # 存储时序列化为 JSON 字符串
        )
        logger.info(f"会话 {session_id} 已在 Redis 创建 (session.py)。客户端: {client_type}, 状态: {status}, 过期: {expires_at.isoformat()}")
    except redis.exceptions.RedisError as e:
        logger.error(f"创建会话 {session_id} 到 Redis 失败 (session.py): {e}", exc_info=True)
        raise
    except Exception as e:
        logger.error(f"创建会话 {session_id} 时发生未知错误 (session.py): {e}", exc_info=True)
        raise
    return expires_at

# 新的 get_session (基于 Redis)
def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    if not sessions_db:
        logger.error("Redis 服务不可用 (session.py)，无法获取会话。")
        return None
    try:
        session_data_raw = sessions_db.get(session_id)
        if session_data_raw:
            # decode_responses=False 时，get 返回 bytes
            session_dict = json.loads(session_data_raw.decode('utf-8'))
            logger.debug(f"会话 {session_id} 已从 Redis 获取 (session.py): {session_dict}")
            return session_dict
        else:
            logger.debug(f"会话 {session_id} 未在 Redis 中找到或已过期 (session.py)。")
            return None
    except redis.exceptions.RedisError as e:
        logger.error(f"从 Redis 获取会话 {session_id} 失败 (session.py): {e}", exc_info=True)
    except json.JSONDecodeError as e:
        logger.error(f"解析 Redis 会话 {session_id} 的 JSON 数据失败 (session.py): {e}", exc_info=True)
    except Exception as e:
        logger.error(f"获取会话 {session_id} 时发生未知错误 (session.py): {e}", exc_info=True)
    return None

# 新的 update_session_tokens (基于 Redis, status 可选)
def update_session_tokens(
    session_id: str,
    tokens: Dict[str, Any],
    status: Optional[str] = "completed"
):
    if not sessions_db:
        logger.error("Redis 服务不可用 (session.py)，无法更新会话。")
        return False
        
    session_data = get_session(session_id)
    if not session_data:
        logger.warning(f"尝试更新 Redis 中一个不存在或已过期的会话 (session.py): {session_id}")
        return False

    session_data["tokens"] = tokens
    if status is not None:
        session_data["status"] = status
    session_data["updated_at"] = datetime.utcnow().isoformat()

    try:
        ttl = sessions_db.ttl(session_id)
        if ttl is not None and ttl > 0:
            sessions_db.setex(session_id, int(ttl), json.dumps(session_data))
            logger.info(f"Redis 会话 {session_id} 已更新 (session.py)。新状态: {session_data['status']}, 有令牌: {bool(tokens)}")
            return True
        elif ttl == -1: 
            sessions_db.set(session_id, json.dumps(session_data))
            logger.warning(f"Redis 会话 {session_id} 没有过期时间，已更新但未重置TTL (session.py)。")
            return True
        else: 
            logger.warning(f"Redis 会话 {session_id} 已过期或不存在 (TTL: {ttl})，无法更新 (session.py)。")
            return False
    except redis.exceptions.RedisError as e:
        logger.error(f"更新 Redis 会话 {session_id} 失败 (session.py): {e}", exc_info=True)
    except Exception as e:
        logger.error(f"更新 Redis 会话 {session_id} 时发生未知错误 (session.py): {e}", exc_info=True)
    return False

# 新的 delete_session (基于 Redis)
def delete_session(session_id: str) -> bool:
    if not sessions_db:
        logger.error("Redis 服务不可用 (session.py)，无法删除会话。")
        return False
    try:
        result = sessions_db.delete(session_id)
        if result > 0:
            logger.info(f"Redis 会话 {session_id} 已删除 (session.py)。")
        else:
            logger.debug(f"尝试删除 Redis 会话 {session_id}，但它不在 Redis 中 (session.py)。")
        return True
    except redis.exceptions.RedisError as e:
        logger.error(f"从 Redis 删除会话 {session_id} 失败 (session.py): {e}", exc_info=True)
    except Exception as e:
        logger.error(f"删除 Redis 会话 {session_id} 时发生未知错误 (session.py): {e}", exc_info=True)
    return False

# cleanup_expired_sessions 对于 Redis 的自动过期机制来说是多余的。
# 如果其他地方有调用，可以保留一个空实现或移除其导出。
def cleanup_expired_sessions() -> int:
    """
    清理过期的SSO会话 (对于Redis是多余的，因为Redis会自动处理过期)。
    保留此函数以避免破坏现有导入，但它现在不做任何事情。
    """
    logger.info("cleanup_expired_sessions 被调用，但在Redis模式下此操作由Redis自动处理 (session.py)。")
    return 0

# --- 以下是旧的内存版本代码，将被上面的 Redis 版本取代 ---
# # 会话过期时间（分钟）
# SESSION_EXPIRY_MINUTES_OLD = 30 #重命名以避免冲突

# # 会话存储（内存版本，实际生产应使用Redis等）
# # 格式: {session_id: {status: "pending"|"completed", tokens: {access_token, id_token, refresh_token}}}
# sso_sessions_memory: Dict[str, Dict[str, Any]] = {} #重命名以避免冲突

# def create_session_memory(session_id: str, client_type: str, expires_minutes: int = SESSION_EXPIRY_MINUTES_OLD) -> datetime:
#     # ... (旧的内存实现) ...
#     pass # 已被 Redis 版本取代

# def get_session_memory(session_id: str) -> Optional[Dict[str, Any]]:
#     # ... (旧的内存实现) ...
#     pass # 已被 Redis 版本取代

# def update_session_tokens_memory(session_id: str, tokens: Dict[str, str]) -> bool:
#     # ... (旧的内存实现) ...
#     pass # 已被 Redis 版本取代

# def cleanup_expired_sessions_memory() -> int:
#     # ... (旧的内存实现) ...
#     pass # 已被 Redis 版本取代 