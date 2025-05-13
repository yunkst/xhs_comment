#!/bin/bash

# 设置颜色输出
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}====================================${NC}"
echo -e "${BLUE}  前端开发监控脚本                 ${NC}"
echo -e "${BLUE}====================================${NC}"

cd xhs_admin_ui

# 检查前端服务是否正在运行
if [ -f "../frontend.pid" ]; then
  FRONTEND_PID=$(cat ../frontend.pid)
  if ps -p $FRONTEND_PID > /dev/null; then
    echo -e "${GREEN}前端服务正在运行，PID: $FRONTEND_PID${NC}"
    kill $FRONTEND_PID
    echo -e "${YELLOW}已停止旧的前端服务${NC}"
  else
    echo -e "${YELLOW}前端服务PID文件存在，但进程不存在${NC}"
  fi
fi

# 启动前端服务（开发模式+强制热更新）
echo -e "${GREEN}启动前端开发服务...${NC}"
export VITE_DEV=true
export VITE_HMR_FORCE=true

npm run dev -- --force &
FRONTEND_PID=$!
echo $FRONTEND_PID > ../frontend.pid
echo -e "${GREEN}前端服务已启动，PID: $FRONTEND_PID${NC}"

echo -e "${YELLOW}热更新已强制启用，修改代码将自动更新浏览器${NC}"
echo -e "${RED}按 Ctrl+C 停止监控${NC}"

# 等待进程结束
wait $FRONTEND_PID 