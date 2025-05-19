"""
【重要提示】数据模型已移动

此模块仅提供向后兼容性，所有模型已移动到更合理的架构目录中：
- xhs_backend/api/models/common.py   - 通用模型
- xhs_backend/api/models/user.py     - 用户相关模型
- xhs_backend/api/models/content.py  - 评论和笔记模型
- xhs_backend/api/models/notification.py - 通知模型
- xhs_backend/api/models/auth.py     - 认证相关模型

请更新您的导入，使用新路径。
"""

import warnings
warnings.warn(
    "导入已弃用的models.py文件。请更新导入路径使用api/models/目录下的模块。",
    DeprecationWarning,
    stacklevel=2
)

# 重新导出所有模型，提供向后兼容性
from xhs_backend.api.models.common import UserInfo, IncomingPayload
from xhs_backend.api.models.notification import InteractionInfo, NotificationItem
from xhs_backend.api.models.content import CommentItem, StructuredComment, Note
from xhs_backend.api.models.user import (
    User, UserInRegister, UserInLogin, UserInDB, TokenResponse, UserNote
) 