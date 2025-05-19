from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from keycloak import KeycloakOpenID
from jose import JWTError, jwt
import os
from typing import Optional, Dict, Any
import logging
from pydantic import BaseModel
from fastapi.concurrency import run_in_threadpool
from ..deps import SECRET_KEY, ALGORITHM


# 配置日志
logger = logging.getLogger(__name__)

# 从环境变量获取配置
KEYCLOAK_ENABLED = os.getenv("KEYCLOAK_ENABLED", "false").lower() == "true"
KEYCLOAK_SERVER_URL = os.getenv("KEYCLOAK_SERVER_URL", "http://keycloak:8080")
KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM", "xhs-realm")
KEYCLOAK_CLIENT_ID = os.getenv("KEYCLOAK_CLIENT_ID", "xhs-backend")
KEYCLOAK_CLIENT_SECRET = os.getenv("KEYCLOAK_CLIENT_SECRET", "")
KEYCLOAK_SSL_VERIFY = os.getenv("KEYCLOAK_SSL_VERIFY", "false").lower() == "true"

# 新增: 定义 TokenData 模型
class TokenData(BaseModel):
    username: Optional[str] = None

# 用户信息模型
class KeycloakUser(BaseModel):
    username: str
    email: Optional[str] = None
    roles: list[str] = []
    given_name: Optional[str] = None
    family_name: Optional[str] = None
    preferred_username: Optional[str] = None
    name: Optional[str] = None
    sub: str

# Keycloak客户端
keycloak_openid = None
if KEYCLOAK_ENABLED:
    try:
        keycloak_openid = KeycloakOpenID(
            server_url=KEYCLOAK_SERVER_URL,
            client_id=KEYCLOAK_CLIENT_ID,
            realm_name=KEYCLOAK_REALM,
            client_secret_key=KEYCLOAK_CLIENT_SECRET,
            verify=KEYCLOAK_SSL_VERIFY
        )
        logger.info(f"已初始化Keycloak OpenID客户端 - 服务器: {KEYCLOAK_SERVER_URL}, 域: {KEYCLOAK_REALM}")
    except Exception as e:
        logger.error(f"初始化Keycloak客户端失败: {str(e)}")

# OAuth2 Bearer Token验证
security = HTTPBearer()

async def get_keycloak_user(request: Request) -> Optional[str]:
    """
    从请求头中提取并验证Keycloak Bearer token。
    成功则返回用户标识符 (如 preferred_username 或 sub)，否则返回 None。
    """
    if not KEYCLOAK_ENABLED or keycloak_openid is None:
        logger.debug("get_keycloak_user: Keycloak client not initialized, skipping Keycloak auth.")
        return None

    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            logger.debug("get_keycloak_user: No Authorization header found.")
            return None

        auth_parts = auth_header.split()
        if not (len(auth_parts) == 2 and auth_parts[0].lower() == "bearer"):
            logger.debug(
                f"get_keycloak_user: Authorization header present but not a Bearer token or malformed: {auth_parts[0] if auth_parts else 'Empty'}"
            )
            return None
        
        token = auth_parts[1]
        # 避免在日志中记录完整的token，只记录前缀用于追踪
        logger.debug(f"get_keycloak_user: Attempting Keycloak token validation for token starting with: {token[:20]}...")

        try:
            # 让 python-keycloak 使用 JWKS 和 token 中的 'kid' 自动解析和使用公钥
            # 不再传递 'key' 或 'options' 参数，算法将由库根据JWKS或默认配置处理
            token_info = await run_in_threadpool(
                keycloak_openid.decode_token,
                token=token
            )
            logger.debug(f"get_keycloak_user: Keycloak token decoded. Raw token_info: {token_info}")

            # 手动校验 audience
            expected_audience = KEYCLOAK_CLIENT_ID
            actual_audience = token_info.get("aud")

            audience_is_valid = False
            if isinstance(actual_audience, str) and actual_audience == expected_audience:
                audience_is_valid = True
            elif isinstance(actual_audience, list) and expected_audience in actual_audience:
                audience_is_valid = True
            
            if not audience_is_valid:
                logger.error(
                    f"get_keycloak_user: Keycloak token audience validation failed. "
                    f"Expected '{expected_audience}', but got '{actual_audience}'. Token subject: {token_info.get('sub')}"
                )
                return None
            logger.debug(f"get_keycloak_user: Keycloak token audience validated successfully for '{expected_audience}'.")

        except Exception as e:
            # 更详细地记录解码或获取公钥时的错误
            # logger.error(f"get_keycloak_user: Keycloak token fetching public key or decoding failed: {e}", exc_info=True)
            return None

        # 从解码后的token信息中提取用户名
        # Keycloak access token 中的标准用户名字段是 preferred_username
        username = token_info.get("preferred_username")
        if username:
            logger.info(f"get_keycloak_user: User '{username}' authenticated via Keycloak (using 'preferred_username').")
            return username
        
        # sub (subject identifier) 通常是用户的UUID，也可以用作后备的唯一用户标识
        subject = token_info.get("sub")
        if subject:
            logger.info(f"get_keycloak_user: User '{subject}' authenticated via Keycloak (using 'sub').")
            return subject
        
        logger.warning(
            "get_keycloak_user: Keycloak token decoded, but 'preferred_username' and 'sub' fields are missing in the token_info."
        )
        return None # 没有找到可用的用户标识

    except Exception as e:
        # 捕获 get_keycloak_user 函数本身的其他潜在错误
        logger.error(f"get_keycloak_user: Unexpected error: {e}", exc_info=True)
        return None

