"""
网络数据处理模块

接收、处理、存储网络监控数据
"""
from fastapi import APIRouter, HTTPException, Depends, status, Body
from typing import Dict, Any, List
import logging

from api.models.network import RawNetworkData, DataProcessingResult
from api.services.network_data_processor import NetworkDataProcessor
from api.deps import get_current_user_combined

# 配置日志
logger = logging.getLogger(__name__)

# 创建路由器
router = APIRouter(prefix="/network-data")

@router.post("/upload", summary="上传原始网络数据", response_model=DataProcessingResult)
async def upload_raw_network_data(
    data: RawNetworkData,
    user: str = Depends(get_current_user_combined)
):
    """
    接收并处理插件捕获的原始网络请求数据。

    这个端点会:
    1. 接收符合 `RawNetworkData` 模型的数据。
    2. 使用 `NetworkDataProcessor` 对数据进行分类和解析。
    3. 将解析后的结构化数据保存到相应的数据库集合中。
    4. 返回处理结果。
    """
    try:
        logger.info(f"接收到来自用户 {user} 的网络数据上传请求, 规则: {data.rule_name}, URL: {data.url}")
        
        processor = NetworkDataProcessor()
        result = await processor.process_raw_data(data)
        
        if not result.success:
            logger.error(f"处理网络数据失败: {result.error_message}")
            # 根据处理结果返回不同的状态码
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"数据处理失败: {result.error_message}"
            )
            
        logger.info(f"网络数据处理成功: {result.items_saved} 条数据已保存")
        return result

    except HTTPException:
        # 重新抛出已处理的HTTP异常
        raise
    except Exception as e:
        logger.exception(f"上传网络数据时发生严重错误: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"服务器内部错误: {str(e)}"
        )

@router.post("/upload/batch", summary="批量上传原始网络数据")
async def upload_batch_raw_network_data(
    data_list: List[RawNetworkData],
    user: str = Depends(get_current_user_combined)
):
    """
    接收并批量处理插件捕获的原始网络请求数据。
    """
    results = []
    processor = NetworkDataProcessor()
    
    logger.info(f"接收到来自用户 {user} 的批量网络数据上传请求, 共 {len(data_list)} 条")

    for data in data_list:
        try:
            result = await processor.process_raw_data(data)
            results.append(result.dict())
        except Exception as e:
            logger.error(f"批量处理其中一条数据时失败: {e}, URL: {data.url}")
            results.append(DataProcessingResult(
                raw_data_id=data.request_id,
                success=False,
                error_message=str(e)
            ).dict())
            
    total_saved = sum(r.get('items_saved', 0) for r in results if r['success'])
    total_failed = len(data_list) - sum(1 for r in results if r['success'])
    
    logger.info(f"批量处理完成: 成功 {len(data_list) - total_failed}, 失败 {total_failed}, 共保存 {total_saved} 条目")

    return {
        "success": total_failed == 0,
        "message": f"批量处理完成: {len(data_list) - total_failed} 成功, {total_failed} 失败。",
        "total_items_saved": total_saved,
        "results": results
    } 