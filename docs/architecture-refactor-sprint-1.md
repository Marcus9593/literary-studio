# Architecture Refactor · Sprint 1

> **目标**：目录 / API / 类型收敛，映射 Planner · Diagnosis · Measurement  
> **禁止**：迁移脚本 · UI 重构 · 新功能

---

## 验收标准

- [x] `backend-node/story-os/{planner,diagnosis,measurement}/` 三层 barrel
- [x] `backend-node/measurement/` paths + schemas + facades（无文件迁移）
- [x] 新 API：`GET/POST /api/projects/:id/measurement/review[(/run)]`、`GET …/measurement/health`
- [x] 旧 API：`/studio/assets*`、`/studio/review*` 返回 `Deprecation` + `Link` 头
- [x] 移除 Goal 输出字段 `current_state`；消费者用 `resolveGoalCurrentStateSummary`
- [x] `GET …/story/health` 改走 `measurement/health-facade`
- [x] Schema 草案：`docs/schemas/measurement-*.schema.json`、`knowledge-entities.schema.json`
- [x] P3.3 审计：`docs/v2.8-action-plan-task-audit.md`

## 未做（刻意）

- [ ] 任何 `migrate*` 脚本
- [ ] `measurement/` 目录落盘读写
- [ ] StudioPage / Cockpit UI
- [ ] `knowledge/entities/` 物理目录
- [ ] `versions/` 迁移

---

## 新模块地图

```text
backend-node/
├── story-os/
│   ├── planner/      → story-planner, story-tasks
│   ├── diagnosis/    → story-actions (+ to-plan 桥梁)
│   └── measurement/  → measurement/*, story-verify, quality
├── measurement/
│   ├── paths.js
│   ├── schemas.js
│   ├── review-facade.js   → studio-service (legacy storage)
│   └── health-facade.js   → verify + review 聚合
├── measurement-routes.js
└── story-schemas/
    ├── conventions.js
    └── goal.js              → resolveGoalCurrentStateSummary
```

---

## API 对照

| 旧（deprecated） | 新 |
|------------------|-----|
| `GET /api/studio/review?project_id=` | `GET /api/projects/:id/measurement/review` |
| `POST /api/studio/review/run` | `POST /api/projects/:id/measurement/review/run` |
| `GET /api/projects/:id/story/health` | 同路径，内部 → measurement health facade |
| `GET /api/studio/assets` | 未来 → `PUT /api/projects/:id/story/knowledge` |

---

## 下一步（Sprint 2 候选，仍无迁移）

- P3c：`knowledge/entities` 目录与 store 适配层（双读 flat + entities）
- measurement store：写 `latest.json` 到 `measurement/review/` 同时双写 studio（可选）
- 前端 `api.js` 逐步切 measurement 端点（Studio 页最后删）

---

**状态**：Sprint 1 完成 · 2026-06-02
