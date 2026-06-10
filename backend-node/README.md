# Node.js 主后端

生产唯一 API 入口：`server.js`（默认 `127.0.0.1:8765`）。

## 路由

| 文件 | 前缀/范围 |
|------|-----------|
| `routes.js` | `/api` 核心（项目、章节、聊天、模型、工具） |
| `story-routes.js` | `/api/projects/:id/story/*` Story OS |
| `story-engine-routes.js` | 故事引擎（节拍、圣经、AWR） |
| `screenplay-routes.js` | 剧本结构 |
| `measurement-routes.js` | 审稿/校验指标 |
| `versions-routes.js` | 项目版本快照 |
| `creative-center/routes.js` | 创作驾驶舱 |
| `auth/auth-routes.js` | 认证与用户 |
| `guestbook/guestbook-routes.js` | 留言板 |

## Story OS 模块地图

```text
story-kb/          结构化事实（角色、伏笔…）管道写入
story-understanding/   作品分析（Current State）
story-planner/     Goal、Roadmap
story-tasks/       今日任务
story-actions/     诊断建议（为什么）
story-plans/       修改计划（怎么做）
story-verify/      写后校验
story-engine/      节拍、悬念、批评引擎
story-os/          三层门面（planner / diagnosis / measurement）— 新代码优先从此 import
```

`story-os/` 为对 `story-planner`、`story-tasks`、`story-actions` 等的 **re-export 门面**；逐步将路由与脚本改为 `import * as storyOs from './story-os/index.js'`。

## 其他

- `storage.js` — 门面 re-export（实现见 `storage/`：`core`、`projects`、`workspace`、`sessions` 等）
- `ai-runtime/` — LLM 编排与多提供商
- `memory/` — LanceDB 向量 RAG
- `skill-adapter/` — literary-writer 等技能调用

架构公约见 [docs/architecture.md](../docs/architecture.md)。
