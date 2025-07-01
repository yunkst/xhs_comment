import os
import json
import logging
import motor.motor_asyncio
from typing import Dict, Any, List, Optional
from datetime import datetime
from pathlib import Path
import uuid
import hashlib
import base64
import secrets
from bson import ObjectId
import bcrypt
import pyotp

# 这里移除顶层User导入
# from api.models.user import User, UserInRegister, UserInDB

# 配置日志
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# 加载 .env 文件中的环境变量（如果需要）
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    logger.info("dotenv模块不可用，跳过环境变量加载")

# 从环境变量获取MongoDB连接字符串
MONGO_URL = os.environ.get('MONGODB_URL', 'mongodb://localhost:27017/')
DB_NAME = os.environ.get('DATABASE_NAME', 'xhs_comments')


# Collection names
USERS_COLLECTION = 'users'
COMMENTS_COLLECTION = 'comments'
NOTES_COLLECTION = 'notes'
NOTIFICATIONS_COLLECTION = 'notifications'
USER_NOTES_COLLECTION = 'user_notes'
RAW_COMMENTS_COLLECTION = "raw_comments" # 存放原始合并后的评论数据
STRUCTURED_COMMENTS_COLLECTION = "structured_comments" # 存放结构化评论数据
USER_INFO_COLLECTION = "user_info" # 存放小红书用户信息数据

# 初始化全局变量
client = None
db = None

async def connect_to_mongo():
    """建立MongoDB连接并初始化db对象"""
    global client, db
    if client is None:
        try:
            logger.info(f"尝试连接到 MongoDB: {MONGO_URL}")
            client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URL)
            db = client[DB_NAME]
            # 测试连接
            await client.admin.command('ping')
            logger.info(f"成功连接到 MongoDB 数据库: {DB_NAME}")
            
            # 初始化集合引用 - 如果需要的话
            # users_collection = db[USERS_COLLECTION]
            # comments_collection = db[COMMENTS_COLLECTION]
            # 等等...
            
        except Exception as e:
            logger.error(f"无法连接到 MongoDB: {e}")
            client = None
            db = None
            raise

async def close_mongo_connection():
    """关闭MongoDB连接"""
    global client
    if client:
        client.close()
        logger.info("MongoDB 连接已关闭")
        client = None

async def get_database():
    """获取数据库实例，如果未连接则尝试连接"""
    global db
    if db is None:
        await connect_to_mongo()
        if db is None:
             raise Exception("数据库初始化失败")
    return db