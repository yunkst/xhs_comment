"""
网络数据处理服务

负责将原始网络请求数据解析为结构化数据，并路由到相应的处理流程
"""
import json
import re
import logging
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
import asyncio

from ..models.network import RawNetworkData, ParsedNetworkData, DataProcessingResult
from ..models.content import CommentItem, Note
from ..models.notification import NotificationItem
from ..models.common import UserInfo
from ..services.comment import save_comments
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
            'note': self._parse_note_data,
            'user': self._parse_user_data,
            'search': self._parse_search_data,
            'recommendation': self._parse_recommendation_data
        }
    
    async def process_raw_data(self, raw_data: RawNetworkData) -> DataProcessingResult:
        """
        处理原始网络数据
        
        Args:
            raw_data: 原始网络数据
            
        Returns:
            处理结果
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
            
            processing_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            
            return DataProcessingResult(
                raw_data_id=str(raw_data.request_id),
                success=save_result['success'],
                data_type=data_type,
                items_extracted=len(parsed_data),
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
        
        # 规则名称映射
        rule_mapping = {
            '评论接口': 'comment',
            '通知接口': 'notification', 
            '笔记内容接口': 'note',
            '用户信息接口': 'user',
            '搜索接口': 'search',
            '热门推荐接口': 'recommendation'
        }
        
        if rule_name in rule_mapping:
            return rule_mapping[rule_name]
        
        # URL模式匹配
        url_patterns = {
            'comment': [r'/api/sns/web/v1/comment/', r'/api/sns/web/v2/comment/'],
            'notification': [r'/api/sns/web/v1/notify/'],
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
    
    async def _parse_response_data(self, raw_data: RawNetworkData, data_type: str) -> Optional[List[Dict[str, Any]]]:
        """解析响应数据"""
        
        if not raw_data.response_body:
            return None
        
        try:
            # 尝试解析JSON响应
            response_json = json.loads(raw_data.response_body)
            
            # 调用对应的解析器
            if data_type in self.parsers:
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
    
    async def _parse_comment_data(self, response_json: Dict, raw_data: RawNetworkData) -> List[Dict[str, Any]]:
        """解析评论数据"""
        comments = []
        
        # 小红书评论API的常见结构
        if 'data' in response_json:
            data = response_json['data']
            
            # 处理评论列表
            if 'comments' in data:
                for comment_item in data['comments']:
                    comment = self._extract_comment_from_api_response(comment_item)
                    if comment:
                        comments.append(comment)
            
            # 处理单个评论响应
            elif 'comment' in data:
                comment = self._extract_comment_from_api_response(data['comment'])
                if comment:
                    comments.append(comment)
        
        return comments
    
    async def _parse_notification_data(self, response_json: Dict, raw_data: RawNetworkData) -> List[Dict[str, Any]]:
        """解析通知数据"""
        notifications = []
        
        if 'data' in response_json:
            data = response_json['data']
            
            if 'items' in data or 'notifications' in data:
                items = data.get('items', data.get('notifications', []))
                for item in items:
                    notification = self._extract_notification_from_api_response(item)
                    if notification:
                        notifications.append(notification)
        
        return notifications
    
    async def _parse_note_data(self, response_json: Dict, raw_data: RawNetworkData) -> List[Dict[str, Any]]:
        """解析笔记数据"""
        notes = []
        
        if 'data' in response_json:
            data = response_json['data']
            
            # 处理单个笔记
            if 'note_info' in data or 'note' in data:
                note_data = data.get('note_info', data.get('note'))
                note = self._extract_note_from_api_response(note_data)
                if note:
                    notes.append(note)
            
            # 处理笔记列表
            elif 'items' in data:
                for item in data['items']:
                    if 'note_info' in item:
                        note = self._extract_note_from_api_response(item['note_info'])
                        if note:
                            notes.append(note)
        
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
        # 搜索结果可能包含多种类型的数据
        items = []
        
        if 'data' in response_json:
            data = response_json['data']
            
            if 'items' in data:
                for item in data['items']:
                    # 根据item类型分别处理
                    if 'note_info' in item:
                        note = self._extract_note_from_api_response(item['note_info'])
                        if note:
                            items.append({'type': 'note', 'data': note})
                    elif 'user_info' in item:
                        user = self._extract_user_from_api_response(item['user_info'])
                        if user:
                            items.append({'type': 'user', 'data': user})
        
        return items
    
    async def _parse_recommendation_data(self, response_json: Dict, raw_data: RawNetworkData) -> List[Dict[str, Any]]:
        """解析推荐数据"""
        return await self._parse_search_data(response_json, raw_data)  # 结构类似
    
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
        try:
            return {
                'id': notification_data.get('id', ''),
                'type': notification_data.get('type', ''),
                'content': notification_data.get('content', ''),
                'timestamp': notification_data.get('create_time', ''),
                'read': notification_data.get('is_read', False),
                'user': notification_data.get('user_info', {})
            }
        except Exception as e:
            logger.error(f"提取通知信息失败: {e}")
            return None
    
    def _extract_note_from_api_response(self, note_data: Dict) -> Optional[Dict[str, Any]]:
        """从API响应中提取笔记信息"""
        try:
            return {
                'noteId': note_data.get('note_id', ''),
                'title': note_data.get('title', ''),
                'content': note_data.get('desc', ''),
                'authorId': note_data.get('user', {}).get('user_id', ''),
                'publishTime': note_data.get('time', ''),
                'likeCount': note_data.get('interact_info', {}).get('liked_count', 0),
                'commentCount': note_data.get('interact_info', {}).get('comment_count', 0),
            }
        except Exception as e:
            logger.error(f"提取笔记信息失败: {e}")
            return None
    
    def _extract_user_from_api_response(self, user_data: Dict) -> Optional[Dict[str, Any]]:
        """从API响应中提取用户信息"""
        try:
            return {
                'id': user_data.get('user_id', ''),
                'name': user_data.get('nickname', ''),
                'avatar': user_data.get('avatar', ''),
                'description': user_data.get('desc', ''),
            }
        except Exception as e:
            logger.error(f"提取用户信息失败: {e}")
            return None
    
    async def _save_parsed_data(self, data_type: str, parsed_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """保存解析后的数据"""
        try:
            if data_type == 'comment':
                # 转换为CommentItem格式并保存
                comments = [CommentItem(**item) for item in parsed_data]
                result = await save_comments(comments)
                return {
                    'success': True,
                    'saved_count': result.get('inserted', 0) + result.get('updated', 0)
                }
            
            elif data_type == 'note':
                # 转换为Note格式并保存
                notes = [Note(**item) for item in parsed_data]
                result = await save_notes(notes)
                return {
                    'success': True,
                    'saved_count': result.get('inserted', 0) + result.get('updated', 0)
                }
            
            elif data_type == 'notification':
                # 转换为NotificationItem格式并保存
                notifications = [NotificationItem(**item) for item in parsed_data]
                result = await save_notifications(notifications)
                return {
                    'success': True,
                    'saved_count': result.get('inserted', 0) + result.get('updated', 0)
                }
            
            elif data_type == 'user':
                # 保存用户信息
                saved_count = 0
                for user_data in parsed_data:
                    user_info = UserInfo(**user_data)
                    result = await save_user_info(user_info.dict())
                    if result.get('success'):
                        saved_count += 1
                
                return {
                    'success': True,
                    'saved_count': saved_count
                }
            
            elif data_type in ['search', 'recommendation']:
                # 搜索和推荐数据包含多种类型，分别处理
                saved_count = 0
                for item in parsed_data:
                    item_type = item.get('type')
                    item_data = item.get('data')
                    if item_type and item_data:
                        sub_result = await self._save_parsed_data(item_type, [item_data])
                        if sub_result.get('success'):
                            saved_count += sub_result.get('saved_count', 0)
                
                return {
                    'success': True,
                    'saved_count': saved_count
                }
            
            else:
                return {
                    'success': False,
                    'error': f'不支持的数据类型: {data_type}'
                }
                
        except Exception as e:
            logger.exception(f"保存解析数据时发生错误: {e}")
            return {
                'success': False,
                'error': str(e)
            }

# 全局处理器实例
network_processor = NetworkDataProcessor() 