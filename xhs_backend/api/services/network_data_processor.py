"""
网络数据处理服务

负责将原始网络请求数据解析为结构化数据，并路由到相应的处理流程
"""
import json
import re
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timezone
import asyncio

from ..models.network import RawNetworkData, DataProcessingResult
from ..models.content import CommentItem, Note, IllegalInfo
from ..models.common import UserInfo
from ..services.comment import save_comments_with_upsert
from ..services.note import save_notes
from ..services.user import save_user_info
from database import get_database, NOTES_COLLECTION

logger = logging.getLogger(__name__)

class NetworkDataProcessor:
    """网络数据处理器"""
    
    def __init__(self):
        self.parsers = {
            'comment': self._parse_comment_data,
            'comment_page': self._parse_comment_page_data,  # 新增评论页面解析器
            'sub_comment_page': self._parse_sub_comment_page_data,  # 新增子评论页面解析器
            'notification': self._parse_notification_data,
            'comment_notification_feed': self._parse_comment_notification_feed_data, # 重构后的提及通知解析器
            'note': self._parse_note_data,
            'user': self._parse_user_data,
            'search': self._parse_search_data,
            'recommendation': self._parse_recommendation_data
        }
    
    async def process_raw_data(self, raw_data: RawNetworkData) -> DataProcessingResult:
        """
        处理原始网络数据
        """
        start_time = datetime.utcnow()
        
        try:
            # 根据规则名称确定数据类型
            data_type = self._determine_data_type(raw_data.rule_name, raw_data.url)
            
            if not data_type:
                return DataProcessingResult(
                    raw_data_id=str(raw_data.request_id),
                    success=False,
                    error_message="无法确定数据类型"
                )
            
            # 解析响应数据
            parsed_data = await self._parse_response_data(raw_data, data_type)
            
            if not parsed_data:
                return DataProcessingResult(
                    raw_data_id=str(raw_data.request_id),
                    success=False,
                    data_type=data_type,
                    error_message="响应数据解析失败"
                )
            
            # 保存解析后的数据
            save_result = await self._save_parsed_data(data_type, parsed_data)

            items_extracted = 0
            if isinstance(parsed_data, list):
                items_extracted = len(parsed_data)
            elif isinstance(parsed_data, dict):
                items_extracted = sum(len(v) for v in parsed_data.values())
            
            processing_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            
            return DataProcessingResult(
                raw_data_id=str(raw_data.request_id),
                success=save_result['success'],
                data_type=data_type,
                items_extracted=items_extracted,
                items_saved=save_result.get('saved_count', 0),
                error_message=save_result.get('error'),
                processing_time_ms=processing_time
            )
            
        except Exception as e:
            processing_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            logger.exception(f"处理网络数据时发生错误: {e}")
            
            return DataProcessingResult(
                raw_data_id=str(raw_data.request_id),
                success=False,
                error_message=str(e),
                processing_time_ms=processing_time
            )
    
    def _determine_data_type(self, rule_name: str, url: str) -> Optional[str]:
        """根据规则名称和URL确定数据类型"""
        
        rule_mapping = {
            '评论接口': 'comment',
            '评论页面接口': 'comment_page',  # 新增评论页面接口
            '子评论页面接口': 'sub_comment_page',  # 新增子评论页面接口
            '通知接口': 'notification',
            '评论通知接口': 'comment_notification_feed',
            '通知列表': 'comment_notification_feed',  # 固化抓取规则的通知列表
            '笔记内容接口': 'note',
            '用户信息接口': 'user',
            '搜索接口': 'search',
            '热门推荐接口': 'recommendation'
        }
        
        if rule_name in rule_mapping:
            return rule_mapping[rule_name]
        
        url_patterns = {
            'comment': [r'/api/sns/web/v1/comment/'],
            'comment_page': [r'/api/sns/web/v2/comment/page'],  # 新增评论页面URL模式
            'sub_comment_page': [r'/api/sns/web/v2/comment/sub/page'],  # 新增子评论页面URL模式
            'notification': [r'/api/sns/web/v1/notify/'],
            'comment_notification_feed': [r'/api/sns/web/v1/you/mentions'],
            'note': [r'/api/sns/web/v1/feed/', r'/api/sns/web/v1/note/'],
            'user': [r'/api/sns/web/v1/user/', r'/api/sns/web/v2/user/'],
            'search': [r'/api/sns/web/v1/search/'],
            'recommendation': [r'/api/sns/web/v1/homefeed/']
        }
        
        for data_type, patterns in url_patterns.items():
            for pattern in patterns:
                if re.search(pattern, url):
                    return data_type
        
        return None
    
    async def _parse_response_data(self, raw_data: RawNetworkData, data_type: str) -> Optional[Any]:
        """解析响应数据"""
        
        if not raw_data.response_body:
            return None
        
        try:
            response_json = json.loads(raw_data.response_body)
            
            if data_type in self.parsers:
                # The parser now returns a dict for multi-type data or a list for single-type data
                return await self.parsers[data_type](response_json, raw_data)
            else:
                logger.warning(f"未找到数据类型 {data_type} 的解析器")
                return None
                
        except json.JSONDecodeError as e:
            logger.error(f"JSON解析失败: {e}")
            return None
        except Exception as e:
            logger.exception(f"解析响应数据时发生错误: {e}")
            return None

    def _safe_ts_to_dt(self, timestamp_s: Any) -> Optional[datetime]:
        """Safely convert second timestamp to datetime."""
        if not timestamp_s:
            return None
        try:
            return datetime.fromtimestamp(int(timestamp_s), tz=timezone.utc)
        except (ValueError, TypeError):
            return None

    async def _parse_comment_notification_feed_data(self, response_json: Dict, raw_data: RawNetworkData) -> Dict[str, List[Any]]:
        """
        从 'mentions' API 响应中解析出多种类型的数据 (通知, 评论, 笔记, 用户).
        """
        notifications, comments, notes, users = [], [], [], []
        user_ids = set()

        # 检查响应是否成功
        if not response_json.get('success', True) or response_json.get('code') != 0:
            logger.warning(f"[通知列表解析] 接口返回失败响应: code={response_json.get('code')}, success={response_json.get('success')}, msg={response_json.get('msg')}")
            return {}

        if 'data' not in response_json or 'message_list' not in response_json['data']:
            logger.warning(f"[通知列表解析] 响应中缺少data字段或message_list字段")
            return {}

        for message in response_json['data']['message_list']:
            if not isinstance(message, dict): continue

            # 1. Extract User Info
            # Extract user from the main user_info (who performed the action)
            if 'user_info' in message and isinstance(message['user_info'], dict):
                user_obj = self._extract_user_from_dict(message['user_info'])
                if user_obj and user_obj.id not in user_ids:
                    users.append(user_obj)
                    user_ids.add(user_obj.id)
            
            # Extract user from the item_info (the author of the note)
            if 'item_info' in message and isinstance(message['item_info'], dict) \
                and 'user_info' in message['item_info'] and isinstance(message['item_info']['user_info'], dict):
                item_user_obj = self._extract_user_from_dict(message['item_info']['user_info'])
                if item_user_obj and item_user_obj.id not in user_ids:
                    users.append(item_user_obj)
                    user_ids.add(item_user_obj.id)
            
            # 2. Extract Note Info
            if 'item_info' in message and isinstance(message['item_info'], dict):
                note_obj = self._extract_note_from_mention(message['item_info'])
                if note_obj:
                    notes.append(note_obj)

            # 3. Extract Comment Info
            if 'comment_info' in message and isinstance(message['comment_info'], dict):
                comment_obj = self._extract_comment_from_mention(message)
                if comment_obj:
                    comments.append(comment_obj)
            
            # 4. Extract Notification Info - 功能已废弃
            # notification_obj = self._extract_notification_from_mention(message)
            # if notification_obj:
            #     notifications.append(notification_obj)

        return {
            "notifications": notifications,
            "comments": comments,
            "notes": notes,
            "users": users
        }
    
    def _extract_user_from_dict(self, user_data: Dict) -> Optional[UserInfo]:
        # 支持多种用户ID字段名
        user_id = user_data.get('userid') or user_data.get('id')
        if not user_data or not user_id:
            return None
        return UserInfo(
            id=user_id,
            name=user_data.get('nickname'),
            avatar=user_data.get('image') or user_data.get('avatar'),
            official_verify_type=user_data.get('official_verify_type'),
            red_official_verify_type=user_data.get('red_official_verify_type'),
            indicator=user_data.get('indicator')
        )
        
    def _extract_note_from_mention(self, item_info: Dict) -> Optional[Note]:
        if not item_info or not item_info.get('id'):
            return None
        
        # 提取用户信息
        user_info = item_info.get('user_info', {})
        author_id = user_info.get('userid') or user_info.get('id')
        
        # 调试日志：输出原始数据结构
        logger.debug(f"提取笔记信息，原始item_info: {json.dumps(item_info, ensure_ascii=False, indent=2)}")
        
        # 尝试多种可能的字段名来提取笔记信息
        note_id = item_info.get('id')
        title = (item_info.get('title') or 
                item_info.get('note_title') or 
                item_info.get('display_title') or 
                item_info.get('content', '').split('\n')[0][:50] if item_info.get('content') else None)  # 如果没有标题，用内容的第一行
        
        content = (item_info.get('content') or 
                  item_info.get('desc') or 
                  item_info.get('note_content') or 
                  item_info.get('display_content'))
        
        # 尝试多种时间字段
        publish_time = (self._safe_ts_to_dt(item_info.get('add_time')) or
                       self._safe_ts_to_dt(item_info.get('publish_time')) or
                       self._safe_ts_to_dt(item_info.get('create_time')) or
                       self._safe_ts_to_dt(item_info.get('time')))
        
        # 尝试提取交互数据
        interact_info = item_info.get('interact_info', {})
        like_count = (interact_info.get('liked_count') or 
                     interact_info.get('like_count') or 
                     item_info.get('like_count') or 
                     item_info.get('liked_count') or 0)
        
        comment_count = (interact_info.get('comment_count') or 
                        item_info.get('comment_count') or 
                        item_info.get('comments_count') or 0)
        
        logger.info(f"提取笔记信息 - ID: {note_id}, 标题: {title}, 内容长度: {len(content) if content else 0}, "
                   f"发布时间: {publish_time}, 点赞数: {like_count}, 评论数: {comment_count}")
        
        return Note(
            noteId=note_id,
            title=title,
            noteContent=content,
            authorId=author_id,
            publishTime=publish_time,
            noteLike=like_count,
            noteCommitCount=comment_count,
            illegal_info=IllegalInfo(**item_info['illegal_info']) if 'illegal_info' in item_info else None
        )
        
    def _extract_comment_from_mention(self, message: Dict) -> Optional[CommentItem]:
        comment_info = message.get('comment_info')
        item_info = message.get('item_info') # 笔记信息
        if not comment_info or not item_info or not comment_info.get('id'):
            return None
        
        # 提取用户信息
        user_info = message.get('user_info', {})
        author_id = user_info.get('userid') or user_info.get('id')
        author_name = user_info.get('nickname')
        author_avatar = user_info.get('image')

        return CommentItem(
            id=comment_info.get('id'),
            noteId=item_info.get('id'),
            content=comment_info.get('content'),
            authorId=author_id,
            authorName=author_name,
            authorAvatar=author_avatar,
            timestamp=self._safe_ts_to_dt(comment_info.get('create_time')),
            likeCount=str(comment_info.get('like_count', 0)),
            ipLocation=comment_info.get('ip_location'),
            parentCommentId=None # mentions API 中的评论通常是顶级评论
        )

    def _extract_notification_from_mention(self, message: Dict) -> Optional[Dict]:
        # 功能已废弃
        return None

    async def _parse_comment_data(self, response_json: Dict, raw_data: RawNetworkData) -> List[CommentItem]:
        """解析评论数据"""
        comments = []
        
        if 'data' in response_json:
            data = response_json['data']
            
            if 'comments' in data:
                for comment_item in data['comments']:
                    comment = self._extract_comment_from_api_response(comment_item)
                    if comment:
                        comments.append(CommentItem(**comment))
            
            elif 'comment' in data:
                comment = self._extract_comment_from_api_response(data['comment'])
                if comment:
                    comments.append(CommentItem(**comment))
        
        return comments
    
    async def _parse_comment_page_data(self, response_json: Dict, raw_data: RawNetworkData) -> Dict[str, List[Any]]:
        """解析评论页面数据 - 从 /api/sns/web/v2/comment/page 接口"""
        comments, users, notes = [], [], []
        user_ids = set()
        
        # 检查响应是否成功
        if not response_json.get('success', True) or response_json.get('code') != 0:
            logger.warning(f"[评论页面解析] 接口返回失败响应: code={response_json.get('code')}, success={response_json.get('success')}, msg={response_json.get('msg')}")
            return {}
        
        if 'data' not in response_json:
            logger.warning(f"[评论页面解析] 响应中缺少data字段")
            return {}
        
        data = response_json['data']
        
        # 从URL中提取note_id
        note_id = None
        if hasattr(raw_data, 'url') and raw_data.url:
            import re
            match = re.search(r'note_id=([^&]+)', raw_data.url)
            if match:
                note_id = match.group(1)
        
        # 解析评论列表
        if 'comments' in data and isinstance(data['comments'], list):
            for comment_data in data['comments']:
                if not isinstance(comment_data, dict):
                    continue
                
                # 提取评论信息
                comment_dict = self._extract_comment_from_api_response(comment_data)
                if comment_dict:
                    # 如果从URL中提取到了note_id，设置到评论中
                    if note_id and not comment_dict.get('noteId'):
                        comment_dict['noteId'] = note_id
                    
                    comments.append(CommentItem(**comment_dict))
                
                # 提取评论作者用户信息
                if 'user_info' in comment_data and isinstance(comment_data['user_info'], dict):
                    user_obj = self._extract_user_from_dict(comment_data['user_info'])
                    if user_obj and user_obj.id not in user_ids:
                        users.append(user_obj)
                        user_ids.add(user_obj.id)
                
                # 解析子评论
                if 'sub_comments' in comment_data and isinstance(comment_data['sub_comments'], list):
                    for sub_comment_data in comment_data['sub_comments']:
                        if not isinstance(sub_comment_data, dict):
                            continue
                        
                        sub_comment_dict = self._extract_comment_from_api_response(sub_comment_data)
                        if sub_comment_dict:
                            # 设置父评论ID
                            sub_comment_dict['parentCommentId'] = comment_dict.get('id', '')
                            if note_id and not sub_comment_dict.get('noteId'):
                                sub_comment_dict['noteId'] = note_id
                            
                            comments.append(CommentItem(**sub_comment_dict))
                        
                        # 提取子评论作者用户信息
                        if 'user_info' in sub_comment_data and isinstance(sub_comment_data['user_info'], dict):
                            sub_user_obj = self._extract_user_from_dict(sub_comment_data['user_info'])
                            if sub_user_obj and sub_user_obj.id not in user_ids:
                                users.append(sub_user_obj)
                                user_ids.add(sub_user_obj.id)
        
        # 构建笔记信息（如果有note_id）
        if note_id:
            # 检查是否已经存在该笔记的完整信息
            # 如果数据库中已有该笔记的完整信息，不要创建基础笔记对象
            
            try:
                database = await get_database()
                notes_collection = database[NOTES_COLLECTION]
                existing_note = await notes_collection.find_one({"noteId": note_id})
                
                if existing_note:
                    # 如果已存在笔记，使用现有的完整信息
                    note_dict = {
                        'noteId': existing_note.get('noteId'),
                        'title': existing_note.get('title', ''),
                        'noteContent': existing_note.get('noteContent', ''),
                        'authorId': existing_note.get('authorId', ''),
                        'publishTime': existing_note.get('publishTime'),
                        'noteLike': existing_note.get('noteLike', 0),
                        'noteCommitCount': len(comments),  # 使用当前评论数量
                    }
                    logger.info(f"[评论页面解析] 使用已存在的笔记信息: {note_id}, 标题: {existing_note.get('title', '无标题')}")
                else:
                    # 如果不存在，创建基本笔记对象，但不设置空标题
                    note_dict = {
                        'noteId': note_id,
                        'title': None,  # 设为None而不是空字符串，避免覆盖后续的标题信息
                        'noteContent': '',
                        'authorId': '',
                        'publishTime': None,
                        'noteLike': 0,
                        'noteCommitCount': len(comments),
                    }
                    logger.info(f"[评论页面解析] 创建基础笔记对象: {note_id}")
                
                notes.append(Note(**note_dict))
            except Exception as e:
                logger.warning(f"[评论页面解析] 查询现有笔记信息失败: {e}, 跳过笔记创建")
        
        logger.info(f"[评论页面解析] 提取到 {len(comments)} 条评论, {len(users)} 个用户, {len(notes)} 个笔记")
        
        return {
            'comments': comments,
            'users': users,
            'notes': notes
        }
    
    async def _parse_sub_comment_page_data(self, response_json: Dict, raw_data: RawNetworkData) -> Dict[str, List[Any]]:
        """
        解析子评论页面数据 (/api/sns/web/v2/comment/sub/page)
        
        子评论页面包含回复和子回复的评论数据
        """
        comments, users, notes = [], [], []
        user_ids = set()
        note_ids = set()
        
        logger.info(f"[子评论页面解析] 开始解析子评论页面数据")
        
        # 检查响应是否成功
        if not response_json.get('success', True) or response_json.get('code') != 0:
            logger.warning(f"[子评论页面解析] 接口返回失败响应: code={response_json.get('code')}, success={response_json.get('success')}, msg={response_json.get('msg')}")
            return {}

        if 'data' not in response_json or 'comments' not in response_json['data']:
            logger.warning(f"[子评论页面解析] 响应中缺少data字段或comments字段")
            return {}
        
        # 解析子评论列表
        for comment_data in response_json['data']['comments']:
            if not isinstance(comment_data, dict):
                continue
            
            try:
                # 1. 提取评论信息
                comment_dict = self._extract_comment_from_api_response(comment_data)
                if comment_dict:
                    comments.append(CommentItem(**comment_dict))
                    
                    # 记录笔记ID
                    note_id = comment_dict.get('noteId')
                    if note_id:
                        note_ids.add(note_id)
                
                # 2. 提取用户信息（评论作者）
                if 'user_info' in comment_data and isinstance(comment_data['user_info'], dict):
                    user_obj = self._extract_user_from_dict(comment_data['user_info'])
                    if user_obj and user_obj.id not in user_ids:
                        users.append(user_obj)
                        user_ids.add(user_obj.id)
                
                # 3. 提取被回复评论的用户信息
                if 'target_comment' in comment_data and isinstance(comment_data['target_comment'], dict):
                    target_comment = comment_data['target_comment']
                    if 'user_info' in target_comment and isinstance(target_comment['user_info'], dict):
                        target_user_obj = self._extract_user_from_dict(target_comment['user_info'])
                        if target_user_obj and target_user_obj.id not in user_ids:
                            users.append(target_user_obj)
                            user_ids.add(target_user_obj.id)
                            
            except Exception as e:
                logger.warning(f"[子评论页面解析] 解析评论失败: {e}")
                continue
        
        # 4. 为每个笔记ID创建基础笔记对象（如果数据库中不存在）
        for note_id in note_ids:
            try:
                db = await get_database()
                existing_note = await db[NOTES_COLLECTION].find_one({"noteId": note_id})
                
                if not existing_note:
                    note_dict = {
                        'noteId': note_id,
                        'title': f'笔记-{note_id}',
                        'noteContent': '',
                        'authorId': '',
                        'publishTime': None,
                        'noteLike': 0,
                        'noteCommitCount': len([c for c in comments if c.noteId == note_id]),
                    }
                    logger.info(f"[子评论页面解析] 创建基础笔记对象: {note_id}")
                
                notes.append(Note(**note_dict))
            except Exception as e:
                logger.warning(f"[子评论页面解析] 查询现有笔记信息失败: {e}, 跳过笔记创建")
        
        logger.info(f"[子评论页面解析] 提取到 {len(comments)} 条子评论, {len(users)} 个用户, {len(notes)} 个笔记")
        
        return {
            'comments': comments,
            'users': users,
            'notes': notes
        }
    
    async def _parse_notification_data(self, response_json: Dict, raw_data: RawNetworkData) -> List[Dict]:
        # 功能已废弃
        return []

    async def _parse_note_data(self, response_json: Dict, raw_data: RawNetworkData) -> List[Note]:
        """解析笔记数据"""
        notes = []
        if 'data' in response_json and 'items' in response_json['data']:
            for item in response_json['data']['items']:
                note_data = item.get('note_card', {}).get('display_note', {}) or item.get('note')
                if note_data:
                    note = self._extract_note_from_api_response(note_data)
                    if note:
                        notes.append(Note(**note))
        return notes
    
    async def _parse_user_data(self, response_json: Dict, raw_data: RawNetworkData) -> List[Dict[str, Any]]:
        """解析用户数据"""
        users = []
        
        if 'data' in response_json:
            data = response_json['data']
            
            if 'user_info' in data or 'user' in data:
                user_data = data.get('user_info', data.get('user'))
                user = self._extract_user_from_api_response(user_data)
                if user:
                    users.append(user)
        
        return users
    
    async def _parse_search_data(self, response_json: Dict, raw_data: RawNetworkData) -> List[Dict[str, Any]]:
        """解析搜索数据"""
        return []

    async def _parse_recommendation_data(self, response_json: Dict, raw_data: RawNetworkData) -> List[Dict[str, Any]]:
        """解析推荐数据"""
        return []

    def _extract_comment_from_api_response(self, comment_data: Dict) -> Optional[Dict[str, Any]]:
        """从API响应中提取评论信息"""
        try:
            # 处理时间戳转换
            create_time = comment_data.get('create_time')
            if create_time and isinstance(create_time, (int, float)):
                # 如果是毫秒时间戳，转换为秒
                if create_time > 1e10:  # 大于10位数，认为是毫秒
                    create_time = create_time / 1000
                timestamp = datetime.fromtimestamp(create_time, tz=timezone.utc)
            else:
                timestamp = None
            
            # 处理target_comment字段，建立回复关系
            target_comment_id = None
            if 'target_comment' in comment_data and comment_data['target_comment']:
                target_comment_id = comment_data['target_comment'].get('id')
                logger.info(f"[评论解析] 评论 {comment_data.get('id')} 的target_comment: {comment_data['target_comment']}")
                logger.info(f"[评论解析] 提取到的target_comment_id: {target_comment_id}")
            else:
                logger.info(f"[评论解析] 评论 {comment_data.get('id')} 没有target_comment字段")
            
            return {
                'id': comment_data.get('id', ''),
                'content': comment_data.get('content', ''),
                'authorName': comment_data.get('user_info', {}).get('nickname', ''),
                'authorId': comment_data.get('user_info', {}).get('user_id', ''),
                'authorAvatar': comment_data.get('user_info', {}).get('image', ''),
                'timestamp': timestamp,
                'likeCount': str(comment_data.get('like_count', 0)),
                'ipLocation': comment_data.get('ip_location', ''),
                'noteId': comment_data.get('note_id', ''),
                'status': comment_data.get('status', 0),  # 新增status字段
                'liked': comment_data.get('liked', False),  # 新增liked字段
                'parentCommentId': target_comment_id,  # 添加回复关系
            }
        except Exception as e:
            logger.error(f"提取评论信息失败: {e}")
            return None
    
    def _extract_notification_from_api_response(self, notification_data: Dict) -> Optional[Dict[str, Any]]:
        """从API响应中提取通知信息"""
        return None

    def _extract_note_from_api_response(self, note_data: Dict) -> Optional[Dict[str, Any]]:
        """从API响应中提取笔记信息"""
        try:
            user_info = note_data.get('user', {}) or note_data.get('user_info', {})
            interact_info = note_data.get('interact_info', {})
            return {
                'noteId': note_data.get('id') or note_data.get('note_id'),
                'title': note_data.get('title', ''),
                'noteContent': note_data.get('desc', ''),
                'authorId': user_info.get('id') or user_info.get('user_id'),
                'publishTime': self._safe_ts_to_dt(note_data.get('add_time')) or self._safe_ts_to_dt(note_data.get('time')),
                'noteLike': interact_info.get('liked_count', 0),
                'noteCommitCount': interact_info.get('comment_count', 0),
            }
        except Exception as e:
            logger.error(f"提取笔记信息失败: {e}")
            return None
    
    def _extract_user_from_api_response(self, user_data: Dict) -> Optional[Dict[str, Any]]:
        """从API响应中提取用户信息"""
        try:
            return {
                'id': user_data.get('user_id') or user_data.get('id'),
                'name': user_data.get('nickname'),
                'avatar': user_data.get('image') or user_data.get('avatar'),
            }
        except Exception as e:
            logger.error(f"提取用户信息失败: {e}")
            return None

    async def _save_parsed_data(self, data_type: str, parsed_data: Any) -> Dict[str, Any]:
        """保存解析后的数据"""
        try:
            if data_type == 'comment':
                comments_dicts = [comment.model_dump() for comment in parsed_data]
                result = await save_comments_with_upsert(comments_dicts)
                return {'success': True, 'saved_count': result.get('inserted', 0) + result.get('updated', 0)}
            
            elif data_type == 'comment_page':
                if not isinstance(parsed_data, dict):
                    return {'success': False, 'error': 'Invalid data format for comment_page'}

                total_saved = 0
                
                # Save users
                users_list = parsed_data.get('users', [])
                if users_list:
                    saved_user_count = 0
                    for user in users_list:
                        res = await save_user_info(user.model_dump())
                        if res.get('success'):
                            saved_user_count += 1
                    total_saved += saved_user_count

                # Save notes
                notes_list = parsed_data.get('notes', [])
                if notes_list:
                    notes_dicts = [note.model_dump() for note in notes_list]
                    res = await save_notes(notes_dicts)
                    total_saved += res.get('inserted', 0) + res.get('updated', 0)

                # Save comments - 转换为结构化评论并保存
                comments_list = parsed_data.get('comments', [])
                if comments_list:
                    # 将CommentItem转换为结构化评论格式
                    structured_comments = []
                    for comment in comments_list:
                        comment_dict = comment.model_dump()
                        # 转换为结构化评论格式
                        structured_comment = {
                            "commentId": comment_dict.get('id'),
                            "noteId": comment_dict.get('noteId'),
                            "content": comment_dict.get('content'),
                            "authorId": comment_dict.get('authorId'),
                            "authorName": comment_dict.get('authorName'),
                            "authorAvatar": comment_dict.get('authorAvatar'),
                            "timestamp": comment_dict.get('timestamp'),
                            "repliedId": comment_dict.get('parentCommentId'),  # 父评论ID
                            "repliedOrder": None,
                            "fetchTimestamp": datetime.utcnow(),
                            "likeCount": comment_dict.get('likeCount'),
                            "ipLocation": comment_dict.get('ipLocation'),
                            "illegal_info": comment_dict.get('illegal_info')
                        }
                        
                        # 添加调试日志
                        if comment_dict.get('parentCommentId'):
                            logger.info(f"[评论页面数据处理] 子评论 {comment_dict.get('id')} 回复 {comment_dict.get('parentCommentId')}")
                        else:
                            logger.info(f"[评论页面数据处理] 主评论 {comment_dict.get('id')}")
                        
                        structured_comments.append(structured_comment)
                    
                    # 保存到结构化评论集合
                    from ..services.comment import save_structured_comments
                    res = await save_structured_comments(structured_comments)
                    total_saved += res.get('upserted', 0) + res.get('matched', 0)
                
                return {'success': True, 'saved_count': total_saved}
            
            elif data_type == 'sub_comment_page':
                if not isinstance(parsed_data, dict):
                    return {'success': False, 'error': 'Invalid data format for sub_comment_page'}

                total_saved = 0
                
                # Save users
                users_list = parsed_data.get('users', [])
                if users_list:
                    saved_user_count = 0
                    for user in users_list:
                        res = await save_user_info(user.model_dump())
                        if res.get('success'):
                            saved_user_count += 1
                    total_saved += saved_user_count

                # Save notes
                notes_list = parsed_data.get('notes', [])
                if notes_list:
                    notes_dicts = [note.model_dump() for note in notes_list]
                    res = await save_notes(notes_dicts)
                    total_saved += res.get('inserted', 0) + res.get('updated', 0)

                # Save comments - 转换为结构化评论并保存
                comments_list = parsed_data.get('comments', [])
                if comments_list:
                    # 将CommentItem转换为结构化评论格式
                    structured_comments = []
                    for comment in comments_list:
                        comment_dict = comment.model_dump()
                        # 转换为结构化评论格式
                        structured_comment = {
                            "commentId": comment_dict.get('id'),
                            "noteId": comment_dict.get('noteId'),
                            "content": comment_dict.get('content'),
                            "authorId": comment_dict.get('authorId'),
                            "authorName": comment_dict.get('authorName'),
                            "authorAvatar": comment_dict.get('authorAvatar'),
                            "timestamp": comment_dict.get('timestamp'),
                            "repliedId": comment_dict.get('parentCommentId'),  # 父评论ID
                            "repliedOrder": None,
                            "fetchTimestamp": datetime.utcnow(),
                            "likeCount": comment_dict.get('likeCount'),
                            "ipLocation": comment_dict.get('ipLocation'),
                            "illegal_info": comment_dict.get('illegal_info')
                        }
                        
                        # 添加调试日志
                        if comment_dict.get('parentCommentId'):
                            logger.info(f"[子评论页面数据处理] 子评论 {comment_dict.get('id')} 回复 {comment_dict.get('parentCommentId')}")
                        else:
                            logger.info(f"[子评论页面数据处理] 主评论 {comment_dict.get('id')}")
                        
                        structured_comments.append(structured_comment)
                    
                    # 保存到结构化评论集合
                    from ..services.comment import save_structured_comments
                    res = await save_structured_comments(structured_comments)
                    total_saved += res.get('upserted', 0) + res.get('matched', 0)
                
                return {'success': True, 'saved_count': total_saved}
            
            elif data_type == 'note':
                result = await save_notes(parsed_data)
                return {'success': True, 'saved_count': result.get('inserted', 0) + result.get('updated', 0)}
            
            elif data_type == 'notification':
                # 功能已废弃，不再保存
                return {'success': True, 'saved_count': 0, 'message': 'notification data saving is deprecated'}
            
            elif data_type == 'comment_notification_feed':
                if not isinstance(parsed_data, dict):
                    return {'success': False, 'error': 'Invalid data format for feed'}

                total_saved = 0
                
                # Save users
                users_list = parsed_data.get('users', [])
                if users_list:
                    saved_user_count = 0
                    for user in users_list:
                        res = await save_user_info(user.model_dump())
                        if res.get('success'):
                            saved_user_count += 1
                    total_saved += saved_user_count

                # Save notes
                notes_list = parsed_data.get('notes', [])
                if notes_list:
                    notes_dicts = [note.model_dump() for note in notes_list]
                    res = await save_notes(notes_dicts)
                    total_saved += res.get('inserted', 0) + res.get('updated', 0)

                # Save comments - 修复：转换为结构化评论并保存
                comments_list = parsed_data.get('comments', [])
                if comments_list:
                    # 将CommentItem转换为结构化评论格式
                    structured_comments = []
                    for comment in comments_list:
                        comment_dict = comment.model_dump()
                        # 转换为结构化评论格式
                        structured_comment = {
                            "commentId": comment_dict.get('id'),
                            "noteId": comment_dict.get('noteId'),
                            "content": comment_dict.get('content'),
                            "authorId": comment_dict.get('authorId'),
                            "authorName": comment_dict.get('authorName'),
                            "authorAvatar": comment_dict.get('authorAvatar'),
                            "timestamp": comment_dict.get('timestamp'),
                            "repliedId": None,  # mentions API中的评论通常是顶级评论
                            "repliedOrder": None,
                            "fetchTimestamp": datetime.utcnow(),
                            "likeCount": comment_dict.get('likeCount'),
                            "ipLocation": comment_dict.get('ipLocation'),
                            "illegal_info": comment_dict.get('illegal_info')
                        }
                        structured_comments.append(structured_comment)
                    
                    # 保存到结构化评论集合
                    from ..services.comment import save_structured_comments
                    res = await save_structured_comments(structured_comments)
                    total_saved += res.get('upserted', 0) + res.get('matched', 0)

                # Save notifications - 功能已废弃，不再保存
                # notifications_list = parsed_data.get('notifications', [])
                # if notifications_list:
                #     notifications_dicts = [n.model_dump() for n in notifications_list]
                #     res = await save_notifications(notifications_dicts)
                #     total_saved += res.get('inserted', 0) + res.get('updated', 0)
                
                return {'success': True, 'saved_count': total_saved}
            
            elif data_type == 'user':
                saved_count = 0
                for user_data in parsed_data:
                    user_info = UserInfo(**user_data)
                    result = await save_user_info(user_info.model_dump())
                    if result.get('success'):
                        saved_count += 1
                return {'success': True, 'saved_count': saved_count}
            
            else:
                return {'success': False, 'error': f'不支持的数据类型: {data_type}'}
                
        except Exception as e:
            logger.exception(f"保存解析数据时发生错误: {e}")
            return {'success': False, 'error': str(e)}

# 全局处理器实例
network_processor = NetworkDataProcessor() 