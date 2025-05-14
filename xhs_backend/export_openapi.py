#!/usr/bin/env python
"""
增强版OpenAPI导出脚本 - 支持多种格式
"""
import json
import os
import sys
import argparse
from pathlib import Path
import shutil
import subprocess
from typing import Optional, Dict, Any, List, Tuple

# 添加当前目录到路径，确保可以导入main
sys.path.append(str(Path(__file__).parent))

def export_json(app, output_file="openapi_spec.json"):
    """导出JSON格式的OpenAPI规范"""
    openapi_spec = app.openapi()
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(openapi_spec, f, ensure_ascii=False, indent=2)
    print(f"✅ JSON规范已保存到 {output_file}")
    return output_file

def export_yaml(app, output_file="openapi_spec.yaml"):
    """导出YAML格式的OpenAPI规范"""
    try:
        import yaml
    except ImportError:
        print("❌ 未安装PyYAML。请运行: pip install pyyaml")
        return None
    
    openapi_spec = app.openapi()
    with open(output_file, "w", encoding="utf-8") as f:
        yaml.dump(openapi_spec, f, allow_unicode=True, sort_keys=False)
    print(f"✅ YAML规范已保存到 {output_file}")
    return output_file

def check_command_exists(command: str) -> bool:
    """检查命令是否存在"""
    try:
        # 在Windows上使用where，在类Unix系统上使用which
        cmd = "where" if os.name == "nt" else "which"
        subprocess.run([cmd, command], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return True
    except (subprocess.SubprocessError, FileNotFoundError):
        return False

def check_npx_available() -> bool:
    """检查npx是否可用"""
    return check_command_exists("npx")

def generate_html(spec_file, output_file="api_docs.html", tool="redoc"):
    """生成HTML文档"""
    import subprocess
    
    if tool == "redoc":
        if not check_npx_available():
            print("❌ 未找到npx命令。请安装Node.js: https://nodejs.org/")
            # 如果npx不可用，尝试生成独立的HTML
            return generate_standalone_html(spec_file, output_file, tool)
        
        try:
            subprocess.run(["npx", "redoc-cli", "bundle", spec_file, "-o", output_file], check=True)
            print(f"✅ Redoc HTML文档已保存到 {output_file}")
            return output_file
        except subprocess.SubprocessError as e:
            print(f"❌ 生成Redoc文档失败: {e}")
            print("请安装redoc-cli: npm install -g redoc-cli")
            # 如果redoc-cli失败，尝试生成独立的HTML
            return generate_standalone_html(spec_file, output_file, tool)
    
    elif tool == "swagger":
        return generate_standalone_html(spec_file, output_file, tool)
    
    else:
        print(f"❌ 不支持的工具: {tool}")
        return None

def generate_standalone_html(spec_file: str, output_file: str, tool: str) -> Optional[str]:
    """生成不依赖npx的独立HTML文档"""
    try:
        if tool == "redoc":
            template = """<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <title>API文档 - ReDoc</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
    <style>body{margin:0;padding:0}</style>
</head>
<body>
    <redoc spec-url="%s"></redoc>
    <script src="https://cdn.jsdelivr.net/npm/redoc@latest/bundles/redoc.standalone.js"></script>
</body>
</html>""" % os.path.basename(spec_file)
        elif tool == "swagger":
            template = """<!DOCTYPE html>
<html lang="zh">
<head>
    <meta charset="UTF-8">
    <title>API文档 - Swagger UI</title>
    <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
    <style>body{margin:0}.swagger-ui .topbar{display:none}</style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
        window.onload = function() {
            window.ui = SwaggerUIBundle({
                url: "%s",
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIBundle.SwaggerUIStandalonePreset
                ],
                layout: "BaseLayout",
                persistAuthorization: true
            });
        };
    </script>
</body>
</html>""" % os.path.basename(spec_file)
        else:
            print(f"❌ 不支持的工具类型: {tool}")
            return None
            
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(template)
        
        # 复制规范文件到HTML所在目录，确保JS能加载到
        spec_dir = os.path.dirname(output_file)
        if spec_dir and not os.path.exists(os.path.join(spec_dir, os.path.basename(spec_file))):
            shutil.copy(spec_file, spec_dir)
        
        print(f"✅ 已生成独立的{tool.capitalize()}文档: {output_file}")
        print(f"注意: 由于使用了CDN资源，请在Web服务器中打开此文件获得最佳体验")
        return output_file
    except Exception as e:
        print(f"❌ 生成独立HTML文档失败: {e}")
        return None

def main():
    parser = argparse.ArgumentParser(description="OpenAPI规范导出工具")
    parser.add_argument("--format", choices=["json", "yaml", "both"], default="json", 
                        help="输出格式: json, yaml, 或both")
    parser.add_argument("--html", choices=["none", "redoc", "swagger", "both"], default="redoc",
                        help="生成HTML文档类型")
    parser.add_argument("--output-dir", default=".", help="输出目录")
    parser.add_argument("--standalone", action="store_true", help="使用独立模式生成HTML (不依赖Node.js)")
    args = parser.parse_args()
    
    # 创建输出目录
    os.makedirs(args.output_dir, exist_ok=True)
    
    # 导入FastAPI应用
    try:
        from main import app
    except ImportError:
        print("❌ 无法导入FastAPI应用。请确保您在正确的目录中运行此脚本。")
        sys.exit(1)
    
    json_file = None
    yaml_file = None
    
    # 导出规范
    if args.format in ["json", "both"]:
        json_file = export_json(app, os.path.join(args.output_dir, "openapi_spec.json"))
    
    if args.format in ["yaml", "both"]:
        yaml_file = export_yaml(app, os.path.join(args.output_dir, "openapi_spec.yaml"))
    
    # 生成HTML文档
    spec_file = json_file or yaml_file
    if not spec_file:
        print("❌ 未生成规范文件，无法生成HTML文档")
        sys.exit(1)
    
    if args.standalone:
        print("🔧 使用独立模式生成HTML (不依赖Node.js)")
    
    if args.html in ["redoc", "both"]:
        if args.standalone:
            generate_standalone_html(spec_file, os.path.join(args.output_dir, "redoc_api_docs.html"), "redoc")
        else:
            generate_html(spec_file, os.path.join(args.output_dir, "redoc_api_docs.html"), "redoc")
    
    if args.html in ["swagger", "both"]:
        if args.standalone:
            generate_standalone_html(spec_file, os.path.join(args.output_dir, "swagger_api_docs.html"), "swagger")
        else:
            generate_html(spec_file, os.path.join(args.output_dir, "swagger_api_docs.html"), "swagger")
    
    print("\n✨ 完成! 您可以通过以下方式查看API文档:")
    print("1. FastAPI内置Swagger UI: http://127.0.0.1:8000/docs")
    print("2. FastAPI内置ReDoc: http://127.0.0.1:8000/redoc")
    
    if args.html != "none":
        print(f"3. 生成的HTML文档位于: {args.output_dir}/")

if __name__ == "__main__":
    main() 