from typing import Generator, Optional, Dict, Any, List
from fastapi import Depends, HTTPException, status, Query, Request
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from jose import jwt as jose_jwt
import os
from pydantic import BaseModel

# 从环境变量获取值
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change_this_secret")
ALGORITHM = "HS256"

# 设置OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")

# 分页参数模型
class PaginationParams(BaseModel):
    """分页参数模型"""
    page: int
    page_size: int
    
    @property
    def skip(self) -> int:
        """计算要跳过的记录数"""
        return (self.page - 1) * self.page_size
    
    @property
    def limit(self) -> int:
        """计算要获取的记录数"""
        return self.page_size

def get_pagination(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页项目数")
) -> PaginationParams:
    """获取分页参数"""
    return PaginationParams(page=page, page_size=page_size)

async def get_current_user(request: Request) -> str:
    """
    从请求中获取当前用户名
    """
    return await get_current_user_combined(request)


# 新增：组合认证依赖，支持Keycloak和原始JWT
async def get_current_user_combined(request: Request) -> str:
    """
    组合认证函数，支持Keycloak和原始JWT
    
    Args:
        request: FastAPI请求对象
        
    Returns:
        用户名
    """
    from .auth import get_user_from_keycloak_or_jwt
    result = await get_user_from_keycloak_or_jwt(request)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无法验证凭证",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return result
