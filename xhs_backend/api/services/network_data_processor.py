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
from ..models.notification import NotificationItem
from ..models.common import UserInfo
from ..services.comment import save_comments_with_upsert
from ..services.note import save_notes
from ..services.notification import save_notifications
from ..services.user import save_user_info

logger = logging.getLogger(__name__)

class NetworkDataProcessor:
    """网络数据处理器"""
    
    def __init__(self):
        self.parsers = {
            'comment': self._parse_comment_data,
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
            '通知接口': 'notification',
            '评论通知接口': 'comment_notification_feed', 
            '笔记内容接口': 'note',
            '用户信息接口': 'user',
            '搜索接口': 'search',
            '热门推荐接口': 'recommendation'
        }
        
        if rule_name in rule_mapping:
            return rule_mapping[rule_name]
        
        url_patterns = {
            'comment': [r'/api/sns/web/v1/comment/', r'/api/sns/web/v2/comment/'],
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

        if 'data' not in response_json or 'message_list' not in response_json['data']:
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
            
            # 4. Extract Notification Info
            notification_obj = self._extract_notification_from_mention(message)
            if notification_obj:
                notifications.append(notification_obj)

        return {
            "notifications": notifications,
            "comments": comments,
            "notes": notes,
            "users": users
        }
    
    def _extract_user_from_dict(self, user_data: Dict) -> Optional[UserInfo]:
        if not user_data or not user_data.get('id'):
            return None
        return UserInfo(
            id=user_data.get('id'),
            name=user_data.get('nickname'),
            avatar=user_data.get('avatar'),
            official_verify_type=user_data.get('official_verify_type'),
            red_official_verify_type=user_data.get('red_official_verify_type'),
            indicator=user_data.get('indicator')
        )
        
    def _extract_note_from_mention(self, item_info: Dict) -> Optional[Note]:
        if not item_info or not item_info.get('id'):
            return None
        return Note(
            noteId=item_info.get('id'),
            title=item_info.get('title'),
            noteContent=item_info.get('desc'), # Assuming 'desc' is the content
            authorId=item_info.get('user_info', {}).get('id'),
            illegal_info=IllegalInfo(**item_info['illegal_info']) if 'illegal_info' in item_info else None,
            publishTime=self._safe_ts_to_dt(item_info.get('add_time'))
        )
        
    def _extract_comment_from_mention(self, message: Dict) -> Optional[CommentItem]:
        comment_info = message.get('comment_info')
        if not comment_info or not comment_info.get('id'):
            return None
            
        note_id = message.get('item_info', {}).get('id')
        if not note_id:
            logger.warning(f"无法从 'mentions' 消息中提取到 note_id (item_info.id)，评论ID: {comment_info.get('id')}")
            # 即使没有note_id，也可能需要保存这条评论，取决于业务逻辑。暂时返回None。
            return None

        user_info = message.get('user_info', {}) # Correctly sourced from the top-level message object
        return CommentItem(
            id=comment_info.get('id'),
            noteId=note_id,
            content=comment_info.get('content'),
            authorId=user_info.get('userid'),
            authorName=user_info.get('nickname'),
            authorAvatar=user_info.get('image'),
            timestamp=self._safe_ts_to_dt(message.get('time')),
            likeCount=str(comment_info.get('like_count', 0)),
            ipLocation=comment_info.get('ip_location'),
            illegal_info=IllegalInfo(**comment_info['illegal_info']) if 'illegal_info' in comment_info else None,
            target_comment=comment_info.get('target_comment')
        )

    def _extract_notification_from_mention(self, message: Dict) -> Optional[NotificationItem]:
        if not message or not message.get('id'):
            return None
        return NotificationItem(
            id=message.get('id'),
            notification_name=message.get('notification_name'),
            title=message.get('title'),
            time=self._safe_ts_to_dt(message.get('time')),
            user_id=message.get('user_info', {}).get('id'),
            item_id=message.get('item_info', {}).get('id'),
            comment_id=message.get('comment_info', {}).get('id'),
            user_info=self._extract_user_from_dict(message.get('user_info')),
            item_info=message.get('item_info')
        )

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
    
    async def _parse_notification_data(self, response_json: Dict, raw_data: RawNetworkData) -> List[NotificationItem]:
        """解析通知数据"""
        # This parser might need to be re-evaluated based on its API source.
        # For now, this is just a placeholder, as the main focus is comment_notification_feed
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
            return {
                'id': comment_data.get('id', ''),
                'content': comment_data.get('content', ''),
                'authorName': comment_data.get('user_info', {}).get('nickname', ''),
                'authorId': comment_data.get('user_info', {}).get('user_id', ''),
                'authorAvatar': comment_data.get('user_info', {}).get('avatar', ''),
                'timestamp': comment_data.get('create_time', ''),
                'likeCount': str(comment_data.get('like_count', 0)),
                'ipLocation': comment_data.get('ip_location', ''),
                'noteId': comment_data.get('note_id', ''),
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
            
            elif data_type == 'note':
                result = await save_notes(parsed_data)
                return {'success': True, 'saved_count': result.get('inserted', 0) + result.get('updated', 0)}
            
            elif data_type == 'notification':
                result = await save_notifications(parsed_data)
                return {'success': True, 'saved_count': result.get('inserted', 0) + result.get('updated', 0)}
            
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

                # Save comments
                comments_list = parsed_data.get('comments', [])
                if comments_list:
                    comments_dicts = [c.model_dump() for c in comments_list]
                    res = await save_comments_with_upsert(comments_dicts)
                    total_saved += res.get('inserted', 0) + res.get('updated', 0)

                # Save notifications
                notifications_list = parsed_data.get('notifications', [])
                if notifications_list:
                    notifications_dicts = [n.model_dump() for n in notifications_list]
                    res = await save_notifications(notifications_dicts)
                    total_saved += res.get('inserted', 0) + res.get('updated', 0)
                
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