# Literary Studio API 测试

针对文匠 Studio 平台全部 REST API 与 WebSocket 的 Python 集成测试套件。每个模块均包含**正例**（合法请求期望成功）与**反例**（非法/越权请求期望失败）。

## 前置条件

1. **启动后端服务**（默认 `http://127.0.0.1:8765`）：

```powershell
cd literary-studio
npm start
```

2. **安装测试依赖**：

```powershell
cd test
pip install -r requirements.txt
```

## 运行测试

```powershell
cd test
pytest
```

仅运行某个模块：

```powershell
pytest tests/test_health_auth.py
pytest tests/test_story_engine.py
pytest tests/test_api_coverage.py -k "story.knowledge"
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `STUDIO_BASE_URL` | `http://127.0.0.1:8765` | API 基地址 |
| `STUDIO_WS_URL` | 由 BASE_URL 推导 | WebSocket 地址 |
| `STUDIO_ADMIN_USER` | `admin` | 管理员用户名 |
| `STUDIO_ADMIN_PASSWORD` | `admin123` | 管理员密码 |
| `STUDIO_TEST_TIMEOUT` | `30` | HTTP 请求超时（秒） |

## 目录结构

```
test/
├── config.py              # 配置与测试常量
├── conftest.py            # pytest fixtures（登录、测试项目等）
├── endpoints/
│   └── catalog.py         # 全量 API 端点目录（~200 个）
├── helpers/
│   ├── client.py          # HTTP 客户端封装
│   └── ws_helper.py       # WebSocket 测试辅助
└── tests/
    ├── test_api_coverage.py       # 基于 catalog 的全量冒烟 + 鉴权反例
    ├── test_health_auth.py        # 健康检查 & 认证
    ├── test_projects_chapters.py  # 项目 & 章节
    ├── test_chat_tools_versions.py# 会话、模型、工具、MCP、版本
    ├── test_story_engine.py       # 故事 OS & 故事引擎
    ├── test_screenplay_guestbook.py # 剧本 & 留言板
    └── test_websocket.py          # WebSocket 流式接口
```

## 测试策略

| 类型 | 说明 |
|------|------|
| **正例** | 合法 Token + 有效参数，期望 200/201 或业务可接受状态 |
| **反例-未登录** | 无 Token 访问受保护接口，期望 401 |
| **反例-越权** | 普通用户访问管理员接口，期望 403 |
| **反例-不存在** | 伪造 project_id / 资源 ID，期望 404 |
| **反例-参数错误** | 缺少必填字段，期望 400 |

> 若后端未启动，所有测试将自动 `skip`。

## 端点覆盖

`endpoints/catalog.py` 登记了平台全部 HTTP 路由（Auth、Projects、Story OS、Story Engine、Screenplay、MCP、Tools、Guestbook 等）。`test_api_coverage.py` 对每个端点自动执行正例冒烟与鉴权反例。
