from typing import Generator, Optional, Dict, Any, List
from fastapi import Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
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

async def get_current_user(token: str = Depends(oauth2_scheme)) -> str:
    """
    从JWT令牌获取当前用户名
    
    Args:
        token: JWT令牌
        
    Returns:
        当前用户名
        
    Raises:
        HTTPException: 如果令牌无效或无法解析
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭证",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(
            token, 
            SECRET_KEY, 
            algorithms=[ALGORITHM]
        )
        username: str = payload.get("sub")
        
        if username is None:
            raise credentials_exception
            
    except JWTError:
        raise credentials_exception
        
    return username
