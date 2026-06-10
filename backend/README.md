# Python 文档处理（CLI）

生产环境由 `backend-node`（Node.js）提供全部 API。本目录仅保留 **文档导入/导出 CLI**，由 Node 在需要时 `spawn` 调用。

## 活跃入口

| 文件 | 调用方 | 用途 |
|------|--------|------|
| `convert_cli.py` | `backend-node/document-convert.js` | DOCX / PDF / HTML / ZIP → Markdown |
| `export_cli.py` | `backend-node/document-export.js` | Markdown → DOCX |

## 依赖安装

```bash
pip install -r requirements.txt
```

未安装 Python 时，核心创作功能仍可用；仅文档导入/导出受限。

## 历史代码

`_legacy/` 为早期 FastAPI 全栈后端的归档，**不再启动**。请勿在新功能中引用。
