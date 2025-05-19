"""
API数据模型包

包含API使用的各种数据模型定义
"""

# 导出认证相关模型
from .auth import (
    SSOSessionRequest,
    SSOSessionResponse,
    SSOSessionStatusResponse,
    SSOLoginResponse,
    SSOCallbackResponse
)
