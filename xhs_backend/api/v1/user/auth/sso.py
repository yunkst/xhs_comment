"""
SSO单点登录功能 (重构版)

提供SSO认证、会话管理等功能
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.security import OAuth2PasswordBearer
from typing import Dict, Any, Optional
import logging
import uuid
import os
from datetime import datetime, timedelta
from pydantic import BaseModel, Field

# 导入会话管理服务
from api.services import (
    create_session, get_session, update_session_tokens, SESSION_EXPIRY_MINUTES
)

# 导入JWT和用户验证功能
from api.v1.user.auth.token import create_access_token # 用于潜在的刷新令牌创建
from api.deps import get_current_user # 用于获取当前已认证用户
from api.models import User # 用于类型提示

# 配置日志
logger = logging.getLogger(__name__)

# 获取环境变量
ADMIN_UI_URL = os.getenv("ADMIN_UI_URL", "http://localhost:8000/web")
# 新的SSO初始化页面路径
ADMIN_SSO_INITIATE_PATH = "/#/sso-initiate" # Vue Router使用hash模式

# 创建路由器
router = APIRouter()

# --- Pydantic 模型定义 ---
class SSOSessionRequest(BaseModel):
    client_type: str = Field(..., example="monitor_plugin")

class SSOSessionResponse(BaseModel):
    session_id: str
    initiate_url: str # 指向Admin UI的SSO初始化页面
    expires_at: datetime

class SSOApproveSessionRequest(BaseModel):
    session_id: str

class SSOSessionStatusResponse(BaseModel):
    status: str
    tokens: Optional[Dict[str, Any]] = None # 包含 access_token, refresh_token 等

class TokenData(BaseModel): # 假设这是 get_current_user 返回的一部分，或者直接从请求头获取
    access_token: str
    refresh_token: Optional[str] = None

# --- SSO 流程接口 ---

@router.post("/sso-session", response_model=SSOSessionResponse, tags=["SSO认证"])
async def create_sso_session_new(request: SSOSessionRequest):
    """
    阶段1: 插件请求创建SSO会话。
    后端生成一个 session_id，并返回一个指向 Admin UI特定页面的 URL（initiate_url），
    该 URL 包含 session_id。
    """
    session_id = str(uuid.uuid4())
    try:
        # 创建会话（状态初始为 'pending'）
        expires_at = create_session(session_id, client_type=request.client_type, status="pending", tokens=None)
        
        # 构建指向Admin UI的SSO初始化URL
        initiate_url = f"{ADMIN_UI_URL}{ADMIN_SSO_INITIATE_PATH}?session_id={session_id}"
        
        logger.info(f"创建SSO会话: {session_id}, 客户端类型: {request.client_type}, 初始化URL: {initiate_url}")
        
        return SSOSessionResponse(
            session_id=session_id,
            initiate_url=initiate_url,
            expires_at=expires_at
        )
    except Exception as e:
        logger.error(f"创建SSO会话失败: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"创建SSO会话失败: {str(e)}"
        )

@router.post("/sso-approve-session", tags=["SSO认证"])
async def approve_sso_session(
    approve_request: SSOApproveSessionRequest,
    request: Request, # 用于从请求头获取 Authorization Bearer token
    # current_user: User = Depends(get_current_user) # get_current_user 现在应该能解析 Authorization Bearer token
):
    """
    阶段3: Admin UI (用户已登录) 调用此接口来批准SSO会话。
    后端验证 session_id，并将当前 Admin UI 用户的JWT令牌与该会话关联。
    """
    session_id = approve_request.session_id
    logger.info(f"尝试批准SSO会话: {session_id}")

    # 1. 从请求头中提取 Authorization Bearer token
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        logger.warning(f"批准会话 {session_id} 失败: 缺少 Authorization Bearer token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="缺少有效的认证令牌 (Authorization Bearer)"
        )
    
    admin_jwt_token = auth_header.split(" ")[1]

    # 2. 验证 session_id
    session = get_session(session_id)
    if session is None:
        logger.warning(f"批准会话 {session_id} 失败: 会话不存在或已过期")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SSO会话不存在或已过期"
        )

    if session.get("status") == "completed":
        logger.info(f"会话 {session_id} 已被批准。")
        return {"status": "success", "message": "会话已被批准"}

    # 3. 构建令牌数据
    #    我们假设 Admin UI 使用的 token 已经是我们需要的最终 token
    #    如果 Admin UI 的 token 需要转换或用于生成新的 plugin token，这里需要额外逻辑
    user_tokens = {
        "access_token": admin_jwt_token,
        # "refresh_token": current_user.get("refresh_token") # 如果有的话
        # 注意：这里假设 current_user (如果使用 Depends) 会包含 token 信息，
        # 或者我们直接使用从 Admin UI 传递过来的 token。
        # 为简化，我们直接使用 admin_jwt_token。如果需要刷新token，需要在Admin UI登录时也存储刷新token。
    }
    
    # 4. 更新会话状态和令牌
    try:
        update_session_tokens(session_id, user_tokens, status="completed")
        logger.info(f"SSO会话 {session_id} 已成功批准并存储令牌。")
        return {"status": "success", "message": "SSO会话已批准"}
    except Exception as e:
        logger.error(f"批准SSO会话 {session_id} 失败: 更新会话时出错: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"批准SSO会话失败: {str(e)}"
        )

@router.get("/sso-session/{session_id}", response_model=SSOSessionStatusResponse, tags=["SSO认证"])
async def get_sso_session_status_new(session_id: str):
    """
    阶段4: 插件轮询此接口检查SSO会话状态。
    如果会话已批准 (status='completed')，则返回包含JWT令牌的tokens对象。
    """
    logger.debug(f"检查SSO会话状态: {session_id}")
    session = get_session(session_id)
    
    if session is None:
        logger.warning(f"会话状态检查 {session_id}: 会话不存在或已过期")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="会话不存在或已过期"
        )
    
    response_data = SSOSessionStatusResponse(
        status=session.get("status", "unknown"),
        tokens=session.get("tokens") # tokens可能为None，如果状态不是completed
    )
    logger.debug(f"会话 {session_id} 状态: {response_data.status}, 是否有tokens: {bool(response_data.tokens)}")
    return response_data

# --- 旧的/可能废弃的接口 ---
# 旧的 /sso-callback 接口不再符合新流程，予以移除或大幅修改。
# 为清晰起见，暂时注释掉，后续确认是否完全移除。
"""
@router.get("/sso-callback", tags=["SSO认证 (旧)"])
async def sso_callback_old(...):
    # ... 旧逻辑 ...
    logger.warning("旧的 /sso-callback 接口被调用，这可能不符合新流程。")
    pass
