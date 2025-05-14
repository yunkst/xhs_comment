import motor.motor_asyncio
import os
from dotenv import load_dotenv
from typing import List, Dict, Any, Optional
import logging
from copy import deepcopy
from pymongo import MongoClient, UpdateOne
from pymongo.errors import ConnectionFailure, BulkWriteError
from datetime import datetime
import asyncio
from processing import parse_relative_timestamp
import bcrypt
import pyotp
from models import User, UserInRegister, UserInDB

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 加载 .env 文件中的环境变量
load_dotenv()

# 从环境变量获取配置
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "xiaohongshu_data")
NOTIFICATIONS_COLLECTION = os.getenv("NOTIFICATIONS_COLLECTION", "notifications")
COMMENTS_COLLECTION = os.getenv("COMMENTS_COLLECTION", "comments")
RAW_COMMENTS_COLLECTION = "raw_comments" # 存放原始合并后的评论数据
STRUCTURED_COMMENTS_COLLECTION = "structured_comments" # 存放结构化评论数据
NOTES_COLLECTION = "notes" # 存放笔记数据
USERS_COLLECTION = "users"
USER_NOTES_COLLECTION = "user_notes" # 存放用户备注数据
USER_INFO_COLLECTION = "user_info" # 存放小红书用户信息数据

client: motor.motor_asyncio.AsyncIOMotorClient = None
db: motor.motor_asyncio.AsyncIOMotorDatabase = None

async def connect_to_mongo():
    """建立MongoDB连接并初始化db对象"""
    global client, db
    if client is None:
        try:
            logger.info(f"尝试连接到 MongoDB: {MONGODB_URL}")
            client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URL)
            db = client[DATABASE_NAME]
            await client.admin.command('ping')
            logger.info(f"成功连接到 MongoDB 数据库: {DATABASE_NAME}")
        except Exception as e:
            logger.error(f"无法连接到 MongoDB: {e}")
            client = None
            db = None
            raise

def close_mongo_connection():
    """关闭MongoDB连接"""
    global client
    if client:
        client.close()
        logger.info("MongoDB 连接已关闭")

async def get_database() -> motor.motor_asyncio.AsyncIOMotorDatabase:
    """获取数据库实例，如果未连接则尝试连接"""
    if db is None:
        await connect_to_mongo()
        if db is None:
             raise Exception("数据库初始化失败")
    return db

# --- 递归合并评论数据的辅助函数 ---
def merge_comment_data(existing_comment: Dict[str, Any], new_comment_data: Dict[str, Any]) -> Dict[str, Any]:
    """递归合并新的评论数据到现有文档中，特别处理replies"""
    merged_comment = deepcopy(existing_comment) # Start with existing data

    # 更新顶层字段 (除了 _id 和 replies)
    for key, value in new_comment_data.items():
        if key not in ["_id", "replies"]:
            merged_comment[key] = value

    # 合并 replies
    existing_replies = merged_comment.get("replies", [])
    new_replies = new_comment_data.get("replies", [])

    if not new_replies: # 如果新数据没有回复，保留现有的
        return merged_comment

    merged_replies_list = []
    existing_replies_map = {reply["id"]: reply for reply in existing_replies if reply.get("id")}
    processed_new_reply_ids = set()

    # 遍历现有回复，更新或保留
    for existing_reply in existing_replies:
        reply_id = existing_reply.get("id")
        if reply_id and reply_id in existing_replies_map:
            corresponding_new_reply = next((nr for nr in new_replies if nr.get("id") == reply_id), None)
            if corresponding_new_reply:
                # 找到匹配的新回复，递归合并
                merged_reply = merge_comment_data(existing_reply, corresponding_new_reply)
                merged_replies_list.append(merged_reply)
                processed_new_reply_ids.add(reply_id)
            else:
                # 新数据中没有此回复，保留旧的
                merged_replies_list.append(existing_reply)
        else:
             # 现有回复无ID或映射中找不到(理论上不应发生)，保留
             merged_replies_list.append(existing_reply)

    # 添加新回复中未处理（即不存在于旧数据中）的回复
    for new_reply in new_replies:
        reply_id = new_reply.get("id")
        if not reply_id or reply_id not in processed_new_reply_ids:
            merged_replies_list.append(new_reply)

    merged_comment["replies"] = merged_replies_list
    return merged_comment

