---
name: webnovel-plan
description: 基于总纲生成卷纲、时间线和章纲，并把新增设定增量写回现有设定集。
---

# Outline Planning

## 目标

- 基于总纲细化卷纲、时间线与章纲，不重做全局故事。
- 先补齐设定基线，再产出可直接进入写作的章纲。
- 卷纲完成后，把新增设定增量写回现有设定集。

## 执行原则

1. 只做增量补齐，不重写整份总纲或设定集。
2. 先锁定卷级节奏，再批量拆章。
3. 时间线是硬约束，所有章纲都必须带时间字段。
4. 若发现总纲与设定冲突，先阻断，再等用户裁决。

## 常见误区

- ❌ 先拆章再想卷级目标
- ❌ 时间线字段缺失但仍继续拆章
- ❌ 一次性读完全部 reference 再开始规划
- ❌ 发现设定冲突后继续产出章纲而不阻断

## 优先级链

1. 用户明确要求（最高）
2. 总纲核心冲突与卷末高潮（不可偏离）
3. 时间线硬约束（单调递增、倒计时正确）
4. skill 默认流程
5. reference 建议（最低）

## 决策树入口

- 项目根不合法或总纲缺失 → **阻断**
- 总纲缺少卷名/章节范围/核心冲突/卷末高潮 → **阻断**
- Step 2 发现设定冲突 → **标记 BLOCKER**
- 批量拆章时时间回跳且未标注闪回 → **阻断**当前批次

## 引用加载策略

**不要预加载 reference 文件。按需加载。**

| 时机 | 加载文件 | 条件 |
|------|---------|------|
| Step 4 | `templates/output/大纲-卷节拍表.md` | always |
| Step 5 | `templates/output/大纲-卷时间线.md` | always |
| Step 6 | `references/genre-profiles.md`（只读对应题材 section） | always |
| Step 6 | `references/shared/strand-weave-pattern.md` | always |
| 章纲拆分 | `references/outlining/plot-signal-vs-spoiler.md` | always |
| Step 6 | `references/shared/cool-points-guide.md` | 需要爽点设计 |
| Step 6/7 | `references/outlining/conflict-design.md` | 需要冲突设计 |
| Step 7 | `references/reading-power-taxonomy.md` | 需要追读力分析 |
| Step 7 | `references/outlining/chapter-planning.md` | 需要章纲细化 |
| Step 6/7 | `references/outlining/genre-volume-pacing.md` | 特定题材节奏 |

CSV 检索：
```bash
# 卷级规划
python -X utf8 "${SCRIPTS_DIR}/reference_search.py" --skill plan --table 场景写法 --query "卷级结构 叙事功能"
# 新增角色命名
python -X utf8 "${SCRIPTS_DIR}/reference_search.py" --skill plan --table 命名规则 --query "角色命名" --genre {题材}
```

## 环境准备

```bash
export WORKSPACE_ROOT="${CLAUDE_PROJECT_DIR:-$PWD}"
export SKILL_ROOT="${CLAUDE_PLUGIN_ROOT}/skills/webnovel-plan"
export SCRIPTS_DIR="${CLAUDE_PLUGIN_ROOT}/scripts"
export PROJECT_ROOT="$(python "${SCRIPTS_DIR}/webnovel.py" --project-root "${WORKSPACE_ROOT}" where)"
```

若本次规划落到具体章节，先刷新 Story System runtime 合同：
```bash
GENRE="$(python -X utf8 -c "import json,sys; s=json.load(open('${PROJECT_ROOT}/.webnovel/state.json',encoding='utf-8')); print(s.get('project',{}).get('genre',''))")"
python -X utf8 "${SCRIPTS_DIR}/webnovel.py" --project-root "${WORKSPACE_ROOT}" \
  story-system "${CHAPTER_GOAL}" --genre "${GENRE}" --chapter {chapter_num} --persist --emit-runtime-contracts --format both
```

## 执行流程

### Step 1：加载项目数据并确认前置条件

