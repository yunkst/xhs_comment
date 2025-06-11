"""
抓取规则管理

系统管理域 - 抓取规则的CRUD操作和配置管理
"""
from fastapi import APIRouter, HTTPException, Depends, status
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime

from database import get_database
from api.deps import get_current_user
from api.models.common import CaptureRule, CaptureRulesResponse

# 配置日志
logger = logging.getLogger(__name__)

# 创建路由器 (添加前缀)
router = APIRouter(prefix="/capture-rules")

# 默认抓取规则配置
DEFAULT_CAPTURE_RULES = [
    {
        "name": "通知接口",
        "pattern": "*/api/sns/web/v1/notify/*",
        "enabled": True,
        "description": "小红书通知相关API",
        "data_type": "notification",
        "priority": 10
    },
    {
        "name": "评论接口",
        "pattern": "*/api/sns/web/v1/comment/*",
        "enabled": True,
        "description": "小红书评论相关API",
        "data_type": "comment",
        "priority": 10
    },
    {
        "name": "用户信息接口",
        "pattern": "*/api/sns/web/v1/user/*",
        "enabled": True,
        "description": "小红书用户信息API",
        "data_type": "user",
        "priority": 8
    },
    {
        "name": "笔记内容接口",
        "pattern": "*/api/sns/web/v1/feed/*",
        "enabled": True,
        "description": "小红书笔记内容API",
        "data_type": "note",
        "priority": 9
    },
    {
        "name": "搜索接口",
        "pattern": "*/api/sns/web/v1/search/*",
        "enabled": True,
        "description": "小红书搜索API",
        "data_type": "search",
        "priority": 5
    },
    {
        "name": "热门推荐接口",
        "pattern": "*/api/sns/web/v1/homefeed/*",
        "enabled": True,
        "description": "小红书首页推荐API",
        "data_type": "recommendation",
        "priority": 3
    }
]

@router.get("", response_model=CaptureRulesResponse, summary="获取抓取规则")
async def get_capture_rules(current_user: str = Depends(get_current_user)):
    """
    获取抓取规则列表
    
    返回插件用于匹配网络请求的规则列表
    """
    try:
        # 从数据库获取规则列表
        db = await get_database()
        rules_collection = db["capture_rules"]
        
        # 查询所有规则并排序
        cursor = rules_collection.find({})
        rules = await cursor.to_list(length=100)
        
        # 处理ObjectId
        for rule in rules:
            rule["_id"] = str(rule["_id"])
        
        return {
            "success": True,
            "rules": rules,
            "message": f"成功获取 {len(rules)} 条抓取规则"
        }
        
    except Exception as e:
        logger.exception("获取抓取规则失败")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取抓取规则失败: {str(e)}"
        )

@router.get("/all", response_model=CaptureRulesResponse, summary="获取所有抓取规则")
async def get_all_capture_rules(
    current_user: str = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    获取所有抓取规则（包括禁用的）
    
    管理员接口，需要认证
    """
    try:
        collection = db.capture_rules
        
        # 查询所有规则，按优先级排序
        rules_cursor = collection.find().sort("priority", -1)
        
        rules = []
        for rule_doc in rules_cursor:
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
    current_user: str = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    创建新的抓取规则
    
    管理员接口，需要认证
    """
    try:
        collection = db.capture_rules
        
        # 检查规则名称是否已存在
        existing_rule = collection.find_one({"name": rule.name})
        if existing_rule:
            raise HTTPException(
                status_code=400,
                detail=f"规则名称 '{rule.name}' 已存在"
            )
        
        # 插入新规则
        rule_dict = rule.dict()
        rule_dict['created_at'] = datetime.utcnow()
        rule_dict['updated_at'] = datetime.utcnow()
        
        result = collection.insert_one(rule_dict)
        
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
    current_user: str = Depends(get_current_user),
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
        
        result = collection.update_one(
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
    current_user: str = Depends(get_current_user),
    db=Depends(get_database)
):
    """
    删除抓取规则
    
    管理员接口，需要认证
    """
    try:
        collection = db.capture_rules
        
        result = collection.delete_one({"name": rule_name})
        
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