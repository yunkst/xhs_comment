"""
用户服务模块

提供用户账户管理相关的业务逻辑功能
"""
import logging
import bcrypt
import pyotp
from typing import Dict, Any, List, Optional
from datetime import datetime

from ..models.user import User, UserInRegister, UserInDB, TokenResponse

# 配置日志
logger = logging.getLogger(__name__)

# 延迟导入 - 避免循环引用
# 不要在顶层导入database模块，而是在每个函数内部导入所需的内容

async def get_user_by_username(username: str) -> Optional[dict]:
    """根据用户名获取用户信息"""
    # 在函数内部导入模块
    from database import get_database, USERS_COLLECTION
    
    db = await get_database()
    user = await db[USERS_COLLECTION].find_one({"username": username})
    return user

async def create_user(user_in: UserInRegister, allow_register: bool = True) -> Optional[dict]:
    """创建新用户账户"""
    # 在函数内部导入模块
    from database import get_database, USERS_COLLECTION
    
    if not allow_register:
        raise Exception("注册功能已关闭")
    
    db = await get_database()
    
    # 检查用户名是否已存在
    existing = await db[USERS_COLLECTION].find_one({"username": user_in.username})
    if existing:
        raise Exception("用户名已存在")
    
    # 生成密码哈希
    password_hash = bcrypt.hashpw(user_in.password.encode(), bcrypt.gensalt()).decode()
    
    # 生成OTP密钥
    otp_secret = pyotp.random_base32()
    
    user = User(
        username=user_in.username,
        password_hash=password_hash,
        otp_secret=otp_secret,
        is_active=True
    )
    
    await db[USERS_COLLECTION].insert_one(user.dict())
    return user.dict()

async def verify_user_password(username: str, password: str) -> Optional[dict]:
    """验证用户密码"""
    user = await get_user_by_username(username)
    if not user:
        return None
    
    if not bcrypt.checkpw(password.encode(), user["password_hash"].encode()):
        return None
    
    return user

# --- 小红书用户信息相关功能 ---
async def get_user_info(user_id: str) -> Optional[Dict[str, Any]]:
    """获取指定小红书用户的信息"""
    # 在函数内部导入模块
    from database import get_database, USER_INFO_COLLECTION
    
    if not user_id:
        logger.warning("获取用户信息时缺少用户ID")
        return None
    
    try:
        # 获取数据库集合
        db = await get_database()
        collection = db[USER_INFO_COLLECTION]
        
        # 查询用户信息
        user_info = await collection.find_one({"id": user_id})
        
        # 处理结果（特别是将_id转换为字符串）
        if user_info and '_id' in user_info:
            user_info['_id'] = str(user_info['_id'])
        
        return user_info
    except Exception as e:
        logger.exception(f"获取用户信息时出错: {e}")
        return None

async def batch_get_user_info(user_ids: List[str]) -> Dict[str, Dict[str, Any]]:
    """批量获取多个小红书用户的信息"""
    # 在函数内部导入模块
    from database import get_database, USER_INFO_COLLECTION
    
    if not user_ids:
        return {}
    
    try:
        # 获取数据库集合
        db = await get_database()
        collection = db[USER_INFO_COLLECTION]
        
        # 构建批量查询
        query = {"id": {"$in": user_ids}}
        user_infos = await collection.find(query).to_list(length=None)
        
        # 构建结果映射
        result = {}
        for user_info in user_infos:
            if '_id' in user_info:
                user_info['_id'] = str(user_info['_id'])
            user_id = user_info.get("id")
            if user_id:
                result[user_id] = user_info
        
        return result
    except Exception as e:
        logger.exception(f"批量获取用户信息时出错: {e}")
        return {}

async def get_all_user_info_paginated(page: int = 1, page_size: int = 10) -> Dict[str, Any]:
    """分页获取所有小红书用户信息"""
    # 在函数内部导入模块
    from database import get_database, USER_INFO_COLLECTION
    
    try:
        db = await get_database()
        collection = db[USER_INFO_COLLECTION]

        skip = (page - 1) * page_size
        total = await collection.count_documents({})
        
        cursor = collection.find().skip(skip).limit(page_size).sort("updatedAt", -1)
        users = await cursor.to_list(length=page_size)

        # 处理结果（特别是将_id转换为字符串）
        for user in users:
            if '_id' in user:
                user['_id'] = str(user['_id'])
            if 'createdAt' in user and isinstance(user['createdAt'], datetime):
                user['createdAt'] = user['createdAt'].isoformat()
            if 'updatedAt' in user and isinstance(user['updatedAt'], datetime):
                user['updatedAt'] = user['updatedAt'].isoformat()

        return {
            "items": users,
            "total": total,
            "page": page,
            "page_size": page_size
        }
    except Exception as e:
        logger.exception(f"分页获取用户信息时出错: {e}")
        return {
            "items": [],
            "total": 0,
            "page": page,
            "page_size": page_size
        }

async def save_user_info(user_info: Dict[str, Any]) -> Dict[str, Any]:
    """保存或更新小红书用户信息"""
    # 在函数内部导入模块
    from database import get_database, USER_INFO_COLLECTION
    
    user_id = user_info.get("id")
    if not user_id:
        logger.warning("尝试保存用户信息时缺少id字段")
        return {"success": False, "message": "用户信息缺少id字段"}
    
    try:
        # 获取数据库集合
        db = await get_database()
        collection = db[USER_INFO_COLLECTION]
        
        # 更新时间戳
        user_info["updatedAt"] = datetime.utcnow()
        if "createdAt" not in user_info:
            user_info["createdAt"] = user_info["updatedAt"]
        
        # 使用upsert确保创建或更新
        result = await collection.update_one(
            {"id": user_id},
            {"$set": user_info},
            upsert=True
        )
        
        if result.modified_count > 0:
            logger.info(f"更新用户信息: id={user_id}")
            return {"success": True, "message": "用户信息已更新", "action": "updated"}
        elif result.upserted_id:
            logger.info(f"创建用户信息: id={user_id}")
            return {"success": True, "message": "用户信息已创建", "action": "created"}
        else:
            logger.info(f"用户信息无变化: id={user_id}")
            return {"success": True, "message": "用户信息无变化", "action": "no_change"}
    except Exception as e:
        logger.exception(f"保存用户信息时出错: {e}")
        return {"success": False, "message": f"保存用户信息时出错: {str(e)}"} 