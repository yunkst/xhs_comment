from fastapi import FastAPI, HTTPException, Depends, Header, status, Body
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware # 导入 CORS 中间件
from typing import Optional, Dict, Any, List
import os
import logging
from dotenv import load_dotenv
from contextlib import asynccontextmanager
from jose import JWTError, jwt
import pyotp
import qrcode
import io
from fastapi.responses import StreamingResponse
from models import IncomingPayload, UserInRegister, UserInLogin, TokenResponse, UserNote # 导入UserNote模型
from database import connect_to_mongo, close_mongo_connection, save_notifications, save_comments_with_upsert, save_structured_comments, save_notes, get_user_historical_comments, NOTIFICATIONS_COLLECTION, COMMENTS_COLLECTION, NOTES_COLLECTION, get_user_by_username, create_user, verify_user_password, save_user_note, get_user_notes # 导入用户备注函数
from processing import transform_raw_comments_to_structured # 导入转换函数
from datetime import datetime, timedelta
# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 加载 .env 文件
load_dotenv()

# 从环境变量获取API密钥
API_SECRET_TOKEN = os.getenv("API_SECRET_TOKEN")
if not API_SECRET_TOKEN:
    logger.warning("警告: API_SECRET_TOKEN 未在 .env 文件中设置！将使用默认值 'test_token'。请务必在生产环境中设置安全令牌！")
    API_SECRET_TOKEN = "test_token" # 提供一个默认值，但强烈建议用户设置

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change_this_secret")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7天
ALLOW_REGISTER = os.getenv("ALLOW_REGISTER", "true").lower() == "true"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭证",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    return username

# --- FastAPI 应用实例 ---
app = FastAPI(title="小红书数据接收服务", version="1.0.0")

# --- 配置 CORS 中间件 ---
# 允许所有来源 (开发时方便，生产环境应更严格)
# 或者明确指定插件来源: origins = ["chrome-extension://<你的插件ID>"]
origins = ["*"] # 允许所有来源

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"], # 允许的方法
    allow_headers=["Authorization", "Content-Type"], # 允许的请求头
)

# --- 安全性：Bearer Token 认证 ---
security = HTTPBearer()

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """验证传入的 Bearer Token"""
    if credentials.scheme != "Bearer" or credentials.credentials != API_SECRET_TOKEN:
        logger.warning(f"无效的 Token 尝试: {credentials.scheme} {credentials.credentials[:5]}...")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的认证令牌",
            headers={"WWW-Authenticate": "Bearer"},
        )
    logger.info("Token 验证通过")
    return credentials.credentials

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 应用启动时
    logger.info("应用启动，尝试连接数据库...")
    try:
        await connect_to_mongo()
    except Exception as e:
        logger.error(f"数据库连接失败，应用可能无法正常工作: {e}")
        # 根据需要决定是否阻止应用启动
    yield
    # 应用关闭时
    logger.info("应用关闭，断开数据库连接...")
    close_mongo_connection()

# --- API 端点 ---
@app.get("/", tags=["通用"])
async def read_root():
    """根路径，用于健康检查或基本信息"""
    return {"message": "小红书数据接收服务运行中"}

