from fastapi import FastAPI, applications, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
import os
import logging
from dotenv import load_dotenv
from contextlib import asynccontextmanager
from datetime import datetime


# 导入数据库连接函数
from database import connect_to_mongo, close_mongo_connection, get_database

# 导入API路由
from api import api_router

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 加载 .env 文件
load_dotenv()

# 静态文件目录 (相对于 main.py 的位置)
# 确保这个路径是正确的，指向您复制前端构建文件的地方
STATIC_FILES_DIR = os.path.join(os.path.dirname(__file__), "static_frontend")

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

# --- 健康检查接口（直接在API根路径下） ---
@app.get("/api/health")
async def health_check():
    """
    健康检查接口（无需认证）
    
    Returns:
        服务健康状态
    """
    try:
        # 检查数据库连接
        db = await get_database()
        # 简单的数据库连接测试
        await db.list_collection_names()
        
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "service": "小红书评论维护系统",
            "version": "1.0.0",
            "database": "connected"
        }
    except Exception as e:
        logger.error(f"健康检查失败: {str(e)}")
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "unhealthy",
                "timestamp": datetime.utcnow().isoformat(),
                "service": "小红书评论维护系统",
                "version": "1.0.0",
                "database": "disconnected",
                "error": str(e)
            }
        )

# --- 备份服务健康检查接口 ---
@app.get("/c_hello")
async def backup_health_check(asker: str = None):
    """
    备份服务健康检查接口（无需认证）
    用于外部服务检查系统状态
    
    Args:
        asker: 请求方标识
        
    Returns:
        简单的健康状态
    """
    try:
        # 检查数据库连接
        db = await get_database()
        await db.list_collection_names()
        
        response_data = {
            "status": "ok",
            "timestamp": datetime.utcnow().isoformat(),
            "service": "xhs_comment_system",
            "database": "connected"
        }
        
        # 如果是backuper请求，添加额外信息
        if asker == "backuper":
            response_data.update({
                "backup_ready": True,
                "last_backup": None,  # 可以后续实现获取最后备份时间
                "collections": ["comments", "notes", "users", "notifications"]
            })
        
        return response_data
        
    except Exception as e:
        logger.error(f"备份健康检查失败: {str(e)}")
        return {
            "status": "error",
            "timestamp": datetime.utcnow().isoformat(),
            "service": "xhs_comment_system",
            "database": "disconnected",
            "error": str(e)
        }

# --- 服务前端静态文件 (根端点 /web) ---

# 1. 静态资源 (如 JS, CSS, images from Vite's 'assets' folder)
# 这些将通过 /web/assets/... 访问
assets_path = os.path.join(STATIC_FILES_DIR, "assets")
if os.path.exists(assets_path):
    app.mount("/web/assets", StaticFiles(directory=assets_path), name="web-assets")

# 2. 服务 SPA (index.html) 和其他顶级静态文件 (favicon.ico, etc.)
# 所有不在 /web/assets 中的内容，以及作为 SPA 回退的 index.html
# 将通过 /web/... 访问。
# StaticFiles with html=True handles serving index.html for paths that don't match files,
# and serves other files like favicon.ico directly from STATIC_FILES_DIR.
# This mount must come AFTER specific mounts like /web/assets and API routes.
if os.path.exists(STATIC_FILES_DIR) and os.path.exists(os.path.join(STATIC_FILES_DIR, "index.html")):
    app.mount("/web", StaticFiles(directory=STATIC_FILES_DIR, html=True), name="web-spa")
    logger.info(f"前端SPA将从 '{STATIC_FILES_DIR}'目录下的 /web 端点提供服务。")
    # 3. 根路径重定向到 /web/
    # @app.get("/", include_in_schema=False)
    # async def root_redirect_to_web():
    #     return RedirectResponse(url="/web/")
    # logger.info("根路径 '/' 将重定向到 '/web/'。")
    # logger.info("根路径 '/' 将不再重定向到 '/web/'. 直接访问 '/' 可能导致404。")
else:
    logger.warning(f"静态文件目录 '{STATIC_FILES_DIR}' 或其中的 'index.html' 未找到。")
    logger.warning("前端页面将无法通过 /web 提供服务。请确保前端已正确构建并放置到指定目录。")
    # Optionally, provide a fallback for / or /web if static files are missing
    @app.get("/", include_in_schema=False)
    async def root_fallback():
        return {"message": "后端服务运行中。前端文件未找到。"}

    @app.get("/web", include_in_schema=False)
    async def web_fallback():
        return {"message": "前端文件未配置或未找到。请检查 static_frontend 目录。"}


# 如果直接运行此文件，启动 uvicorn 服务器 (主要用于开发)
if __name__ == "__main__":
    import uvicorn
    logger.info("启动 Uvicorn 服务器 (开发模式)...")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info") 