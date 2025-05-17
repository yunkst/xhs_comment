from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.responses import RedirectResponse
from keycloak import KeycloakOpenID
from typing import Dict, Any, Optional
import os
import logging
from pydantic import BaseModel

from ..auth.keycloak import keycloak_openid, KEYCLOAK_ENABLED, KEYCLOAK_SERVER_URL, KEYCLOAK_REALM, KEYCLOAK_CLIENT_ID

# 配置日志
logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter()

# SSO登录配置
FRONTEND_REDIRECT_URL = os.getenv("FRONTEND_REDIRECT_URL", "http://localhost:8080/web")
# 固定的回调URL，确保使用HTTPS
BASE_URL = os.getenv("BASE_URL", "https://note")
CALLBACK_URL = f"{BASE_URL}/api/auth/sso-callback"

# SSO登录响应模型
class SSOLoginResponse(BaseModel):
    auth_url: str

# SSO回调响应模型
class SSOCallbackResponse(BaseModel):
    access_token: str
    token_type: str
    id_token: Optional[str] = None
    refresh_token: Optional[str] = None
    expires_in: int

@router.get("/sso-login-url", response_model=SSOLoginResponse, tags=["SSO认证"])
async def get_sso_login_url(request: Request):
    """
    获取Keycloak SSO登录URL
    
    Returns:
        SSO登录URL
    """
    if not KEYCLOAK_ENABLED or keycloak_openid is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SSO服务未启用"
        )
    
    try:
        # 使用固定的回调URL而不是动态生成
        # callback_url = str(request.url_for("sso_callback"))
        logger.info(f"使用固定回调URL: {CALLBACK_URL}")
        auth_url = keycloak_openid.auth_url(
            redirect_uri=CALLBACK_URL,
            scope="openid"
        )
        
        return {"auth_url": auth_url}
    except Exception as e:
        logger.error(f"生成SSO登录URL失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成SSO登录URL失败: {str(e)}"
        )

@router.get("/sso-callback", tags=["SSO认证"])
async def sso_callback(
    code: str,
    request: Request,
    session_state: Optional[str] = None
):
    """
    处理Keycloak SSO回调
    
    Args:
        code: 授权码
        request: 请求对象
        session_state: 会话状态
        
    Returns:
        重定向到前端，带有访问令牌
    """
    if not KEYCLOAK_ENABLED or keycloak_openid is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SSO服务未启用"
        )
    
    try:
        # 使用固定的回调URL
        # callback_url = str(request.url_for("sso_callback"))
        logger.info(f"SSO回调处理使用固定URL: {CALLBACK_URL}")
        
        # 交换授权码获取令牌
        token_response = keycloak_openid.token(
            grant_type="authorization_code",
            code=code,
            redirect_uri=CALLBACK_URL
        )
        
        # 获取令牌
        access_token = token_response.get("access_token")
        id_token = token_response.get("id_token")
        refresh_token = token_response.get("refresh_token")
        
        # 构建重定向URL，将令牌作为参数传递给前端
        redirect_url = f"{FRONTEND_REDIRECT_URL}?access_token={access_token}"
        if id_token:
            redirect_url += f"&id_token={id_token}"
        if refresh_token:
            redirect_url += f"&refresh_token={refresh_token}"
        
        return RedirectResponse(url=redirect_url)
    except Exception as e:
        logger.error(f"处理SSO回调失败: {str(e)}")
        return RedirectResponse(
            url=f"{FRONTEND_REDIRECT_URL}?error=sso_callback_failed&error_description={str(e)}"
        )

@router.post("/sso-refresh", response_model=SSOCallbackResponse, tags=["SSO认证"])
async def refresh_sso_token(refresh_token: str):
    """
    刷新SSO令牌
    
    Args:
        refresh_token: 刷新令牌
        
    Returns:
        新的令牌
    """
    if not KEYCLOAK_ENABLED or keycloak_openid is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SSO服务未启用"
        )
    
    try:
        # 刷新令牌
        token_response = keycloak_openid.refresh_token(refresh_token)
        
        return SSOCallbackResponse(
            access_token=token_response.get("access_token"),
            token_type="bearer",
            id_token=token_response.get("id_token"),
            refresh_token=token_response.get("refresh_token"),
            expires_in=token_response.get("expires_in", 300)
        )
    except Exception as e:
        logger.error(f"刷新令牌失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"刷新令牌失败: {str(e)}"
        )

@router.get("/sso-userinfo", tags=["SSO认证"])
async def get_sso_userinfo(request: Request):
    """
    获取当前SSO用户信息
    
    Args:
        request: 请求对象
        
    Returns:
        用户信息
    """
    if not KEYCLOAK_ENABLED or keycloak_openid is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SSO服务未启用"
        )
    
    try:
        # 从请求头获取令牌
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="未提供认证凭据",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # 解析令牌
        auth_parts = auth_header.split()
        if len(auth_parts) != 2 or auth_parts[0].lower() != "bearer":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的认证头格式",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        token = auth_parts[1]
        
        # 获取用户信息
        userinfo = keycloak_openid.userinfo(token)
        
        return userinfo
    except Exception as e:
        logger.error(f"获取用户信息失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"获取用户信息失败: {str(e)}"
        ) 