"""

# 旧的 /sso-login-url 接口也不再直接由插件使用
"""
@router.get("/sso-login-url", response_model=SSOLoginResponse, tags=["SSO认证 (旧)"])
async def get_sso_login_url_old(request: Request):
    # ... 旧逻辑 ...
    logger.warning("旧的 /sso-login-url 接口被调用，这可能不符合新流程。")
    pass
"""

# 令牌刷新接口，可以保留，因为插件获取到token后可能需要刷新
class RefreshTokenRequest(BaseModel):
    refresh_token: str

class SSOCallbackResponse(BaseModel): # 用于刷新token的响应
    access_token: str
    token_type: str = "bearer"
    id_token: Optional[str] = None
    refresh_token: Optional[str] = None
    expires_in: Optional[int] = None


@router.post("/sso-refresh", response_model=SSOCallbackResponse, tags=["SSO认证"])
async def refresh_sso_token(request_body: RefreshTokenRequest):
    """
    刷新SSO令牌 (主要指通过后端JWT机制)
    Keycloak部分可以移除或作为可选，因为新流程更侧重后端JWT
    """
    try:
        # 简化：直接尝试本地JWT刷新逻辑
        # 如果需要支持Keycloak刷新，可以保留相关代码并用配置控制
        
        # 本地令牌刷新逻辑 (基于api.v1.user.auth.token中的create_access_token)
        try:
            import jwt as pyjwt # pyjwt是python-jose的依赖, FastAPI常用
            from api.v1.user.auth.token import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
            
            payload = pyjwt.decode(
                request_body.refresh_token,
                SECRET_KEY,
                algorithms=[ALGORITHM]
            )
            
            username = payload.get("sub")
            token_type = payload.get("token_type")

            if not username or token_type != "refresh":
                logger.warning(f"无效的刷新令牌: username={username}, token_type={token_type}")
                raise ValueError("无效的刷新令牌")
            
            new_access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
            new_access_token = create_access_token(
                data={"sub": username}, expires_delta=new_access_token_expires
            )
            
            # 通常刷新令牌本身不应在刷新访问令牌时重新生成，除非旧的刷新令牌即将过期
            # 为简单起见，我们不在此处重新生成刷新令牌
            
            logger.info(f"用户 {username} 的访问令牌已刷新")
            return SSOCallbackResponse(
                access_token=new_access_token,
                # refresh_token=request_body.refresh_token, # 返回旧的刷新令牌
                expires_in=int(new_access_token_expires.total_seconds())
            )
        except pyjwt.ExpiredSignatureError:
            logger.error("刷新令牌已过期")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="刷新令牌已过期"
            )
        except (pyjwt.PyJWTError, ValueError) as e:
            logger.error(f"刷新令牌验证失败: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"无效的刷新令牌: {str(e)}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"刷新令牌处理失败: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, # 或500，取决于错误性质
            detail=f"刷新令牌失败: {str(e)}"
        )

# 辅助函数：创建成功/错误HTML响应 (这些可能不再需要，因为回调由Admin UI处理)
# 如果Admin UI的 /sso-initiate 页面需要直接给用户展示成功/失败，可以保留或移至Admin UI
def create_success_page_response(message: str = "操作成功完成"):
    # ... (HTML内容) ...
    return Response(content=f"<h1>成功</h1><p>{message}</p><script>setTimeout(window.close, 3000);</script>", media_type="text/html")

def create_error_page_response(error_message: str = "发生错误"):
    # ... (HTML内容) ...
    return Response(content=f"<h1>错误</h1><p>{error_message}</p>", media_type="text/html", status_code=400)

# /sso-userinfo 接口，可以用 get_current_user 替代，或者保持用于插件获取用户信息
# 但通常插件拿到JWT后，可以直接请求受保护的 /users/me 之类的接口
# 暂且保留，但标记为可能冗余
@router.get("/sso-userinfo", tags=["SSO认证 (可能冗余)"])
async def get_sso_userinfo(current_user: User = Depends(get_current_user)):
    """
    获取当前认证用户的信息 (通过插件提供的JWT)
    """
    logger.info(f"请求用户信息，用户: {current_user.username}")
    # current_user已经是 User 模型实例
    return {
        "success": True,
        "userinfo": current_user.dict(), # Pydantic模型转dict
        "source": "local_jwt" 
    }

# /check-login-status 接口，主要用于调试，可以保留
@router.get("/check-login-status", tags=["SSO认证 (调试)"])
async def check_login_status_debug(request: Request, current_user: Optional[str] = Depends(get_current_user)):
    """
    检查当前用户的登录状态 (通过请求头中的Bearer Token)
    """
    auth_header = request.headers.get("Authorization")
    token_present = bool(auth_header and auth_header.startswith("Bearer "))
    
    if current_user:
        logger.info(f"检查登录状态: 用户 {current_user} 已登录 (通过 get_current_user)")
        return {
            "status": "已登录",
            "username": current_user,
            "token_source": "get_current_user"
        }
    elif token_present:
        # 如果 get_current_user 未返回用户，但token存在，说明token可能无效或过期
        logger.warning("检查登录状态: Authorization Bearer token 存在，但 get_current_user 未能解析用户。")
        return {
            "status": "令牌可能无效或已过期",
            "token_present": True,
            "headers": dict(request.headers)
        }
    else:
        logger.info("检查登录状态: 未找到认证令牌。")
        return {
            "status": "未登录",
            "token_present": False,
            "message": "未找到有效的认证令牌",
            "headers": dict(request.headers)
        }

# 清理旧模型引用 (如果它们在别处没有用到，这些应在 api.models 中移除)
# from api.models import SSOLoginResponse, SSOCallbackResponse (旧的)
# from api.endpoints.keycloak_auth import RefreshTokenRequest (旧的, 现在本地定义了)

# 确保 api.services 中的 create_session 和 update_session_tokens 支持新的 status 参数
# 并且 tokens 参数可以为 None 或包含 access_token

# 注意: 环境变量 ADMIN_UI_URL 和 ADMIN_SSO_INITIATE_PATH 需要正确配置。
# ADMIN_UI_URL 应该是 xhs_admin_ui 的访问基地址。
# ADMIN_SSO_INITIATE_PATH 是 xhs_admin_ui 中用于处理SSO初始化的Vue路由路径。

# 移除旧的keycloak依赖，除非明确需要保留
# from keycloak import KeycloakOpenID
# from api.endpoints.keycloak_auth import (
# keycloak_openid, KEYCLOAK_ENABLED, KEYCLOAK_SERVER_URL, 
# KEYCLOAK_REALM, KEYCLOAK_CLIENT_ID, FRONTEND_REDIRECT_URL, CALLBACK_URL
# )

# 确保 api.services 中的 create_session 和 update_session_tokens 支持新的 status 参数
# 并且 tokens 参数可以为 None 或包含 access_token

# 注意: 环境变量 ADMIN_UI_URL 和 ADMIN_SSO_INITIATE_PATH 需要正确配置。
# ADMIN_UI_URL 应该是 xhs_admin_ui 的访问基地址。
# ADMIN_SSO_INITIATE_PATH 是 xhs_admin_ui 中用于处理SSO初始化的Vue路由路径。

# 移除旧的keycloak依赖，除非明确需要保留
# from keycloak import KeycloakOpenID
# from api.endpoints.keycloak_auth import (
# keycloak_openid, KEYCLOAK_ENABLED, KEYCLOAK_SERVER_URL, 
# KEYCLOAK_REALM, KEYCLOAK_CLIENT_ID, FRONTEND_REDIRECT_URL, CALLBACK_URL
# ) 