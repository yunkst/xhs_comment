"""
网络数据处理

系统管理域 - 网络请求数据的接收、智能处理、查询和统计功能
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
import logging
from datetime import datetime, timedelta

from database import get_database
from api.deps import get_current_user
from api.models.common import NetworkDataPayload

# 添加网络数据模型导入
try:
    from api.models.network import DataProcessingResult, NetworkDataStats, ProcessingResponse
except ImportError:
    # 如果导入失败，定义一个简单的替代类
    class DataProcessingResult:
        def __init__(self, raw_data_id, success, error_message=None):
            self.raw_data_id = raw_data_id
            self.success = success
            self.error_message = error_message
    
    class ProcessingResponse:
        def __init__(self, success, processed_count, results, message=None):
            self.success = success
            self.processed_count = processed_count
            self.results = results
            self.message = message

# 配置日志
logger = logging.getLogger(__name__)

# 创建路由器 (移除prefix，由上级路由统一管理)
router = APIRouter()

@router.post("", summary="接收网络数据")
async def receive_network_data(
    data: NetworkDataPayload,
    db=Depends(get_database)
):
    """
    接收插件发送的网络请求数据
    
    插件无需认证即可发送数据，方便数据采集
    支持自动智能解析和数据路由
    """
    try:
        # 保存原始网络数据
        network_data_dict = data.dict()
        network_data_dict['received_at'] = datetime.utcnow()
        
        # 保存到网络数据集合
        result = db.network_requests.insert_one(network_data_dict)
        network_data_id = str(result.inserted_id)
        
        # 如果有响应体，尝试智能解析
        processing_result = None
        if data.response_body:
            try:
                from api.services.network_data_processor import network_processor
                from api.models.network import RawNetworkData
                
                # 转换为RawNetworkData对象
                raw_data = RawNetworkData(
                    rule_name=data.rule_name,
                    url=data.url,
                    method=data.method,
                    request_headers=data.request_headers,
                    request_body=data.request_body,
                    response_headers=data.response_headers,
                    response_body=data.response_body,
                    status_code=data.status_code,
                    timestamp=data.timestamp,
                    tab_id=data.tab_id,
                    request_id=data.request_id or network_data_id
                )
                
                # 智能处理数据
                processing_result = await network_processor.process_raw_data(raw_data)
                
                # 更新原始数据的处理状态
                update_data = {
                    'processed': processing_result.success,
                    'data_type': processing_result.data_type,
                    'items_extracted': processing_result.items_extracted,
                    'items_saved': processing_result.items_saved,
                    'processing_time_ms': processing_result.processing_time_ms
                }
                
                if not processing_result.success:
                    update_data['processing_error'] = processing_result.error_message
                
                db.network_requests.update_one(
                    {'_id': result.inserted_id},
                    {'$set': update_data}
                )
                
            except Exception as processing_error:
                logger.exception("智能数据处理失败")
                # 标记处理失败，但不影响原始数据保存
                db.network_requests.update_one(
                    {'_id': result.inserted_id},
                    {'$set': {
                        'processed': False,
                        'processing_error': str(processing_error)
                    }}
                )
        
        # 构建响应
        response_data = {
            "success": True,
            "message": f"成功接收网络数据，规则: {data.rule_name}",
            "data_id": network_data_id,
            "rule_name": data.rule_name,
            "url": data.url
        }
        
        # 如果有处理结果，包含在响应中
        if processing_result:
            response_data["processing"] = {
                "success": processing_result.success,
                "data_type": processing_result.data_type,
                "items_extracted": processing_result.items_extracted,
                "items_saved": processing_result.items_saved,
                "processing_time_ms": processing_result.processing_time_ms
            }
            
            if not processing_result.success:
                response_data["processing"]["error"] = processing_result.error_message
        
        return response_data
        
    except Exception as e:
        logger.exception("接收网络数据时发生错误")
        raise HTTPException(
            status_code=500,
            detail=f"接收网络数据失败: {str(e)}"
        )

@router.post("/batch-process", summary="批量处理网络数据")
async def batch_process_network_data(
    limit: int = 100,
    rule_name: str = None,
    current_user: str = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    批量处理未处理的网络数据
    
    管理员接口，用于重新处理或批量处理数据
    """
    try:
        from api.services.network_data_processor import network_processor
        from api.models.network import RawNetworkData
        
        # 构建查询条件
        query = {'processed': False}
        if rule_name:
            query['rule_name'] = rule_name
        
        # 查询未处理的数据
        cursor = db.network_requests.find(query).limit(limit)
        
        processing_results = []
        processed_count = 0
        
        for doc in cursor:
            try:
                # 转换为RawNetworkData对象
                doc_data = dict(doc)
                doc_data.pop('_id', None)
                doc_data['request_id'] = doc_data.get('request_id', str(doc['_id']))
                
                raw_data = RawNetworkData(**doc_data)
                
                # 处理数据
                result = await network_processor.process_raw_data(raw_data)
                processing_results.append(result)
                
                # 更新处理状态
                update_data = {
                    'processed': result.success,
                    'data_type': result.data_type,
                    'items_extracted': result.items_extracted,
                    'items_saved': result.items_saved,
                    'processing_time_ms': result.processing_time_ms
                }
                
                if not result.success:
                    update_data['processing_error'] = result.error_message
                
                db.network_requests.update_one(
                    {'_id': doc['_id']},
                    {'$set': update_data}
                )
                
                if result.success:
                    processed_count += 1
                    
            except Exception as e:
                logger.exception(f"处理单个数据记录时出错: {e}")
                # 记录错误但继续处理其他数据
                processing_results.append(DataProcessingResult(
                    raw_data_id=str(doc.get('_id', '')),
                    success=False,
                    error_message=str(e)
                ))
        
        return ProcessingResponse(
            success=True,
            processed_count=processed_count,
            results=processing_results,
            message=f"批量处理完成，成功处理 {processed_count}/{len(processing_results)} 条数据"
        )
        
    except Exception as e:
        logger.exception("批量处理网络数据时发生错误")
        raise HTTPException(
            status_code=500,
            detail=f"批量处理失败: {str(e)}"
        )