# --- 保存评论数据（带 Upsert 和递归合并） ---
async def save_comments_with_upsert(data: List[Dict[str, Any]]):
    """保存评论列表，如果评论已存在则合并更新，特别是replies"""
    if not data:
        logger.info("没有评论数据需要保存")
        return {"inserted": 0, "updated": 0}

    database = await get_database()
    collection = database[RAW_COMMENTS_COLLECTION]
    inserted_count = 0
    updated_count = 0

    for comment_data in data:
        comment_id = comment_data.get("id")
        note_id = comment_data.get("noteId")

        if not comment_id or not note_id:
            logger.warning(f"跳过评论，缺少 ID 或 NoteID: {comment_data.get('content', '')[:50]}...")
            continue

        try:
            existing_comment = await collection.find_one({"id": comment_id, "noteId": note_id})

            if existing_comment:
                # 更新现有评论
                merged_data = merge_comment_data(existing_comment, comment_data)
                # 使用 replace_one 替换整个文档
                result = await collection.replace_one({"_id": existing_comment["_id"]}, merged_data)
                if result.modified_count > 0:
                    updated_count += 1
                    logger.debug(f"更新评论: id={comment_id}, noteId={note_id}")
                else:
                     logger.warning(f"尝试更新评论但 modified_count 为 0: id={comment_id}")
            else:
                # 插入新评论
                result = await collection.insert_one(comment_data)
                if result.inserted_id:
                    inserted_count += 1
                    logger.debug(f"插入新评论: id={comment_id}, noteId={note_id}")
                else:
                    logger.warning(f"尝试插入新评论但未获取 inserted_id: id={comment_id}")

        except Exception as e:
            logger.error(f"处理评论 id={comment_id}, noteId={note_id} 时出错: {e}")
            #可以选择继续处理下一个或抛出异常
            # continue

    logger.info(f"评论保存/更新完成。插入: {inserted_count}, 更新: {updated_count}")
    return {"inserted": inserted_count, "updated": updated_count}

# --- 保存通知数据（简单插入） ---
async def save_notifications(data: List[Dict[str, Any]]):
    """将通知数据列表直接插入到集合中"""
    if not data:
        logger.info("没有通知数据需要保存")
        return {"inserted_count": 0}

    database = await get_database()
    collection = database[NOTIFICATIONS_COLLECTION]
    try:
        logger.info(f"向集合 '{NOTIFICATIONS_COLLECTION}' 插入 {len(data)} 条通知记录...")
        result = await collection.insert_many(data)
        inserted_count = len(result.inserted_ids)
        logger.info(f"成功插入 {inserted_count} 条记录到集合 '{NOTIFICATIONS_COLLECTION}'")
        return {"inserted_count": inserted_count}
    except Exception as e:
        logger.error(f"保存通知数据到集合 '{NOTIFICATIONS_COLLECTION}' 时出错: {e}")
        raise

async def save_data(collection_name: str, data: List[Dict[str, Any]]):
    """将数据列表保存到指定的集合中"""
    if not data:
        logger.info("没有数据需要保存")
        return {"inserted_count": 0}

    database = await get_database()
    collection = database[collection_name]
    try:
        logger.info(f"向集合 '{collection_name}' 插入 {len(data)} 条记录...")
        # 将Pydantic模型转换为字典列表以插入MongoDB
        # 注意：如果 data 已经是 dict 列表，则无需转换
        # data_to_insert = [item.dict(by_alias=True) if hasattr(item, 'dict') else item for item in data]
        # 由于 IncomingPayload 的 data 是 List[Dict[str, Any]]，可以直接插入
        result = await collection.insert_many(data)
        inserted_count = len(result.inserted_ids)
        logger.info(f"成功插入 {inserted_count} 条记录到集合 '{collection_name}'")
        return {"inserted_count": inserted_count}
    except Exception as e:
        logger.error(f"保存数据到集合 '{collection_name}' 时出错: {e}")
        raise # 重新抛出异常，让路由处理HTTP错误 

