# Architecture Refactor v2.8 — SUCCESSFULLY COMPLETED

> **结案日期**：2026-06-02（CTO）  
> **当前阶段**：[Phase D · Stabilization](./v2.8-phase-d-stabilization.md) — 聚焦**新架构的消费者**，不再碰迁移。

---

## 闭环（已走完）

```text
Architecture
    ↓
Schema
    ↓
Inventory
    ↓
Dry Run
    ↓
Rollback
    ↓
Migration
    ↓
Validation
    ↓
Guard
    ↓
Cleanup A
```

---

## 核心成果

### Story Assets → Knowledge

```text
name-as-id  →  stable entity identity (char_{base32_8})
```

`migration/id-mapping.json` 落盘；REJECTED 噪声未入库。

**消费者**：Planner · Suggestions 链 · Understanding Reader 已接 **Entity Resolver（D3 ✅）**

### Measurement

```text
review + verify + metrics + trends  统一归口
health_snapshot  已消灭
```

事实模型回归：

```text
metrics + review + latest verify
```

（非 truth / cache / snapshot / view-model 四套并存。）

### Versions

```text
full_content_per_version
```

小说工作流核心：**任意版本可恢复**（非 path 引用）。

---

## 总路线图

| 阶段 | 名称 | 状态 |
|------|------|------|
| Sprint 1 | Architecture Restructure | ✅ |
| Sprint 2 | Identity + Measurement | ✅ |
| Phase C | Migration | ✅ |
| Phase D | Stabilization（P1 运营验证） | 🚧 [冒烟清单](./v2.8-phase-d-smoke-checklist.md) |

### Phase D 优先级

| 序 | 项 | 目标 | 状态 |
|----|-----|------|------|
| **D1** | Version API | `version-service` + routes + studio 重定向 | ✅ |
| **D2** | Studio UI 收口 | `StudioPage` → Version API | ✅ |
| **D3** | Entity Resolver | `entity-index.js` + `entity-resolver.js` | ✅ |
| **D4** | Cleanup B | 删除 deprecated 只读 fallback | ⏳ 最后 |

**当前**：P1 冒烟 10 条 + 真实使用一轮 → Phase D COMPLETED → **D4 Cleanup B**（P2，仅删 fallback writer）

```text
技术上：v2.8 架构重构已完成
目标上：验证重构成果，非继续重构
```

---

## 关键文档索引

| 文档 | 用途 |
|------|------|
| [architecture.md](./architecture.md) | 系统公约 |
| [v2.8-entity-identity.md](./v2.8-entity-identity.md) | Identity Law |
| [v2.8-measurement-layer.md](./v2.8-measurement-layer.md) | Measurement |
| [v2.8-migration-design.md](./v2.8-migration-design.md) | 迁移设计 |
| [architecture-refactor-sprint-2.md](./architecture-refactor-sprint-2.md) | Sprint 2 交付 |
| [v2.8-phase-d-stabilization.md](./v2.8-phase-d-stabilization.md) | Phase D 执行 |
