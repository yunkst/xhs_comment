from fastapi import FastAPI,applications
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
import os
import logging
from dotenv import load_dotenv
from contextlib import asynccontextmanager


# 导入数据库连接函数
from database import connect_to_mongo, close_mongo_connection

# 导入API路由
from api import api_router

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 加载 .env 文件
load_dotenv()

# 从环境变量获取配置
ALLOW_REGISTER = os.getenv("ALLOW_REGISTER", "true").lower() == "true"
SHOW_DOC = os.getenv("SHOW_DOC", "true").lower() == "true"
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

# --- FastAPI 应用实例 ---
app = FastAPI(
    title="小红书评论维护系统",
    description="小红书评论数据的管理和维护系统",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if SHOW_DOC else None,
    redoc_url="/redoc" if SHOW_DOC else None
)

def swagger_monkey_patch(*args, **kwargs):
    return get_swagger_ui_html(
        *args,
        **kwargs,
        swagger_js_url="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js",
        swagger_css_url="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css"
    )

applications.get_swagger_ui_html = swagger_monkey_patch
# --- 配置 CORS 中间件 ---
origins = ["*"]  # 允许所有来源，生产环境应更严格

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# --- 注册API路由 ---
app.include_router(api_router, prefix="/api")

@app.get("/", tags=["通用"])
async def read_root():
    """根路径，用于健康检查或基本信息"""
    return {"message": "小红书评论维护系统运行中", "version": "1.0.0"}

# 如果直接运行此文件，启动 uvicorn 服务器 (主要用于开发)
if __name__ == "__main__":
    import uvicorn
    logger.info("启动 Uvicorn 服务器 (开发模式)...")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info") 