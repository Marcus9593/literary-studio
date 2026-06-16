# 后端非阻塞要求

接口测试**不跳过**任何端点。若压测导致服务无响应，应修复后端实现，而非改测试。

## 已修复的阻塞点

| 模块 | 问题 | 修复 |
|------|------|------|
| `skill-adapter/tools-service.js` | `execSync` 阻塞事件循环 | 异步 `execFile` + 更新/安装互斥 |
| `export/document-export.js` | `spawnSync` Word 导出 | `spawnPythonAsync` |
| `export/document-convert.js` | `spawnSync` 文档转换 | `spawnPythonAsync` |
| `export/python-runtime.js` | 依赖探测 `spawnSync` | 异步 probe + 缓存 |

修复后：单个慢请求（如 `catalogue/update`）不会拖死 `/api/health` 等其他接口。

## 测试目录说明

- `tests/_backup/` 为历史重复副本，默认 `--ignore` 避免同一端点跑两遍，**不是**跳过端点。
- `targets/dmg.json` 中 `timeout` 可按 DMG 环境调大（如目录更新较慢）。
