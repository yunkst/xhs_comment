"""
网络数据相关模型

处理从新插件接收的原始网络请求数据，以及解析后的结构化数据
"""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

# === 原始网络数据模型 ===
class RawNetworkData(BaseModel):
    """原始网络请求数据模型"""
    rule_name: str = Field(..., description="匹配的抓取规则名称")
    url: str = Field(..., description="请求URL")
    method: str = Field(..., description="HTTP方法")
    request_headers: Optional[Dict[str, str]] = Field(None, description="请求头")
    request_body: Optional[str] = Field(None, description="请求体")
    response_headers: Optional[Dict[str, str]] = Field(None, description="响应头")
    response_body: Optional[str] = Field(None, description="响应体")
    status_code: Optional[int] = Field(None, description="HTTP状态码")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    tab_id: Optional[int] = Field(None, description="标签页ID")
    request_id: Optional[str] = Field(None, description="请求ID")
    received_at: datetime = Field(default_factory=datetime.utcnow, description="后端接收时间")
    processed: bool = Field(default=False, description="是否已处理")
    processing_error: Optional[str] = Field(None, description="处理时的错误信息")

# === 数据处理结果模型 ===
class DataProcessingResult(BaseModel):
    """数据处理结果"""
    raw_data_id: str
    success: bool
    data_type: Optional[str] = None
    items_extracted: int = 0
    items_saved: int = 0
    error_message: Optional[str] = None
    processing_time_ms: int = 0 