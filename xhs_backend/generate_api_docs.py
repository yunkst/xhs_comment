#!/usr/bin/env python
import json
import os
import sys
from pathlib import Path

# 确保安装了redoc-cli包
try:
    import subprocess
    print("正在检查是否安装了redoc-cli...")
    subprocess.run(["npx", "redoc-cli", "--version"], check=True)
except Exception as e:
    print("请先安装redoc-cli: npm install -g redoc-cli")
    sys.exit(1)

# 首先运行openapi_export.py生成JSON规范
spec_file = "openapi_spec.json"

if not os.path.exists(spec_file):
    print(f"未找到OpenAPI规范文件 {spec_file}，正在生成...")
    try:
        subprocess.run([sys.executable, "openapi_export.py"], check=True)
    except Exception as e:
        print(f"生成OpenAPI规范失败: {e}")
        sys.exit(1)

# 使用redoc-cli生成HTML文档
output_html = "api_docs.html"
print(f"正在生成HTML文档 {output_html}...")

try:
    subprocess.run(["npx", "redoc-cli", "bundle", spec_file, "-o", output_html], check=True)
    print(f"API文档已成功生成: {output_html}")
except Exception as e:
    print(f"生成HTML文档失败: {e}")
    sys.exit(1)

print("你也可以使用其他工具生成文档:")
print("1. Swagger UI: https://swagger.io/tools/swagger-ui/")
print("2. RapiDoc: https://rapidocweb.com/")
print("3. Stoplight Elements: https://stoplight.io/open-source/elements") 