@app.post("/api/data", tags=["数据接收"], status_code=status.HTTP_201_CREATED)
async def receive_data(payload: IncomingPayload, username: str = Depends(get_current_user)) -> Dict[str, Any]:
    """接收插件发送的数据（通知、评论或笔记）"""
    logger.info(f"接收到类型为 '{payload.type}' 的数据，共 {len(payload.data)} 条")
    
    try:
        if payload.type == "通知":
            result = await save_notifications(payload.data)
            inserted = result.get('inserted_count', 0)
            message = f"成功接收并保存了 {inserted} 条 '{payload.type}' 数据"
            logger.info(message)
            return {"message": message, "inserted": inserted}
        elif payload.type == "评论":
            # 1. 保存原始评论数据
            logger.info("开始保存原始评论数据...")
            raw_save_result = await save_comments_with_upsert(payload.data)
            raw_inserted = raw_save_result.get('inserted', 0)
            raw_updated = raw_save_result.get('updated', 0)
            logger.info(f"原始评论数据保存完成 - 插入: {raw_inserted}, 更新: {raw_updated}")

            # 2. 转换评论数据为结构化格式
            logger.info("开始转换评论数据为结构化格式...")
            try:
                structured_data = transform_raw_comments_to_structured(payload.data)
                logger.info(f"成功转换 {len(structured_data)} 条评论为结构化格式")
            except Exception as e:
                logger.error(f"转换评论数据时出错: {e}", exc_info=True)
                # 即使转换失败，原始数据已保存，可以返回部分成功信息
                message = f"成功保存 {raw_inserted + raw_updated} 条原始评论 (插入: {raw_inserted}, 更新: {raw_updated})，但结构化处理失败。"
                # 返回 500 错误可能更合适，表示处理未完全成功
                raise HTTPException(status_code=500, detail=f"原始评论已保存，但结构化处理失败: {e}")

            # 3. 保存结构化评论数据
            if structured_data:
                logger.info("开始保存结构化评论数据...")
                structured_save_result = await save_structured_comments(structured_data)
                struct_upserted = structured_save_result.get('upserted', 0)
                struct_matched = structured_save_result.get('matched', 0)
                struct_failed = structured_save_result.get('failed', 0)
                logger.info(f"结构化评论数据保存完成 - 新增/Upserted: {struct_upserted}, 匹配/Matched: {struct_matched}, 失败: {struct_failed}")
                
                message = (f"处理完成。原始评论: 插入={raw_inserted}, 更新={raw_updated}. "
                           f"结构化评论: 新增/更新={struct_upserted}, 匹配={struct_matched}, 失败={struct_failed}.")
                return {
                    "message": message,
                    "raw_inserted": raw_inserted,
                    "raw_updated": raw_updated,
                    "structured_upserted": struct_upserted,
                    "structured_matched": struct_matched,
                    "structured_failed": struct_failed
                }
            else:
                logger.info("没有生成结构化评论数据需要保存。")
                message = f"成功保存 {raw_inserted + raw_updated} 条原始评论 (插入: {raw_inserted}, 更新: {raw_updated})。未生成结构化数据。"
                return {
                    "message": message,
                    "raw_inserted": raw_inserted,
                    "raw_updated": raw_updated
                }
        elif payload.type == "笔记":
            # 保存笔记数据
            logger.info("开始保存笔记数据...")
            result = await save_notes(payload.data)
            inserted = result.get('inserted', 0)
            updated = result.get('updated', 0)
            logger.info(f"笔记数据保存完成 - 插入: {inserted}, 更新: {updated}")
            
            message = f"成功保存 {inserted + updated} 条笔记数据 (插入: {inserted}, 更新: {updated})"
            return {
                "message": message,
                "inserted": inserted,
                "updated": updated
            }
        else:
            logger.error(f"接收到无效的数据类型: {payload.type}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无效的数据类型")

    except Exception as e:
        logger.exception(f"处理类型为 '{payload.type}' 的数据时发生数据库错误")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"保存数据时出错: {e}")

# --- 添加获取用户历史评论的API端点 ---
@app.get("/api/user/{user_id}/comments", tags=["数据查询"], response_model=List[Dict[str, Any]])
async def get_user_comments(user_id: str, username: str = Depends(get_current_user)) -> List[Dict[str, Any]]:
    """获取指定用户ID的所有历史评论
    
    Args:
        user_id: 用户ID
        username: 认证用户名
        
    Returns:
        包含用户评论及相关笔记信息的列表，按时间降序排序
    """
    logger.info(f"查询用户 {user_id} 的历史评论")
    
    try:
        # 调用数据库函数获取历史评论
        comments = await get_user_historical_comments(user_id)
        
        if not comments:
            logger.info(f"未找到用户 {user_id} 的历史评论")
            return []
        
        logger.info(f"成功获取用户 {user_id} 的历史评论，共 {len(comments)} 条笔记")
        return comments
    except Exception as e:
        logger.exception(f"获取用户 {user_id} 的历史评论时发生错误")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"获取历史评论时出错: {str(e)}"
        )

@app.post("/api/register", response_model=TokenResponse, tags=["用户"])
async def register(user_in: UserInRegister):
    if not ALLOW_REGISTER:
        raise HTTPException(status_code=403, detail="注册功能已关闭")
    user = await create_user(user_in, allow_register=ALLOW_REGISTER)
    # 注册后直接登录
    access_token = create_access_token(data={"sub": user["username"]})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/api/login", response_model=TokenResponse, tags=["用户"])