# --- 修改为异步函数 ---
async def save_structured_comments(data: List[Dict[str, Any]]):
    """将结构化的评论数据批量更新插入（Upsert）到数据库 (异步版本)。
       如果文档已存在，则不更新 timestamp 字段。
    """
    if not data:
        logger.info("没有结构化评论数据需要保存")
        return {'upserted': 0, 'matched': 0, 'failed': 0}

    try:
        database = await get_database() # 获取异步数据库实例
    except Exception as e:
        logger.error(f"获取数据库连接失败，无法保存结构化评论: {e}")
        return {'upserted': 0, 'matched': 0, 'failed': len(data)}

    collection = database[STRUCTURED_COMMENTS_COLLECTION]
    bulk_operations = []
    skipped_count = 0

    for comment in data:
        comment_id = comment.get("commentId")
        if not comment_id:
            logger.warning(f"结构化评论缺少commentId，跳过: {str(comment)[:100]}")
            skipped_count += 1
            continue

        # 准备 $set 和 $setOnInsert 操作
        set_operation = comment.copy() # 复制一份用于 $set
        timestamp_value = set_operation.pop('timestamp', None) # 从 $set 中移除 timestamp
        set_on_insert_operation = {}

        # 确保 fetchTimestamp 存在且是 datetime (这个应该每次都更新)
        set_operation['fetchTimestamp'] = comment.get('fetchTimestamp', datetime.utcnow())
        if not isinstance(set_operation['fetchTimestamp'], datetime):
             set_operation['fetchTimestamp'] = datetime.utcnow() # 强制设为当前时间
             
        # 只有在 timestamp_value 有效时才添加到 $setOnInsert
        if isinstance(timestamp_value, datetime):
            set_on_insert_operation['timestamp'] = timestamp_value
        elif timestamp_value is not None: # 如果不是 datetime 但也不是 None，记录警告
             logger.warning(f"结构化评论 commentId={comment_id} 的 timestamp 格式无效 ({type(timestamp_value)})，将不会在插入时设置。")

        # 创建UpdateOne操作
        # $set: 更新除 timestamp 外的其他字段
        # $setOnInsert: 仅在插入新文档时设置 timestamp
        bulk_operations.append(
            UpdateOne(
                {"commentId": comment_id},
                {
                    "$set": set_operation, 
                    "$setOnInsert": set_on_insert_operation
                },
                upsert=True
            )
        )

    upserted_count = 0
    matched_count = 0
    failed_count = skipped_count # 初始化失败计数为跳过的数量

    if not bulk_operations:
        logger.warning("没有有效的结构化评论可供写入。")
        return {'upserted': 0, 'matched': 0, 'failed': failed_count}

    try:
        # 执行异步批量写入
        result = await collection.bulk_write(bulk_operations, ordered=False)
        upserted_count = result.upserted_count
        matched_count = result.matched_count
        # BulkWriteError 会在 result.bulk_api_result 中包含错误信息

        successful_ops = upserted_count + result.modified_count # 注意：matched 不等于 modified
        # 更精确的计算方式是 upserted_count + modified_count
        # matched_count 包含未修改的文档
        
        # 计算操作失败的数量 (不包括先前因ID缺失跳过的)
        # bulk_write result 包含 writeErrors, 我们这里简化处理，假设除了 upserted 和 modified 其他算匹配但未更新
        operation_failures = len(bulk_operations) - (upserted_count + matched_count) # 近似失败数
        failed_count += operation_failures

        logger.info(f"结构化评论异步批量写入完成 - 新增(Upserted): {upserted_count}, 匹配(Matched): {matched_count} (其中修改 Modified: {result.modified_count}), 失败: {failed_count}")
        return {'upserted': upserted_count, 'matched': matched_count, 'modified': result.modified_count, 'failed': failed_count}
    except BulkWriteError as bwe:
        logger.error(f"保存结构化评论时发生异步批量写入错误: {bwe.details}")
        # 尝试从错误详情中获取更精确的计数
        upserted_count = bwe.details.get('nUpserted', 0)
        matched_count = bwe.details.get('nMatched', 0) # 使用 nMatched
        modified_count = bwe.details.get('nModified', 0)
        successful_ops = upserted_count + modified_count # 成功的操作数
        operation_failures = len(bulk_operations) - successful_ops
        failed_count += operation_failures # 加上写入操作本身的失败数
        logger.warning(f"批量写入错误详情: {bwe.details}")
        return {'upserted': upserted_count, 'matched': matched_count, 'modified': modified_count, 'failed': failed_count}
    except Exception as e:
        logger.error(f"保存结构化评论数据时发生未知异步错误: {e}", exc_info=True)
        # 假设所有尝试的操作都失败了
        failed_count = len(data) # 所有原始数据都算失败
        return {'upserted': 0, 'matched': 0, 'modified': 0, 'failed': failed_count} 

