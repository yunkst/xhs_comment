from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from keycloak import KeycloakOpenID
from jose import JWTError, jwt
import os
from typing import Optional, Dict, Any
import logging
from pydantic import BaseModel

# 配置日志
logger = logging.getLogger(__name__)

# 从环境变量获取配置
KEYCLOAK_ENABLED = os.getenv("KEYCLOAK_ENABLED", "false").lower() == "true"
KEYCLOAK_SERVER_URL = os.getenv("KEYCLOAK_SERVER_URL", "http://keycloak:8080")
KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM", "xhs-realm")
KEYCLOAK_CLIENT_ID = os.getenv("KEYCLOAK_CLIENT_ID", "xhs-backend")
KEYCLOAK_CLIENT_SECRET = os.getenv("KEYCLOAK_CLIENT_SECRET", "")
KEYCLOAK_SSL_VERIFY = os.getenv("KEYCLOAK_SSL_VERIFY", "false").lower() == "true"

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

async def get_keycloak_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Optional[KeycloakUser]:
    """
    验证并解析Keycloak JWT令牌
    
    Args:
        credentials: HTTP授权凭据
        
    Returns:
        解析的用户信息或None（如果验证失败）
    """
    if not KEYCLOAK_ENABLED or keycloak_openid is None:
        return None
        
    try:
        token = credentials.credentials
        # 获取Keycloak公钥
        keys_url = f"{KEYCLOAK_SERVER_URL}/realms/{KEYCLOAK_REALM}"
        jwks_uri = f"{keys_url}/protocol/openid-connect/certs"
        public_key = keycloak_openid.public_key()
        
        # 解码并验证令牌
        options = {"verify_signature": True, "verify_aud": False, "verify_exp": True}
        token_info = keycloak_openid.decode_token(
            token,
            key=public_key,
            options=options
        )
        
        # 提取用户信息
        username = token_info.get("preferred_username")
        if not username:
            username = token_info.get("sub")
            
        # 创建用户对象
        user = KeycloakUser(
            username=username,
            email=token_info.get("email"),
            roles=token_info.get("realm_access", {}).get("roles", []) if "realm_access" in token_info else [],
            given_name=token_info.get("given_name"),
            family_name=token_info.get("family_name"),
            preferred_username=token_info.get("preferred_username"),
            name=token_info.get("name"),
            sub=token_info.get("sub")
        )
        
        return user
    except Exception as e:
        logger.debug(f"Keycloak令牌验证失败: {str(e)}")
        return None

async def get_user_from_keycloak_or_jwt(request: Request) -> str:
    """
    组合认证，先尝试Keycloak认证，失败后回退到JWT认证
    
    Args:
        request: FastAPI请求对象
        
    Returns:
        用户名
        
    Raises:
        HTTPException: 如果所有认证方式都失败
    """
    # 从请求头获取授权信息
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未提供认证凭据",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 如果启用了Keycloak认证，先尝试Keycloak
    if KEYCLOAK_ENABLED and keycloak_openid is not None:
        try:
            # 尝试解析令牌前缀
            auth_parts = auth_header.split()
            if len(auth_parts) == 2 and auth_parts[0].lower() == "bearer":
                token = auth_parts[1]
                
                # 获取Keycloak公钥
                public_key = keycloak_openid.public_key()
                
                # 解码并验证令牌
                options = {"verify_signature": True, "verify_aud": False, "verify_exp": True}
                token_info = keycloak_openid.decode_token(
                    token,
                    key=public_key
                )
                
                # 提取用户名
                username = token_info.get("preferred_username")
                if username:
                    return username
                return token_info.get("sub", "")
        except Exception as e:
            # Keycloak验证失败，继续尝试JWT
            logger.debug(f"Keycloak认证失败，尝试JWT认证: {str(e)}")
    
    # 回退到JWT认证
    from api.deps import SECRET_KEY, ALGORITHM  # 导入现有JWT认证所需的配置
    
    try:
        # 解析令牌前缀
        auth_parts = auth_header.split()
        if len(auth_parts) != 2 or auth_parts[0].lower() != "bearer":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的认证头格式",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        token = auth_parts[1]
        payload = jwt.decode(
            token, 
            SECRET_KEY, 
            algorithms=[ALGORITHM]
        )
        username = payload.get("sub")
        
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的认证凭据",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        return username
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的认证凭据",
            headers={"WWW-Authenticate": "Bearer"},
        ) 