# 这是一个简化的JWT token解码函数，仅用于此模块的 get_user_from_keycloak_or_jwt。
# 在实际应用中，此类函数通常位于 core.security 或类似共享模块中。
def _decode_jwt_token_for_auth_fallback(token: str) -> Optional[TokenData]:
    """Decodes JWT token, returns TokenData if valid, else None."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: Optional[str] = payload.get("sub") # 'sub' 通常用于存储用户标识
        if username is None:
            logger.warning("_decode_jwt_token_for_auth_fallback: JWT token payload missing 'sub' (username).")
            return None
        return TokenData(username=username)
    except JWTError as e:
        logger.warning(f"_decode_jwt_token_for_auth_fallback: JWT decoding error: {str(e)}")
        return None

async def get_user_from_keycloak_or_jwt(request: Request) -> Optional[str]:
    """
    尝试使用Keycloak token进行认证，如果失败或token不适用，则回退到JWT认证。
    返回用户标识符字符串（如用户名或subject ID），如果认证失败则返回None。
    此函数由 deps.py 中的 get_current_user_combined 调用。
    """
    # 1. 尝试 Keycloak 认证
    keycloak_user_id = await get_keycloak_user(request)
    if keycloak_user_id:
        # 日志已在 get_keycloak_user 内部记录
        return keycloak_user_id

    # 2. 如果 Keycloak 认证失败或未提供适用token，尝试 JWT 认证
    logger.debug("get_user_from_keycloak_or_jwt: Keycloak auth failed or token not suitable, attempting JWT auth as fallback.")
    
    jwt_token_value: Optional[str] = None
    # 尝试从 Authorization: Bearer header 获取 JWT token
    auth_header = request.headers.get("Authorization")
    if auth_header:
        parts = auth_header.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            # 假设此token未被Keycloak处理，或者Keycloak处理失败，现在作为JWT尝试
            jwt_token_value = parts[1]
            logger.debug("get_user_from_keycloak_or_jwt: JWT: Found Bearer token in Authorization header.")
        else:
            # Header存在但格式不对，可能不是为JWT准备的
            logger.debug(
                "get_user_from_keycloak_or_jwt: JWT: Authorization header present but not Bearer or malformed, skipping header for JWT."
            )
    
    # 如果Header中没有，尝试从 cookie 获取 JWT token (如果你的应用也使用cookie传递JWT)
    if not jwt_token_value:
        jwt_token_value = request.cookies.get("access_token") # "access_token" 是常见的cookie名
        if jwt_token_value:
            logger.debug("get_user_from_keycloak_or_jwt: JWT: Found token in 'access_token' cookie.")

    if not jwt_token_value:
        logger.debug("get_user_from_keycloak_or_jwt: JWT: No token found in Authorization header or cookie.")
        return None # 没有token，无法进行JWT认证

    # 解码JWT token
    token_data = _decode_jwt_token_for_auth_fallback(jwt_token_value)
    if token_data and token_data.username:
        # 注意：这里仅验证了JWT token的签名和基本内容。
        # 一个完整的JWT认证流程还会包括从数据库中查找用户，并检查用户状态（如是否激活）。
        # 该职责通常由 users.py 中的 get_current_active_user 处理。
        # 此处返回用户名，上层依赖 (get_current_user_combined) 应确保用户存在于数据库。
        logger.info(
            f"get_user_from_keycloak_or_jwt: User '{token_data.username}' authenticated via JWT fallback. "
            "(Caller should verify user against DB if needed)."
        )
        return token_data.username
    
    logger.debug("get_user_from_keycloak_or_jwt: JWT authentication failed or token was invalid.")
    return None # 所有认证尝试均失败 