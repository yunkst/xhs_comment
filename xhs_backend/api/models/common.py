"""
通用数据模型定义

包含多个功能模块共用的基础数据结构
"""
from typing import Optional, Dict, List
from pydantic import BaseModel, Field
from datetime import datetime

# --- 通用模型 ---
class UserInfo(BaseModel):
    """用户基本信息模型"""
    id: Optional[str] = None
    name: Optional[str] = None
    avatar: Optional[str] = None
    url: Optional[str] = None
    tag: Optional[str] = None

# --- 传入数据负载模型 ---
class IncomingPayload(BaseModel):
    """API请求的数据负载模型"""
    type: str  # "通知", "评论", "笔记"
    data: list 

# --- 抓取规则模型 ---
class CaptureRule(BaseModel):
    """URL抓取规则模型"""
    name: str = Field(..., description="规则名称，如：通知接口、评论接口等")
    pattern: str = Field(..., description="URL匹配模式，支持通配符")
    enabled: bool = Field(default=True, description="是否启用此规则")
    description: Optional[str] = Field(None, description="规则描述")
    data_type: Optional[str] = Field(None, description="数据类型：comment、notification、note等")
    priority: int = Field(default=0, description="优先级，数值越大优先级越高")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class CaptureRulesResponse(BaseModel):
    """抓取规则响应模型"""
    success: bool
    rules: List[CaptureRule]
    total_count: int
    message: Optional[str] = None

# --- 带规则名称的数据上传模型 ---
class NetworkDataPayload(BaseModel):
    """网络数据上传载荷"""
    rule_name: str = Field(..., description="匹配的抓取规则名称")
    url: str = Field(..., description="请求URL")
    method: str = Field(..., description="HTTP方法")
    request_headers: Optional[Dict] = Field(None, description="请求头")
    request_body: Optional[str] = Field(None, description="请求体")
    response_headers: Optional[Dict] = Field(None, description="响应头")
    response_body: Optional[str] = Field(None, description="响应体")
    status_code: Optional[int] = Field(None, description="HTTP状态码")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    tab_id: Optional[int] = Field(None, description="标签页ID")
    request_id: Optional[str] = Field(None, description="请求ID") 