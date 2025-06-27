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

# 令牌刷新接口，插件需要用于刷新token
class RefreshTokenRequest(BaseModel):
    refresh_token: str

class SSOCallbackResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    id_token: Optional[str] = None
    refresh_token: Optional[str] = None
    expires_in: Optional[int] = None


@router.post("/sso-refresh", response_model=SSOCallbackResponse, tags=["SSO认证"])
async def refresh_sso_token(request_body: RefreshTokenRequest):
    """
    刷新SSO令牌
    """
    try:
        try:
            import jwt as pyjwt
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
            
            logger.info(f"用户 {username} 的访问令牌已刷新")
            return SSOCallbackResponse(
                access_token=new_access_token,
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
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"刷新令牌失败: {str(e)}"
        )

 