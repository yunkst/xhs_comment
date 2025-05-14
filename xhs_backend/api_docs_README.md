# OpenAPI 文档生成工具

这个目录包含了用于从FastAPI应用生成OpenAPI规范和API文档的工具脚本。

## 可用脚本

1. `openapi_export.py` - 简单的导出工具，将OpenAPI规范导出为JSON格式
2. `generate_api_docs.py` - 使用redoc-cli生成HTML文档
3. `export_openapi.py` - 增强版导出工具，支持多种格式和选项

## 使用方法

### 简单导出 (JSON格式)

运行以下命令导出JSON格式的OpenAPI规范:

```bash
python openapi_export.py
```

这将生成 `openapi_spec.json` 文件。

### 生成HTML文档

1. 首先安装redoc-cli (需要Node.js):

```bash
npm install -g redoc-cli
```

2. 然后运行:

```bash
python generate_api_docs.py
```

这将生成 `api_docs.html` 文件。

### 增强版导出工具

这个工具支持更多选项:

```bash
python export_openapi.py --format both --html both --output-dir api_docs
```

参数说明:
- `--format`: 指定输出格式，可选值: `json`、`yaml`、`both`
- `--html`: 指定生成的HTML文档类型，可选值: `none`、`redoc`、`swagger`、`both`
- `--output-dir`: 指定输出目录

例如，上面的命令将:
1. 创建 `api_docs` 目录
2. 导出JSON和YAML格式的OpenAPI规范
3. 生成Redoc和Swagger UI两种HTML文档

## 查看API文档的方式

1. **使用FastAPI内置文档**:
   - Swagger UI: `http://127.0.0.1:8000/docs`
   - ReDoc: `http://127.0.0.1:8000/redoc`

2. **使用生成的HTML文档**:
   - 直接在浏览器中打开生成的HTML文件
   - 注意: Swagger UI生成的HTML文件需要通过Web服务器访问

## 依赖

- Python 3.6+
- FastAPI
- PyYAML (如需YAML格式)
- Node.js 和 redoc-cli (如需生成Redoc文档)

## 提示

如果您需要修改API文档的外观或添加更多信息，可以:

1. 调整FastAPI应用中的文档相关设置
2. 修改导出脚本中的模板
3. 使用其他OpenAPI工具，如Stoplight Studio等 