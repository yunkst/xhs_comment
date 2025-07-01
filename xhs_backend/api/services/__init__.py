"""
API服务包

包含API使用的各种服务功能
"""

# 导出会话管理功能
from .session import (
    create_session,
    get_session,
    update_session_tokens,
    cleanup_expired_sessions,
    SESSION_EXPIRY_MINUTES
)

# 导出用户相关服务
from .user import (
    get_user_by_username,
    create_user,
    verify_user_password,
    get_user_info,
    batch_get_user_info,
    get_all_user_info_paginated,
    save_user_info
)

# 导出评论相关服务
from .comment import (
    save_comments_with_upsert,
    save_structured_comments,
    get_user_historical_comments,
    merge_comment_data
)

# 导出笔记相关服务
from .note import (
    save_notes,
    get_note_by_id,
    search_notes
)

# 导出用户备注相关服务
from .notification import (
    save_user_note,
    get_user_notes
)