# --- 保存笔记数据 ---
async def save_notes(data: List[Dict[str, Any]]):
    """保存笔记列表，如果笔记已存在则更新"""
    if not data:
        logger.info("没有笔记数据需要保存")
        return {"inserted": 0, "updated": 0}

    database = await get_database()
    collection = database[NOTES_COLLECTION]
    inserted_count = 0
    updated_count = 0

    for note_data in data:
        note_id = note_data.get("noteId")

        if not note_id:
            logger.warning(f"跳过笔记，缺少 noteId: {note_data.get('noteContent', '')[:50]}...")
            continue

        try:
            # 确保 fetchTimestamp 字段存在且是 datetime 类型
            if 'fetchTimestamp' not in note_data or not isinstance(note_data['fetchTimestamp'], datetime):
                note_data['fetchTimestamp'] = datetime.utcnow()
            
            # 处理 publishTime 字段，将其转换为 datetime 类型
            if 'publishTime' in note_data and note_data['publishTime']:
                # 使用 parse_relative_timestamp 函数解析发布时间
                publish_time_str = note_data['publishTime']
                parsed_publish_time = parse_relative_timestamp(publish_time_str)
                
                if parsed_publish_time:
                    note_data['publishTime'] = parsed_publish_time
                else:
                    logger.warning(f"无法解析笔记发布时间: {publish_time_str}，维持原始值")
                
            # 尝试查找已存在的笔记
            existing_note = await collection.find_one({"noteId": note_id})

            if existing_note:
                # 更新现有笔记
                result = await collection.replace_one({"_id": existing_note["_id"]}, note_data)
                if result.modified_count > 0:
                    updated_count += 1
                    logger.debug(f"更新笔记: noteId={note_id}")
                else:
                    logger.warning(f"尝试更新笔记但 modified_count 为 0: noteId={note_id}")
            else:
                # 插入新笔记
                result = await collection.insert_one(note_data)
                if result.inserted_id:
                    inserted_count += 1
                    logger.debug(f"插入新笔记: noteId={note_id}")
                else:
                    logger.warning(f"尝试插入新笔记但未获取 inserted_id: noteId={note_id}")

        except Exception as e:
            logger.error(f"处理笔记 noteId={note_id} 时出错: {e}")
            # 继续处理下一个

    logger.info(f"笔记保存/更新完成。插入: {inserted_count}, 更新: {updated_count}")
    return {"inserted": inserted_count, "updated": updated_count}