@router.get("/stats", summary="网络数据统计")
async def get_network_data_stats(
    current_user: str = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    获取网络数据统计信息
    """
    try:
        collection = db.network_requests
        
        # 基础统计
        total = collection.count_documents({})
        processed = collection.count_documents({'processed': True})
        failed = collection.count_documents({'processed': False, 'processing_error': {'$exists': True}})
        
        # 今日统计
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        today_total = collection.count_documents({'received_at': {'$gte': today_start}})
        
        # 最近一小时统计
        hour_ago = datetime.utcnow() - timedelta(hours=1)
        recent_hour = collection.count_documents({'received_at': {'$gte': hour_ago}})
        
        # 按规则分组统计
        by_rule_pipeline = [
            {'$group': {'_id': '$rule_name', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}}
        ]
        by_rule_result = list(collection.aggregate(by_rule_pipeline))
        by_rule = {item['_id']: item['count'] for item in by_rule_result}
        
        # 按数据类型分组统计
        by_type_pipeline = [
            {'$match': {'data_type': {'$exists': True}}},
            {'$group': {'_id': '$data_type', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}}
        ]
        by_type_result = list(collection.aggregate(by_type_pipeline))
        by_data_type = {item['_id']: item['count'] for item in by_type_result}
        
        try:
            from api.models.network import NetworkDataStats
            
            stats = NetworkDataStats(
                total_requests=total,
                today_requests=today_total,
                processed_requests=processed,
                failed_requests=failed,
                by_rule=by_rule,
                by_data_type=by_data_type,
                recent_hour=recent_hour
            )
            
            return {
                "success": True,
                "stats": stats.dict(),
                "processing_rate": round((processed / total * 100) if total > 0 else 0, 2)
            }
        except ImportError:
            # 如果模型导入失败，返回简单统计
            return {
                "success": True,
                "stats": {
                    "total_requests": total,
                    "today_requests": today_total,
                    "processed_requests": processed,
                    "failed_requests": failed,
                    "by_rule": by_rule,
                    "by_data_type": by_data_type,
                    "recent_hour": recent_hour
                },
                "processing_rate": round((processed / total * 100) if total > 0 else 0, 2)
            }
        
    except Exception as e:
        logger.exception("获取网络数据统计时发生错误")
        raise HTTPException(
            status_code=500,
            detail=f"获取统计失败: {str(e)}"
        )

@router.get("", summary="查询网络数据")
async def get_network_data(
    page: int = 1,
    page_size: int = 20,
    rule_name: str = None,
    data_type: str = None,
    start_time: str = None,
    end_time: str = None,
    processed: bool = None,
    current_user: str = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    查询网络请求数据
    
    管理员接口，需要认证
    支持按处理状态过滤
    """
    try:
        collection = db.network_requests
        
        # 构建查询条件
        query = {}
        
        if rule_name:
            query['rule_name'] = rule_name
            
        if data_type:
            query['data_type'] = data_type
            
        if processed is not None:
            query['processed'] = processed
            
        if start_time and end_time:
            try:
                start_dt = datetime.strptime(start_time, "%Y-%m-%d %H:%M:%S")
                end_dt = datetime.strptime(end_time, "%Y-%m-%d %H:%M:%S")
                query['received_at'] = {
                    "$gte": start_dt,
                    "$lte": end_dt
                }
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail="时间格式错误，请使用 YYYY-MM-DD HH:MM:SS 格式"
                )
        
        # 计算分页
        skip = (page - 1) * page_size
        
        # 查询数据
        cursor = collection.find(query).sort("received_at", -1).skip(skip).limit(page_size)
        data_list = []
        
        for doc in cursor:
            doc['_id'] = str(doc['_id'])
            data_list.append(doc)
        
        # 获取总数
        total = collection.count_documents(query)
        
        # 统计数据
        now = datetime.utcnow()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        hour_ago = now - timedelta(hours=1)
        
        total_requests = collection.count_documents({})
        today_requests = collection.count_documents({"received_at": {"$gte": today_start}})
        recent_hour_requests = collection.count_documents({"received_at": {"$gte": hour_ago}})
        processed_requests = collection.count_documents({"processed": True})
        
        # 获取活跃规则数
        active_rules_pipeline = [
            {"$group": {"_id": "$rule_name"}},
            {"$count": "count"}
        ]
        active_rules_result = list(collection.aggregate(active_rules_pipeline))
        active_rules_count = active_rules_result[0]["count"] if active_rules_result else 0
        
        # 获取所有可用规则
        available_rules_pipeline = [
            {"$group": {"_id": "$rule_name"}},
            {"$project": {"rule_name": "$_id", "_id": 0}}
        ]
        available_rules_result = list(collection.aggregate(available_rules_pipeline))
        available_rules = [item["rule_name"] for item in available_rules_result]
        
        return {
            "success": True,
            "data": data_list,
            "total": total,
            "page": page,
            "page_size": page_size,
            "stats": {
                "total": total_requests,
                "today": today_requests,
                "recent_hour": recent_hour_requests,
                "active_rules": active_rules_count,
                "processed": processed_requests,
                "processing_rate": round((processed_requests / total_requests * 100) if total_requests > 0 else 0, 2)
            },
            "available_rules": available_rules,
            "message": f"成功获取 {len(data_list)} 条网络数据"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("查询网络数据时发生错误")
        raise HTTPException(
            status_code=500,
            detail=f"查询网络数据失败: {str(e)}"
        ) 