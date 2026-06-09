---
name: webnovel-init
description: 深度初始化网文项目。通过分阶段交互收集完整创作信息，生成可直接进入规划与写作的项目骨架与约束文件。
allowed-tools: Read Write Edit Grep Bash Agent AskUserQuestion WebSearch WebFetch
---

# Project Initialization (Deep Mode)

## 目标

- 通过结构化交互收集足够信息，避免"先生成再返工"。
- 产出：`.webnovel/state.json`、`设定集/*`、`大纲/总纲.md`、`.webnovel/idea_bank.json`。
- 保证后续 `/webnovel-plan` 与 `/webnovel-write` 可直接运行。

## 执行原则

1. 先收集，再生成；未过充分性闸门，不执行 `init_project.py`。
2. 分波次提问，每轮只问"当前缺失且会阻塞下一步"的信息。
3. 用户已明确的信息不重复问；冲突信息优先让用户裁决。
4. 参考书拆解结果，用户确认前不得写入任何 canon 文件。

## 引用加载策略

**不要预加载任何 reference 文件。按需加载。**

| 时机 | 加载文件 | 条件 |
|------|---------|------|
| Step 1 | `references/genre-tropes.md` | always |
| 用户选定题材后 | `genres/INDEX.md` → 找到对应题材模板 | 按题材 |
| Step 2 人物设计 | `references/worldbuilding/character-design.md` | 用户人物扁平 |
| Step 4 | `references/worldbuilding/faction-systems.md` | always |
| Step 4 | `references/worldbuilding/power-systems.md` | 涉及修仙/玄幻/高武/异能 |
| Step 4 | `references/worldbuilding/world-rules.md` | always |
| Step 5 | `references/creativity/creativity-constraints.md` | always |
| Step 5 | `references/creativity/selling-points.md` | always |
| Step 5 | `references/creativity/creative-combination.md` | 复合题材 |
| Step 5 | `references/creativity/inspiration-collection.md` | 卡顿 |
| Step 5 | `references/creativity/anti-trope-*.md` | 题材映射命中 |
| Step 6 | `references/worldbuilding/setting-consistency.md` | always |

CSV 检索：`python -X utf8 "${SCRIPTS_DIR}/reference_search.py" --skill init --table 命名规则 --query "{命名对象} {题材}" --genre {题材}`

## 环境设置

```bash
export WORKSPACE_ROOT="${CLAUDE_PROJECT_DIR:-$PWD}"
export SCRIPTS_DIR="${CLAUDE_PLUGIN_ROOT:?}/scripts"
```

初始化前不要用 `where` 解析书项目根（新项目尚不存在时可能命中旧指针）。

## 交互流程（Deep）

### Step 1：预检与上下文加载

- 确认当前目录可写，脚本入口存在。
- 加载 `references/genre-tropes.md`。
- 输出"已知信息清单"和"待收集清单"。

### Step 1.5：灵感来源询问（可选）

确认用户是否提供灵感来源（原创想法 / 参考作品拆书 / 市场趋势 / 题材模板）。

选择拆书时，必须调用 `Agent(subagent_type: "literary-writer:deconstruction-agent")`。处理规则：
- 只使用返回的 `reader_promise`、`opening_hook_patterns`、`cool_point_loops`、`protagonist_patterns` 等字段。
- `quality.passed=false` 或 `confidence < 0.85` 时，不折叠进创意约束包。
- 禁止把参考书角色、设定、剧情事实原样写入项目文件。

### Step 2：故事核与商业定位

必收：书名、题材（支持 A+B 复合）、目标规模、一句话故事、核心冲突、目标读者/平台。

### Step 3：角色骨架与关系冲突

必收：主角姓名、欲望、缺陷、结构（单/多主角）、感情线配置、反派分层。

### Step 4：金手指与兑现机制

必收：类型、名称、风格、可见度、不可逆代价、成长节奏。
条件必收：系统流→系统性格；重生→时间点；传承→辅助边界。

### Step 5：世界观与力量规则

必收：世界规模、力量体系类型、势力格局、社会阶层。
题材相关：货币体系、宗门层级、境界链。

### Step 6：创意约束包（差异化核心）

1. 汇总灵感来源。
2. 加载反套路库（最多 2 个）。
3. 生成 2-3 套创意包（卖点+反套路+硬约束+缺陷驱动+反派镜像+开篇钩子）。
4. 三问筛选 + 五维评分（详见 `creativity-constraints.md`）。
5. 用户选择最终方案。

### Step 7：一致性复述与最终确认

输出初始化摘要草案（故事核/主角核/金手指核/世界核/创意约束核），用户确认后执行生成。

## 充分性闸门

未满足前禁止执行 `init_project.py`：
1. 书名、题材已确定。
2. 目标规模可计算。
3. 主角姓名+欲望+缺陷完整。
4. 世界规模+力量体系类型完整。
5. 金手指类型已确定。
6. 创意约束已确定（反套路 1 条 + 硬约束 ≥ 2 条，或用户明确拒绝）。

## 执行生成

详细命令和数据模型见 `references/init-data-model.md`。

1. 运行 `init_project.py` 生成项目骨架。
2. 写入 `idea_bank.json`。
3. Patch 总纲（故事一句话、核心主线/暗线、创意约束、反派分层、爽点里程碑）。
4. 生成 Story System 初始化（`MASTER_SETTING.json`）。

## 验证与交付

```bash
test -f "${PROJECT_ROOT}/.webnovel/state.json"
test -f "${PROJECT_ROOT}/大纲/总纲.md"
test -f "${PROJECT_ROOT}/.webnovel/idea_bank.json"
test -f "${PROJECT_ROOT}/.story-system/MASTER_SETTING.json"
```

成功标准：state.json 关键字段非空、设定集核心文件存在、总纲已填、idea_bank 一致、MASTER_SETTING 存在。

## 失败处理

仅补缺失字段，不全量重问。仅重跑最小步骤：文件缺失→重跑 init；总纲缺字段→只 patch；idea_bank 不一致→只重写。