async def login(user_in: UserInLogin):
    user = await verify_user_password(user_in.username, user_in.password)
    if not user:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    # 校验OTP
    totp = pyotp.TOTP(user["otp_secret"])
    if not totp.verify(user_in.otp_code):
        raise HTTPException(status_code=401, detail="动态验证码错误")
    access_token = create_access_token(data={"sub": user["username"]})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/otp-qrcode", tags=["用户"])
async def get_otp_qrcode(username: str):
    # 获取用户信息
    user = await get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    # 生成OTP URL
    otp_secret = user.get("otp_secret")
    if not otp_secret:
        raise HTTPException(status_code=400, detail="用户OTP密钥未配置")
    
    otp_url = pyotp.totp.TOTP(otp_secret).provisioning_uri(name=username, issuer_name="XHS评论系统")
    
    # 生成二维码
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(otp_url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # 将图像保存到内存缓冲区
    buf = io.BytesIO()
    img.save(buf)
    buf.seek(0)
    
    # 返回图像
    return StreamingResponse(buf, media_type="image/png")

# --- 用户备注相关API端点 ---
@app.post("/api/user-notes", tags=["备注"], status_code=status.HTTP_201_CREATED)
async def add_user_note(note_data: dict, username: str = Depends(get_current_user)):
    """保存/更新用户备注"""
    # 验证数据
    user_id = note_data.get("userId")
    notification_hash = note_data.get("notificationHash")
    note_content = note_data.get("noteContent")
    
    if not user_id or not notification_hash:
        raise HTTPException(status_code=400, detail="用户ID和通知哈希是必需的")
    
    # 保存备注
    saved_note = await save_user_note(user_id, notification_hash, note_content)
    
    if saved_note:
        # 确保返回的数据是可序列化的
        serializable_note = {
            "userId": saved_note.get("userId"),
            "notificationHash": saved_note.get("notificationHash"),
            "noteContent": saved_note.get("noteContent"),
            "updatedAt": saved_note.get("updatedAt").isoformat() if saved_note.get("updatedAt") else None
        }
        return {"success": True, "data": serializable_note}
    else:
        raise HTTPException(status_code=500, detail="保存备注失败")

@app.get("/api/user-notes", tags=["备注"])
async def get_notes(user_id: str, username: str = Depends(get_current_user)):
    """获取单个用户的所有备注"""
    if not user_id:
        raise HTTPException(status_code=400, detail="用户ID是必需的")
    
    # 获取用户备注
    user_notes = await get_user_notes(user_id)
    
    # 将MongoDB文档转换为可JSON序列化的格式
    serializable_notes = []
    for note in user_notes:
        # 创建新字典，排除不可序列化的字段
        serializable_note = {
            "userId": note.get("userId"),
            "notificationHash": note.get("notificationHash"),
            "noteContent": note.get("noteContent"),
            "updatedAt": note.get("updatedAt").isoformat() if note.get("updatedAt") else None
        }
        serializable_notes.append(serializable_note)
    
    return {"success": True, "data": serializable_notes}

@app.get("/api/user-notes/batch", tags=["备注"])
async def get_notes_batch(user_ids: str, username: str = Depends(get_current_user)):
    """批量获取多个用户的所有备注
    
    Args:
        user_ids: 以逗号分隔的用户ID列表，例如：user1,user2,user3
    """
    if not user_ids:
        raise HTTPException(status_code=400, detail="至少需要提供一个用户ID")
    
    # 分割用户ID列表
    user_id_list = user_ids.split(',')
    
    if not user_id_list:
        raise HTTPException(status_code=400, detail="无效的用户ID列表格式")
    
    logger.info(f"批量获取 {len(user_id_list)} 个用户的备注数据")
    
    # 获取所有用户的备注数据
    all_notes = {}
    
    for user_id in user_id_list:
        # 获取单个用户的备注
        user_notes = await get_user_notes(user_id)
        
        # 处理并添加到结果集
        for note in user_notes:
            note_hash = note.get("notificationHash")
            if note_hash:
                # 直接使用哈希值作为键，便于前端使用
                all_notes[note_hash] = note.get("noteContent", "")
    
    logger.info(f"成功获取 {len(all_notes)} 条备注数据")
    return {"success": True, "data": all_notes}

# 如果直接运行此文件，启动 uvicorn 服务器 (主要用于开发)
if __name__ == "__main__":
    import uvicorn
    logger.info("启动 Uvicorn 服务器 (开发模式)...")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info") 