必须加载：`state.json`、`大纲/总纲.md`、题材（从 state.json 读取）。

已有卷时，额外加载：最近 5 章摘要、主角当前状态、核心关系、活跃伏笔。

CSV 创作参考（按需）：
```bash
python -X utf8 "${SCRIPTS_DIR}/reference_search.py" --skill plan --table 爽点与节奏 --query "{卷级核心冲突}" --genre "${GENRE}"
python -X utf8 "${SCRIPTS_DIR}/reference_search.py" --skill plan --table 桥段套路 --query "{卷级核心冲突}" --genre "${GENRE}"
```

按需读取设定集：`世界观.md`、`力量体系.md`、`主角卡.md`、`反派设计.md`、`idea_bank.json`。

阻断条件：总纲缺少卷名、章节范围、核心冲突或卷末高潮。

### Step 2：补齐设定基线

增量补齐世界观、力量体系、主角卡、反派设计。只增量补齐，不清空、不重写。发现冲突时阻断。

### Step 3：选择目标卷并确认范围

确认：卷名、章节范围、核心冲突、特殊要求。

### Step 4：生成卷节拍表

加载模板 `templates/output/大纲-卷节拍表.md`。硬要求：必须填写中段反转；危机链至少 3 次递增；卷末新钩子必须能落到最后一章。
输出：`大纲/第{volume_id}卷-节拍表.md`

### Step 5：生成卷时间线表

加载模板 `templates/output/大纲-卷时间线.md`。硬要求：明确时间体系、本卷时间跨度；有倒计时事件时标记 D-N。
输出：`大纲/第{volume_id}卷-时间线.md`

### Step 6：生成卷纲骨架

加载 `genre-profiles.md`（只读对应题材 section）+ `strand-weave-pattern.md`。按需加载 `cool-points-guide.md`、`conflict-design.md`、`genre-volume-pacing.md`。

卷纲必须明确：卷摘要、关键人物与反派层级、Strand 分布、爽点密度、伏笔规划、约束触发规划。

跨卷一致性检查（非首卷时）：上卷未回收伏笔必须出现、角色关系变化必须延续、主角能力必须承接。

### Step 7：批量生成章纲

批次规则：默认 10 章/批，复杂题材 8 章，简单升级流 12 章，不超过 12 章。

结构化节点规范和每章必填字段见 `references/node-and-writeback-spec.md`。

每章必须包含：目标、阻力、代价、时间锚点、CBN/CPNs/CEN、必须覆盖节点、本章禁区、爽点、Strand、钩子等。
输出：`大纲/第{volume_id}卷-详细大纲.md`

### Step 8：把新增设定写回现有设定集

只增量补充。新角色→角色卡，新势力/地点/规则→世界观/力量体系，新反派→反派设计。
发现冲突时标记 BLOCKER 并停止。

### Step 9：验证、保存并更新状态

验证：节拍表/时间线/大纲存在且非空、每章时间字段齐全、时间线单调递增、BLOCKER=0、CEN→CBN 承接正确。

验证通过后，生成写回 JSON（格式见 `references/node-and-writeback-spec.md`），执行总纲写回：
```bash
python "${SCRIPTS_DIR}/webnovel.py" --project-root "$PROJECT_ROOT" master-outline-sync \
  --volume {volume_id} --writeback-file "大纲/第{volume_id}卷-总纲写回.json" --format text
```

更新状态：
```bash
python "${SCRIPTS_DIR}/webnovel.py" --project-root "$PROJECT_ROOT" update-state -- \
  --volume-planned {volume_id} --chapters-range "{start}-{end}"
```

## 硬失败条件

- 节拍表/时间线表/详细大纲不存在或为空
- 中段反转缺失且未给出理由
- 任一章节缺少时间字段
- 时间回跳且未标注闪回
- 与总纲核心冲突或卷末高潮明显冲突
- 存在 BLOCKER 未裁决

## 恢复规则

只重做失败批次，不覆盖整卷文件。仅在全部验证通过后更新状态。
