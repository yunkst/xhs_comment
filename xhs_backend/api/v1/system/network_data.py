"""
网络数据处理模块

接收、处理、存储网络监控数据
"""
from fastapi import APIRouter, HTTPException, Depends, status, Body
from typing import Dict, Any
import logging
from datetime import datetime

# 导入数据库和认证依赖
from database import get_database
from api.deps import get_current_user

# 配置日志
logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter(prefix="/network-data")

@router.post("", summary="上传网络数据")
async def upload_network_data(
    data: Dict[str, Any] = Body(...),
    current_user: str = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    接收网络监控数据
    
    接收插件捕获的网络请求数据并存储到数据库
    """
    try:
        # 记录接收时间
        data["received_at"] = datetime.utcnow()
        
        # 记录上传用户
        data["uploaded_by"] = current_user
        
        # 根据规则类型分配到不同集合
        rule_name = data.get("rule_name", "").lower()
        
        # 确定目标集合
        if "comment" in rule_name:
            collection_name = "comments"
        elif "note" in rule_name:
            collection_name = "notes"
        elif "notification" in rule_name:
            collection_name = "notifications"
        elif "user" in rule_name:
            collection_name = "user_data"
        else:
            collection_name = "network_data"
        
        # 存储数据
        collection = db[collection_name]
        await collection.insert_one(data)
        
        return {
            "success": True,
            "message": f"网络数据已上传并存储到 {collection_name} 集合",
            "collection": collection_name
        }
        
    except Exception as e:
        logger.exception("上传网络数据失败")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"上传网络数据失败: {str(e)}"
        ) 