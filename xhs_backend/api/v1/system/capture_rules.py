"""
抓取规则管理

系统管理域 - 抓取规则的CRUD操作和配置管理
"""
from fastapi import APIRouter, HTTPException, Depends, status
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime

from database import get_database
from api.deps import get_current_user_combined
from api.models.common import CaptureRule, CaptureRulesResponse

# 配置日志
logger = logging.getLogger(__name__)

# 创建路由器 (添加前缀)
router = APIRouter(prefix="/capture-rules")

# 核心抓取规则配置 - 基于实际小红书接口
DEFAULT_CAPTURE_RULES = [
    {
        "name": "通知列表",
        "pattern": "/api/sns/web/v1/you/mentions",
        "enabled": True,
        "description": "抓取用户通知列表数据",
        "data_type": "notification_feed",
        "priority": 10
    },
    {
        "name": "评论页面接口",
        "pattern": "/api/sns/web/v2/comment/page",
        "enabled": True,
        "description": "抓取笔记评论页面数据",
        "data_type": "comment_page",
        "priority": 10
    },
    {
        "name": "子评论页面接口",
        "pattern": "/api/sns/web/v2/comment/sub/page",
        "enabled": True,
        "description": "抓取笔记子评论（回复）页面数据",
        "data_type": "sub_comment_page",
        "priority": 10
    }
]

@router.get("", response_model=CaptureRulesResponse, summary="获取抓取规则")
async def get_capture_rules():
    """
    获取抓取规则列表
    
    返回插件用于匹配网络请求的规则列表
    
    注意：此接口无需认证，插件需要在用户登录之前获取规则
    直接返回固定的抓取规则，不与数据库交互，确保插件能立即获取规则
    """
    try:
        # 直接返回固定的抓取规则，不依赖数据库
        rules = []
        for rule_data in DEFAULT_CAPTURE_RULES:
            rules.append(CaptureRule(**rule_data))
        
        return CaptureRulesResponse(
            success=True,
            rules=rules,
            total_count=len(rules),
            message=f"成功获取 {len(rules)} 条抓取规则"
        )
        
    except Exception as e:
        logger.exception("获取抓取规则失败")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取抓取规则失败: {str(e)}"
        )

@router.get("/all", response_model=CaptureRulesResponse, summary="获取所有抓取规则")
async def get_all_capture_rules(
    current_user: str = Depends(get_current_user_combined),
    db=Depends(get_database)
):
    """
    获取所有抓取规则（包括禁用的）
    
    管理员接口，需要认证
    """
    try:
        collection = db.capture_rules
        

        # 查询所有规则，按优先级排序，使用to_list方法
        rules_docs = await collection.find().sort("priority", -1).to_list(length=100)
        
        rules = []
        for rule_doc in rules_docs:
            rule_doc.pop('_id', None)
            rules.append(CaptureRule(**rule_doc))
        
        return CaptureRulesResponse(
            success=True,
            rules=rules,
            total_count=len(rules),
            message=f"成功获取 {len(rules)} 条抓取规则"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取抓取规则失败: {str(e)}"
        )

@router.post("", summary="创建抓取规则")
async def create_capture_rule(
    rule: CaptureRule,
    current_user: str = Depends(get_current_user_combined),
    db=Depends(get_database)
):
    """
    创建新的抓取规则
    
    管理员接口，需要认证
    """
    try:
        collection = db.capture_rules
        
        # 检查规则名称是否已存在
        existing_rule = await collection.find_one({"name": rule.name})
        if existing_rule:
            raise HTTPException(
                status_code=400,
                detail=f"规则名称 '{rule.name}' 已存在"
            )
        
        # 插入新规则
        rule_dict = rule.dict()
        rule_dict['created_at'] = datetime.utcnow()
        rule_dict['updated_at'] = datetime.utcnow()
        
        result = await collection.insert_one(rule_dict)
        
        return {
            "success": True,
            "message": f"成功创建抓取规则: {rule.name}",
            "rule_id": str(result.inserted_id)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"创建抓取规则失败: {str(e)}"
        )

@router.put("/{rule_name}", summary="更新抓取规则")
async def update_capture_rule(
    rule_name: str,
    rule_update: CaptureRule,
    current_user: str = Depends(get_current_user_combined),
    db=Depends(get_database)
):
    """
    更新抓取规则
    
    管理员接口，需要认证
    """
    try:
        collection = db.capture_rules
        
        # 更新规则
        rule_dict = rule_update.dict()
        rule_dict['updated_at'] = datetime.utcnow()
        
        result = await collection.update_one(
            {"name": rule_name},
            {"$set": rule_dict}
        )
        
        if result.matched_count == 0:
            raise HTTPException(
                status_code=404,
                detail=f"未找到规则: {rule_name}"
            )
        
        return {
            "success": True,
            "message": f"成功更新抓取规则: {rule_name}",
            "modified_count": result.modified_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"更新抓取规则失败: {str(e)}"
        )

@router.delete("/{rule_name}", summary="删除抓取规则")
async def delete_capture_rule(
    rule_name: str,
    current_user: str = Depends(get_current_user_combined),
    db=Depends(get_database)
):
    """
    删除抓取规则
    
    管理员接口，需要认证
    """
    try:
        collection = db.capture_rules
        
        result = await collection.delete_one({"name": rule_name})
        
        if result.deleted_count == 0:
            raise HTTPException(
                status_code=404,
                detail=f"未找到规则: {rule_name}"
            )
        
        return {
            "success": True,
            "message": f"成功删除抓取规则: {rule_name}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"删除抓取规则失败: {str(e)}"
        ) 