# --- 获取用户历史评论 ---
async def get_user_historical_comments(user_id: str):
    """获取特定用户的所有历史评论及相关笔记信息
    
    Args:
        user_id: 用户ID
        
    Returns:
        包含用户评论及相关笔记信息的列表，按时间降序排序
    """
    if not user_id:
        logger.error("获取历史评论时缺少用户ID")
        return []
    
    database = await get_database()
    
    # 1. 查询包含该用户评论的结构化评论数据
    structured_comments_collection = database[STRUCTURED_COMMENTS_COLLECTION]
    
    # 查询条件：用户ID匹配 或 回复给该用户的评论
    # 先获取该用户发表的所有评论ID
    user_comments_query = {"authorId": user_id}
    user_comments = await structured_comments_collection.find(user_comments_query, {"commentId": 1}).to_list(length=None)
    user_comment_ids = [comment.get("commentId") for comment in user_comments if comment.get("commentId")]
    
    # 构建组合查询条件
    query = {
        "$or": [
            {"authorId": user_id},  # 用户发表的评论
            {"repliedId": {"$in": user_comment_ids}} if user_comment_ids else {"repliedId": "impossible_reply_id"}  # 回复给该用户的评论
        ]
    }
    
    # 执行查询
    structured_comments = await structured_comments_collection.find(query).to_list(length=None)
    logger.info(f"找到用户 {user_id} 相关的结构化评论数据 {len(structured_comments)} 条")
    
    if not structured_comments:
        logger.info(f"未找到用户 {user_id} 的任何结构化评论")
        return []
    
    # 2. 提取关联的笔记ID并查询笔记信息
    note_ids = set(comment.get("noteId") for comment in structured_comments if comment.get("noteId"))
    
    # 查询笔记数据
    notes_collection = database[NOTES_COLLECTION]
    notes_data = {}
    
    if note_ids:
        notes_query = {"noteId": {"$in": list(note_ids)}}
        notes_cursor = notes_collection.find(notes_query)
        
        async for note in notes_cursor:
            note_id = note.get("noteId")
            if note_id:
                notes_data[note_id] = {
                    "noteId": note_id,
                    "publishTime": note.get("publishTime"),
                    "title": note.get("title", ""),
                    "noteContent": note.get("noteContent", ""),
                    "noteLike": note.get("noteLike", 0),
                    "noteCommitCount": note.get("noteCommitCount", 0),
                    "authorId": note.get("authorId", "")
                }
    
    # 3. 组织结果数据
    result = []
    
    # 按笔记分组整理评论数据
    comments_by_note = {}
    
    # 收集所有评论，按ID索引，用于处理回复关系
    comments_map = {}
    for comment in structured_comments:
        comment_id = comment.get("commentId")
        if comment_id:
            comments_map[comment_id] = comment
    
    # 按笔记ID分组评论
    for comment in structured_comments:
        note_id = comment.get("noteId")
        if not note_id:
            continue
            
        if note_id not in comments_by_note:
            comments_by_note[note_id] = []
        
        # 评论数据中添加isTarget标记，表示是否为目标用户的评论
        is_target_user = comment.get("authorId") == user_id
        
        # 准备评论数据
        comment_data = {
            "commentId": comment.get("commentId"),
            "userId": comment.get("authorId"),
            "userName": comment.get("authorName", ""),
            "content": comment.get("content", ""),
            "time": comment.get("timestamp").isoformat() if comment.get("timestamp") else "",
            "replyToCommentId": comment.get("repliedId"),
            "isTargetUser": is_target_user
        }
        
        # 添加额外字段：头像
        if comment.get("authorAvatar"):
            comment_data["userAvatar"] = comment.get("authorAvatar")
        
        comments_by_note[note_id].append(comment_data)
    
    # 构建最终结果
    for note_id, comments in comments_by_note.items():
        note_info = notes_data.get(note_id, {})
        
        # 只有在有笔记信息的情况下才添加到结果中
        if note_info:
            # 对评论按时间排序
            sorted_comments = sorted(
                comments, 
                key=lambda x: x.get("time", ""), 
                reverse=True
            )
            
            result_item = {
                "noteId": note_id,
                "publishTime": note_info.get("publishTime"),
                "title": note_info.get("title", ""),
                "comments": sorted_comments
            }
            result.append(result_item)
    
    # 按照笔记发布时间排序（降序）
    result.sort(key=lambda x: x.get("publishTime") if x.get("publishTime") else datetime.min, reverse=True)
    
    logger.info(f"成功生成用户 {user_id} 的历史评论数据，涉及 {len(result)} 条笔记")
    return result 

