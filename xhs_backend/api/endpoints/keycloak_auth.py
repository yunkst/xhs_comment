from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.responses import RedirectResponse
from keycloak import KeycloakOpenID
from typing import Dict, Any, Optional
import os
import logging
import uuid
import time
from datetime import datetime
from pydantic import BaseModel

from ..auth.keycloak import keycloak_openid, KEYCLOAK_ENABLED, KEYCLOAK_SERVER_URL, KEYCLOAK_REALM, KEYCLOAK_CLIENT_ID
from ..models import (
    SSOSessionRequest,
    SSOSessionResponse,
    SSOSessionStatusResponse,
    SSOLoginResponse,
    SSOCallbackResponse
)
from ..services import (
    create_session,
    get_session,
    update_session_tokens,
    SESSION_EXPIRY_MINUTES
)

# 配置日志
logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter()

# SSO登录配置
FRONTEND_REDIRECT_URL = os.getenv("FRONTEND_REDIRECT_URL", "http://localhost:8080/web")
# 固定的回调URL，确保使用HTTPS
BASE_URL = os.getenv("BASE_URL", "https://note")
CALLBACK_URL = f"{BASE_URL}/api/auth/sso-callback"

class RefreshTokenRequest(BaseModel):
    """刷新令牌请求模型"""
    refresh_token: str

# 创建会话并生成SSO登录URL
@router.post("/sso-session", response_model=SSOSessionResponse, tags=["SSO认证"])
async def create_sso_session(request: SSOSessionRequest):
    """
    创建SSO会话，返回会话ID和登录URL
    
    Args:
        request: 包含客户端类型的请求
        
    Returns:
        会话ID和登录URL
    """
    if not KEYCLOAK_ENABLED or keycloak_openid is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SSO服务未启用"
        )
    
    try:
        # 生成会话ID
        session_id = str(uuid.uuid4())
        # 生成带会话ID的回调URL
        callback_url = f"{CALLBACK_URL}?session_id={session_id}"
        
        # 获取登录URL
        auth_url = keycloak_openid.auth_url(
            redirect_uri=callback_url,
            scope="openid"
        )
        
        # 创建会话并获取过期时间
        expires_at = create_session(session_id, request.client_type)
        
        logger.info(f"创建SSO会话: {session_id}, 客户端类型: {request.client_type}")
        
        return SSOSessionResponse(
            session_id=session_id,
            login_url=auth_url,
            expires_at=expires_at
        )
    except Exception as e:
        logger.error(f"创建SSO会话失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建SSO会话失败: {str(e)}"
        )

# 获取SSO会话状态
@router.get("/sso-session/{session_id}", response_model=SSOSessionStatusResponse, tags=["SSO认证"])
async def get_sso_session_status(session_id: str):
    """
    获取SSO会话状态
    
    Args:
        session_id: 会话ID
        
    Returns:
        会话状态和令牌（如果已登录）
    """
    # 使用会话管理模块获取会话
    session = get_session(session_id)
    
    # 检查会话是否存在
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="会话不存在或已过期"
        )
    
    # 返回会话状态
    return SSOSessionStatusResponse(
        status=session["status"],
        tokens=session["tokens"]
    )

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
    session_state: Optional[str] = None,
    session_id: Optional[str] = None
):
    """
    处理Keycloak SSO回调
    
    Args:
        code: 授权码
        request: 请求对象
        session_state: 会话状态
        session_id: 会话ID（用于插件流程）
        
    Returns:
        重定向到前端，带有访问令牌
    """
    if not KEYCLOAK_ENABLED or keycloak_openid is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SSO服务未启用"
        )
    
    try:
        # 检查是否有session_id（插件流程）
        is_plugin_flow = session_id is not None
        
        # 使用固定的回调URL，加上session_id参数
        callback_url = CALLBACK_URL
        if is_plugin_flow:
            callback_url = f"{CALLBACK_URL}?session_id={session_id}"
            logger.info(f"使用插件SSO回调URL: {callback_url}")
        else:
            logger.info(f"使用标准SSO回调URL: {callback_url}")
        
        # 交换授权码获取令牌
        token_response = keycloak_openid.token(
            grant_type="authorization_code",
            code=code,
            redirect_uri=callback_url
        )
        
        # 获取令牌
        access_token = token_response.get("access_token")
        id_token = token_response.get("id_token")
        refresh_token = token_response.get("refresh_token")
        
        # 如果是插件流程，则更新会话状态
        if is_plugin_flow:
            tokens = {
                "access_token": access_token,
                "id_token": id_token,
                "refresh_token": refresh_token
            }
            
            if update_session_tokens(session_id, tokens):
                logger.info(f"更新插件SSO会话状态成功: {session_id}")
            else:
                logger.warning(f"更新插件SSO会话状态失败: {session_id}，会话不存在或已过期")
            
            # 返回成功页面
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>SSO登录成功</title>
                <style>
                    body {{ font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }}
                    .success-container {{ max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e6e6e6; border-radius: 5px; }}
                    .success-icon {{ font-size: 48px; color: #4CAF50; margin-bottom: 20px; }}
                    .button {{ background-color: #4285f4; color: white; border: none; padding: 10px 20px; 
                              text-align: center; text-decoration: none; display: inline-block; border-radius: 4px; 
                              font-size: 16px; margin-top: 20px; cursor: pointer; }}
                </style>
            </head>
            <body>
                <div class="success-container">
                    <div class="success-icon">✓</div>
                    <h1>SSO登录成功</h1>
                    <p>您已成功通过SSO登录！</p>
                    <p>请返回插件，点击"已完成登录"按钮完成授权。</p>
                </div>
            </body>
            </html>
            """
            return Response(content=html_content, media_type="text/html")
        
        # 标准流程：构建重定向URL，将令牌作为参数传递给前端
        redirect_url = f"{FRONTEND_REDIRECT_URL}?access_token={access_token}"
        if id_token:
            redirect_url += f"&id_token={id_token}"
        if refresh_token:
            redirect_url += f"&refresh_token={refresh_token}"
        
        return RedirectResponse(url=redirect_url)
    except Exception as e:
        logger.error(f"处理SSO回调失败: {str(e)}")
        
        # 如果是插件流程，返回HTML错误页面
        if session_id is not None:
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>SSO登录失败</title>
                <style>
                    body {{ font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }}
                    .error-container {{ max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e6e6e6; border-radius: 5px; }}
                    .error-icon {{ font-size: 48px; color: #F44336; margin-bottom: 20px; }}
                </style>
            </head>
            <body>
                <div class="error-container">
                    <div class="error-icon">✗</div>
                    <h1>SSO登录失败</h1>
                    <p>抱歉，登录过程中发生错误：</p>
                    <p style="color: #F44336;">{str(e)}</p>
                    <p>请返回插件重试。</p>
                </div>
            </body>
            </html>
            """
            return Response(content=html_content, media_type="text/html")
        
        # 标准流程：重定向到前端错误页面
        return RedirectResponse(
            url=f"{FRONTEND_REDIRECT_URL}?error=sso_callback_failed&error_description={str(e)}"
        )

@router.post("/sso-refresh", response_model=SSOCallbackResponse, tags=["SSO认证"])
async def refresh_sso_token(request: RefreshTokenRequest):
    """
    刷新SSO令牌
    
    Args:
        request: 包含刷新令牌的请求
        
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
        token_response = keycloak_openid.refresh_token(request.refresh_token)
        
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