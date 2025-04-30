from fastapi import FastAPI, HTTPException, Depends, Header, status, Body
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware # 导入 CORS 中间件
from typing import Optional, Dict, Any, List
import os
import logging
from dotenv import load_dotenv
from contextlib import asynccontextmanager

from models import IncomingPayload # 假设模型在 models.py
from database import connect_to_mongo, close_mongo_connection, save_notifications, save_comments_with_upsert, save_structured_comments, save_notes, NOTIFICATIONS_COLLECTION, COMMENTS_COLLECTION, NOTES_COLLECTION # 假设数据库函数在 database.py
from processing import transform_raw_comments_to_structured # 导入转换函数

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
async def receive_data(payload: IncomingPayload, token: str = Depends(verify_token)) -> Dict[str, Any]:
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

# 如果直接运行此文件，启动 uvicorn 服务器 (主要用于开发)
if __name__ == "__main__":
    import uvicorn
    logger.info("启动 Uvicorn 服务器 (开发模式)...")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info") 