async def get_user_by_username(username: str) -> Optional[dict]:
    db_inst = await get_database()
    user = await db_inst[USERS_COLLECTION].find_one({"username": username})
    return user

async def create_user(user_in: UserInRegister, allow_register: bool = True) -> Optional[dict]:
    if not allow_register:
        raise Exception("注册功能已关闭")
    db_inst = await get_database()
    # 检查用户名是否已存在
    existing = await db_inst[USERS_COLLECTION].find_one({"username": user_in.username})
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
    await db_inst[USERS_COLLECTION].insert_one(user.dict())
    return user.dict()

async def verify_user_password(username: str, password: str) -> Optional[dict]:
    user = await get_user_by_username(username)
    if not user:
        return None
    if not bcrypt.checkpw(password.encode(), user["password_hash"].encode()):
        return None
    return user 

# --- 用户备注相关函数 ---
async def save_user_note(user_id: str, notification_hash: str, note_content: str):
    """保存或更新用户备注
    
    Args:
        user_id: 用户ID
        notification_hash: 通知内容的哈希值
        note_content: 用户备注内容
        
    Returns:
        保存后的备注数据
    """
    if not user_id or not notification_hash:
        logger.error("保存备注时缺少用户ID或通知哈希")
        return None
    
    database = await get_database()
    collection = database[USER_NOTES_COLLECTION]
    
    # 构建备注数据
    note_data = {
        "userId": user_id,
        "notificationHash": notification_hash,
        "noteContent": note_content,
        "updatedAt": datetime.utcnow()
    }
    
    # 更新或插入备注
    result = await collection.update_one(
        {"userId": user_id, "notificationHash": notification_hash},
        {"$set": note_data},
        upsert=True
    )
    
    if result.upserted_id or result.modified_count > 0:
        logger.info(f"成功保存/更新用户备注: userId={user_id}, hash={notification_hash}")
        return note_data
    else:
        logger.warning(f"备注数据未变化: userId={user_id}, hash={notification_hash}")
        return note_data

async def get_user_notes(user_id: str):
    """获取用户的所有备注
    
    Args:
        user_id: 用户ID
        
    Returns:
        包含用户所有备注的列表
    """
    if not user_id:
        logger.error("获取备注时缺少用户ID")
        return []
    
    database = await get_database()
    collection = database[USER_NOTES_COLLECTION]
    
    user_notes = await collection.find({"userId": user_id}).to_list(length=None)
    logger.info(f"获取到用户 {user_id} 的 {len(user_notes)} 条备注")
    return user_notes 

# --- 用户信息相关函数 ---
async def save_user_info(user_info: Dict[str, Any]) -> Dict[str, Any]:
    """保存或更新用户信息
    
    Args:
        user_info: 用户信息字典，必须包含id字段
        
    Returns:
        操作结果
    """
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

async def get_user_info(user_id: str) -> Optional[Dict[str, Any]]:
    """获取指定用户的信息
    
    Args:
        user_id: 用户ID
        
    Returns:
        用户信息或None（如果用户不存在）
    """
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
    """批量获取多个用户的信息
    
    Args:
        user_ids: 用户ID列表
        
    Returns:
        用户信息映射（用户ID -> 用户信息）
    """
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
    """分页获取所有用户信息

    Args:
        page: 当前页码
        page_size: 每页数量

    Returns:
        包含用户列表和总数的字典
    """
    try:
        db = await get_database()
        collection = db[USER_INFO_COLLECTION]

        skip = (page - 1) * page_size
        total = await collection.count_documents({})
        
        cursor = collection.find().skip(skip).limit(page_size).sort("updatedAt", -1) # 按更新时间降序排序
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