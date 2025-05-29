"""
网络数据相关模型

处理从新插件接收的原始网络请求数据，以及解析后的结构化数据
"""
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field
from datetime import datetime
import json

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

# === 解析后的结构化数据模型 ===
class ParsedNetworkData(BaseModel):
    """解析后的结构化网络数据"""
    source_id: str = Field(..., description="原始数据ID")
    data_type: str = Field(..., description="数据类型：comment、notification、note、user等")
    parsed_data: Dict[str, Any] = Field(..., description="解析后的结构化数据")
    confidence: float = Field(default=1.0, description="解析置信度 0-1")
    parsed_at: datetime = Field(default_factory=datetime.utcnow)
    parser_version: str = Field(default="1.0", description="解析器版本")

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

# === 网络数据统计模型 ===
class NetworkDataStats(BaseModel):
    """网络数据统计"""
    total_requests: int = 0
    today_requests: int = 0
    processed_requests: int = 0
    failed_requests: int = 0
    by_rule: Dict[str, int] = Field(default_factory=dict)
    by_data_type: Dict[str, int] = Field(default_factory=dict)
    recent_hour: int = 0

# === 智能数据解析配置 ===
class DataParserConfig(BaseModel):
    """数据解析器配置"""
    rule_name: str = Field(..., description="规则名称")
    data_type: str = Field(..., description="目标数据类型")
    url_patterns: List[str] = Field(..., description="URL匹配模式列表")
    response_parser: str = Field(..., description="响应解析方法：json_path、regex、custom")
    parser_config: Dict[str, Any] = Field(default_factory=dict, description="解析器具体配置")
    enabled: bool = Field(default=True)
    priority: int = Field(default=0)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# === API响应模型 ===
class NetworkDataResponse(BaseModel):
    """网络数据查询响应"""
    success: bool
    data: List[RawNetworkData]
    total: int
    page: int
    page_size: int
    stats: NetworkDataStats
    available_rules: List[str] = Field(default_factory=list)
    message: Optional[str] = None

class ProcessingResponse(BaseModel):
    """数据处理响应"""
    success: bool
    processed_count: int
    results: List[DataProcessingResult]
    message: Optional[str] = None 