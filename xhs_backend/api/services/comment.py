"""
评论服务模块

提供评论数据处理、结构化和查询的业务逻辑
"""
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
import pymongo
import re
from typing import Tuple
from api.models.user import UserNote
from api.models.content import StructuredComment
# 配置日志
logger = logging.getLogger(__name__)


def clean_content(text: str) -> str:
    """
    只保留中文、英文、数字，去掉其他字符
    """
    if not text:
        return ''
    # 匹配中文、英文、数字
    return ''.join(re.findall(r'[\u4e00-\u9fa5a-zA-Z0-9]', text))


def match_usernote_and_comments(usernotes: List[UserNote], comments: List[StructuredComment]) -> List[Tuple[UserNote, StructuredComment]]:
    """
    建立UserNote和StructuredComment的关联：
    1. userId与authorId完全匹配
    2. content清洗后匹配
    返回所有能建立关联的(UserNote, StructuredComment)对
    """
    matches = []
    # 先构建authorId->comment的索引
    authorid_to_comments = {}
    for comment in comments:
        if comment.authorId:
            authorid_to_comments.setdefault(comment.authorId, []).append(comment)
    # 先用userId和authorId匹配
    for usernote in usernotes:
        if usernote.userId in authorid_to_comments:
            for comment in authorid_to_comments[usernote.userId]:
                matches.append((usernote, comment))
    # 再用content清洗后匹配
    # 构建清洗后content->comment的索引
    cleaned_comment_content_map = {}
    for comment in comments:
        cleaned = clean_content(comment.content or '')
        if cleaned:
            cleaned_comment_content_map.setdefault(cleaned, []).append(comment)
    for usernote in usernotes:
        cleaned_usernote_content = clean_content(usernote.content or '')
        if cleaned_usernote_content in cleaned_comment_content_map:
            for comment in cleaned_comment_content_map[cleaned_usernote_content]:
                # 避免重复（如果已经通过userId匹配过就不再重复）
                if not (usernote, comment) in matches:
                    matches.append((usernote, comment))
    return matches

# --- 递归合并评论数据的辅助函数 ---
def merge_comment_data(existing_comment: Dict[str, Any], new_comment_data: Dict[str, Any]) -> Dict[str, Any]:
    """递归合并新的评论数据到现有文档中，特别处理replies"""
    merged_comment = existing_comment.copy() # Start with existing data

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

async def save_comments_with_upsert(data: List[Dict[str, Any]]):
    """保存评论列表，如果评论已存在则合并更新，特别是replies"""
    # 在函数内部导入模块
    from database import get_database, COMMENTS_COLLECTION
    
    if not data:
        logger.info("没有评论数据需要保存")
        return {"inserted": 0, "updated": 0}

    database = await get_database()
    collection = database[COMMENTS_COLLECTION]
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

async def save_structured_comments(data: List[Dict[str, Any]]):
    """将结构化的评论数据批量更新插入（Upsert）到数据库 (异步版本)。
       如果文档已存在，则不更新 timestamp 字段。
    """
    # 在函数内部导入模块
    from database import get_database, STRUCTURED_COMMENTS_COLLECTION
    
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
            pymongo.UpdateOne(
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
    except pymongo.errors.BulkWriteError as bwe:
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

async def get_user_historical_comments(user_id: str):
    """获取特定用户的所有历史评论及相关笔记信息"""
    # 在函数内部导入模块
    from database import get_database, STRUCTURED_COMMENTS_COLLECTION, NOTES_COLLECTION
    
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