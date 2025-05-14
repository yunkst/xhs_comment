#!/usr/bin/env python
import json
import os
import sys
from pathlib import Path

# 添加当前目录到路径，确保可以导入main
sys.path.append(str(Path(__file__).parent))

# 导入FastAPI应用
from main import app

# 获取JSON格式的OpenAPI规范
openapi_spec = app.openapi()

# 保存到文件
output_file = "openapi_spec.json"
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(openapi_spec, f, ensure_ascii=False, indent=2)

print(f"OpenAPI 规范已保存到 {output_file}")
print(f"您可以在浏览器中访问 http://127.0.0.1:8000/docs 查看交互式API文档")
print(f"或者访问 http://127.0.0.1:8000/redoc 查看另一种风格的文档") 