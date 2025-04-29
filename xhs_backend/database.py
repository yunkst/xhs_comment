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