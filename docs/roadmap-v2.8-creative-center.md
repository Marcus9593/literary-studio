# V2.8 · 创作中心重构路线图

> **目标架构（必读）**：[v2.8-creative-cockpit-architecture.md](./v2.8-creative-cockpit-architecture.md)  
> **原则**：目标架构定稿 → 能力归位 → 数据边界 → 迁移 → UI  
> **禁止**：在 Target Architecture 锁定前编写 `migrate*` 或改 `StudioPage` Tab。

---

## 状态总览

| 阶段 | 名称 | 状态 |
|------|------|------|
| P0 | 架构冻结 | ✅ |
| P1 | 文档收敛（初版） | ✅ |
| **P2** | **重新定义 Creative Center（Target Architecture）** | ✅ 见 `v2.8-creative-cockpit-architecture.md` |
| **P3** | **数据边界白皮书** | ✅ `v2.8-data-boundaries.md` |
| **P3b** | **Measurement Layer 专篇** | ✅ `v2.8-measurement-layer.md`（待评审） |
| P3c | Knowledge 目录拆分设计（entities vs understanding） | ⏳ 炸点 1，迁移前定 schema |
| P4 | 数据迁移（一次性） | ⏳ 待 P3b/P3c 评审 |
| P5 | UI 重构 | ⏳ 待 P4 |
| **Sprint 1** | **架构收敛代码（无迁移）** | ✅ 见 `architecture-refactor-sprint-1.md` |
| **Sprint 2A** | **Entity Identity Law** | ✅ `v2.8-entity-identity.md` |
| **Sprint 2B** | **Measurement Schema + 数据流** | ✅ verify-log + trends schemas；measurement-layer §11 |
| **Sprint 2C** | Inventory → Dry Run → Migration → Guard | ✅ [architecture-refactor-v2.8.md](./architecture-refactor-v2.8.md) |
| **Phase D** | Stabilization（消费者） | 🚧 D1–D4 见 [v2.8-phase-d-stabilization.md](./v2.8-phase-d-stabilization.md) |
| Store Adapter | — | ❌ 不引入 |

~~原「P2 素材迁移 / P3 审稿迁移」~~ **已取消** — 避免未定型目标下的重迁。

---

## 四层模型（取代旧「三层」）

```text
Workspace         创造内容
Story OS          推进内容（含 Health、Review Engine）
Creative Cockpit  监控内容（全局 /studio，仅 Dashboard）
Story Assets      管理资产（项目 Knowledge）
```

**全局 Creative Center 最终仅：**

```text
Creative Cockpit + Versions
```

详见目标架构文档 §问题 1–3。

---

## P0 · 冻结 ✅

| 模块 | 状态 |
|------|------|
| Studio 素材中心 | DEPRECATED → Knowledge |
| Studio 审稿中心 | DEPRECATED → Health |
| `migrateStudioAssetsToKnowledge()` 等 | **禁止**，直至 P4 |

---

## P1 · 文档收敛 ✅

- [x] `architecture.md` §十二（将随 P2 目标架构同步修订）
- [x] `project-architecture.json` `studio_center`
- [x] 本 roadmap

---

## P2 · 重新定义 Creative Center ✅

- [x] [v2.8-creative-cockpit-architecture.md](./v2.8-creative-cockpit-architecture.md)
  - 问题 1：仅保留 Cockpit + Versions
  - 问题 2：Assets → Knowledge；Review → Health
  - 问题 3：项目内 / 全局导航树
  - 问题 4：Phase A–D 迁移路线

**下一步（仍属 P2 收尾，无代码迁移）：**

- [ ] 评审锁定目标架构
- [ ] 同步 `architecture.md` §十二 与 `project-architecture.json`
- [ ] API 契约草案：`/studio/cockpit`、`/studio/versions`、`health/*` schema

---

## P3 · 数据边界白皮书 ✅

- [x] [v2.8-data-boundaries.md](./v2.8-data-boundaries.md)
  - 架构公约 4（已同步 `architecture.md` §三）
  - 主矩阵：写入方 / 读取方 / 用户可编辑
  - Story KB ≠ Knowledge；Review → Health → Actions
  - Story OS 逻辑分层：Planner / Diagnosis / Measurement（V3）
  - Goal / Roadmap / Understanding 编辑政策
- [ ] 产品 + 工程评审签字
- [ ] （可选）`health/score.json` schema 附录

**验收：** 矩阵无灰色双写区；评审通过前仍禁止 `migrate*`。

---

## P4 · 数据迁移（一次性）⏳

**前置：** P3 锁定。

| 源 | 目标 |
|----|------|
| `studio.json` assets | `knowledge/*` |
| `studio.json` review_by_project | `health/*` |
| `studio.json` snapshots | `projects/{id}/versions/` |

单脚本、可回滚、带 `migrated_at` 标记；**不做**分阶段多次迁移。

---

## P5 · UI 重构 ⏳

**前置：** P4 完成或双读稳定。

- `/studio` 仅两 Tab：创作驾驶舱、项目版本
- 删除 Studio：素材、审稿、旧看板独立 Tab
- 项目 Knowledge：Story Assets 实体 Tab
- 项目 Health：重新体检 + 五维 + 趋势
- Cockpit：跨项目摘要，链到项目 Health / Tasks

---

## 相关文件

| 文件 | 用途 |
|------|------|
| `v2.8-creative-cockpit-architecture.md` | **Target Architecture（权威）** |
| `v2.8-data-boundaries.md` | **数据边界（权威）** |
| `v2.8-measurement-layer.md` | **测量层（最高风险，权威）** |
| `v2.8-entity-identity.md` | **实体身份法则（Phase C 前门）** |
| `architecture-refactor-sprint-2.md` | Sprint 2 验收 + CTO 签字 |
| `v2.8-legacy-inventory.md` | Phase C 前现实审计 |
| `v2.8-migration-design.md` | **Phase C 执行依据（2C-1）** |
| `architecture.md` §三、§十二 | 系统公约摘要 |
| `frontend/src/pages/StudioPage.jsx` | Phase D 再改 |
| `backend-node/studio-service.js` | Phase C/D |

---

**维护：** 阶段状态变更时更新本表；禁止恢复「P2 = 素材迁移」旧定义。
