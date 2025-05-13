#!/bin/bash

# 设置颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# 显示标题
echo -e "${BLUE}====================================${NC}"
echo -e "${BLUE}  小红书评论维护系统启动脚本       ${NC}"
echo -e "${BLUE}====================================${NC}"

# 检查MongoDB是否已经启动
echo -e "${GREEN}[1/4] 检查MongoDB服务...${NC}"
if pgrep mongod > /dev/null; then
    echo -e "${GREEN}MongoDB服务已经在运行${NC}"
else
    echo -e "${RED}MongoDB服务未运行，请先启动MongoDB服务${NC}"
    echo "可以使用命令: sudo service mongod start"
    exit 1
fi

# 进入后端目录启动服务
echo -e "${GREEN}[2/4] 启动后端服务...${NC}"
cd xhs_backend

# 检查Python环境
python --version
if [ $? -ne 0 ]; then
    echo -e "${RED}未检测到Python环境${NC}"
    exit 1
fi

# 检查虚拟环境（可选）
if [ -d "venv" ]; then
    echo "激活虚拟环境..."
    source venv/bin/activate
fi

# 安装依赖
echo "安装后端依赖..."
pip install -r requirements.txt

# 启动后端服务
echo "启动后端服务..."
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
echo "后端服务PID: $BACKEND_PID"

# 进入前端目录启动服务
echo -e "${GREEN}[3/4] 启动前端服务...${NC}"
cd ../xhs_admin_ui

# 检查Node.js环境
node --version
if [ $? -ne 0 ]; then
    echo -e "${RED}未检测到Node.js环境${NC}"
    kill $BACKEND_PID
    exit 1
fi

# 安装依赖
echo "安装前端依赖..."
npm install

# 启动前端服务（确保开发模式和热更新）
echo "启动前端服务..."
export VITE_DEV=true
npm run dev -- --force &
FRONTEND_PID=$!
echo "前端服务PID: $FRONTEND_PID"

# 保存PID到文件，方便后面关闭
echo $BACKEND_PID > ../backend.pid
echo $FRONTEND_PID > ../frontend.pid

echo -e "${GREEN}[4/4] 启动完成${NC}"
echo -e "${GREEN}后端服务地址: http://localhost:8000${NC}"
echo -e "${GREEN}前端服务地址: http://localhost:5173${NC}"
echo -e "${YELLOW}前端热更新已启用，代码修改后将自动刷新浏览器${NC}"
echo -e "${BLUE}使用 ./stop_system.sh 可以停止系统${NC}"

# 等待用户按键以关闭系统
echo -e "\n按 Ctrl+C 停止服务..."
wait 