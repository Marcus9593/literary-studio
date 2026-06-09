# Literary-Writer Token 优化方案

> 目标：将单次写作流程的上下文 token 消耗从 ~50,000-80,000 降至 ~10,000-15,000，同时不损失创作质量。
>
> 核心原则：**按需加载，精准召回，不灌全量。**

---

## 一、问题诊断

### 1.1 Token 消耗全景

| 模块 | 行数 | 当前加载策略 | 实际必要性 |
|------|------|-------------|-----------|
| 主 SKILL.md | 322 | 每次触发全量注入 | 只需 ~80 行路由 |
| 子 Skill SKILL.md × 8 | 1,732 | 触发时全量注入 | 部分内容可拆到 reference |
| Agent 定义 × 5 | 1,030 | 调用时全量注入 | 可精简 30-40% |
| 共享 References (md) | 5,832 | "always" 标记全量 Read | 大部分可改为条件触发 |
| 题材库 genres/ | 13,331 | 按需但无索引，易误读 | 只需读 1 个题材 ~500 行 |
| 题材模板 templates/genres/ | 7,718 | init 时按题材读取 | 同上 |
| 输出模板 templates/output/ | 760 | plan 时按需 | 合理 |
| CSV 数据 | 604KB | BM25 检索（已有 RAG） | 合理 |

### 1.2 三个核心浪费点

**浪费点 A：入口膨胀**
主 SKILL.md 322 行每次触发全量注入系统提示词，包含所有体裁的创作技巧、输出格式、流程说明。用户写网文时，剧本/舞台/漫画的说明白白占 ~4,000 token。

**浪费点 B：Reference 的 "always" 陷阱**
reference-loading-map.md 中标记 "always" 的文件（genre-profiles.md 696行、system-data-flow.md 341行、creativity-constraints.md 327行、selling-points.md 687行等），每次相关子 skill 触发都全量注入，加起来 ~2,162 行 ≈ 10,000+ token。

**浪费点 C：题材库无路由**
genres/ 13,331 行 + templates/genres/ 7,718 行，没有索引文件告诉 Claude 哪个题材对应哪个文件。虽然 SKILL.md 说"按需读取"，但实际执行时容易多读或误读。

---

## 二、优化方案

### Phase 1：主 SKILL.md 路由化（最高优先级）

**目标**：主 SKILL.md 从 322 行全量百科 → ~100 行路由表。

**改造方式**：将主 SKILL.md 拆分为 1 个路由文件 + 6 个按需 reference 文件。

#### 1.1 新的主 SKILL.md 结构（~100 行）

```markdown
---
name: literary-writer
description: "全栈文学创作系统：小说、剧本、网文、图书等一切文学体裁的创作与项目管理。..."
---

# 全栈文学创作系统

你是一位经验丰富的全栈文学创作者。根据用户需求，按以下路由加载对应参考。

## 体裁路由表

| 用户意图 | 加载文件 | 不要加载 |
|---------|---------|---------|
| 写网文/网络小说 | `references/webfiction.md` | screenplay, stageplay, comic, novel, nonfiction |
| 写长篇/短篇小说 | `references/novel.md` | screenplay, stageplay, comic, webfiction, nonfiction |
| 写剧本/影视 | `references/screenplay.md` + 按需加载其子文件 | novel, webfiction, stageplay, comic |
| 写舞台剧本 | `references/stageplay.md` | 其他全部 |
| 写漫画/动画脚本 | `references/comic-script.md` | 其他全部 |
| 写图书/非虚构 | `references/nonfiction.md` | 其他全部 |
| 只是问问题/讨论 | 不加载任何 reference | 全部 |
| 未明确体裁 | 先询问，再路由 | 不预加载 |

**规则**：确定体裁后，只 Read 对应的 1 个文件。复合体裁（如"科幻剧本"）取主文件 + 按需子文件。

## 通用写作技巧（按需加载）

当用户需要写作技巧指导时，Read `references/writing-core.md`（人物塑造/情节设计/场景描写/对白技巧）。
不要在每次触发时自动加载。

## 子 Skill 路由表

| 用户意图 | 触发子 Skill | 说明 |
|----------|-------------|------|
| 初始化新网文项目 | `webnovel-init` | 深度采集创作信息，生成项目骨架 |
| 规划大纲/拆卷拆章 | `webnovel-plan` | 基于总纲生成卷纲、时间线和章纲 |
| 写新章节 | `webnovel-write` | 完整写章流程 |
| 审查已有章节 | `webnovel-review` | 生成结构化审查报告 |
| 查询设定/角色/伏笔 | `webnovel-query` | 按类型检索项目数据 |
| 记录成功模式 | `webnovel-learn` | 从当前会话提取可复用模式 |
| 查看项目看板 | `webnovel-dashboard` | 启动只读 Web 面板 |

## Agent 调用

| Agent | 调用方式 | 用途 |
|-------|---------|------|
| `context-agent` | `Agent(subagent_type: "literary-writer:context-agent")` | 写前组装写作任务书 |
| `reviewer` | `Agent(subagent_type: "literary-writer:reviewer")` | 章节质量审查 |
| `data-agent` | `Agent(subagent_type: "literary-writer:data-agent")` | 事实提取与 commit artifacts |
| `deconstruction-agent` | `Agent(subagent_type: "literary-writer:deconstruction-agent")` | 参考书拆解 |

**硬规则**：必须通过 `Agent` 工具调用指定 subagent；不得用主流程口头代替 subagent 输出。

## 优先级链

1. 用户明确要求（最高）
2. 状态机硬门槛（blocking issue 等）
3. 项目约束（总纲/设定/记忆）
4. Skill 流程
5. Reference 建议（最低）

## 环境变量

所有子 skill 共享以下环境变量模式：

\`\`\`bash
export WORKSPACE_ROOT="${CLAUDE_PROJECT_DIR:-$PWD}"
export SCRIPTS_DIR="${CLAUDE_PLUGIN_ROOT:?}/scripts"
export SKILL_ROOT="${CLAUDE_PLUGIN_ROOT:?}/skills/{sub-skill-name}"
export PROJECT_ROOT="$(python -X utf8 "${SCRIPTS_DIR}/webnovel.py" --project-root "${WORKSPACE_ROOT}" where)"
\`\`\`

## 注意事项

- 尊重原创性，不直接抄袭现有作品
- 涉及敏感题材时保持文学性和责任感
- 网文创作注意平台规范
- 长篇创作建议用户先确认大纲再写正文
- 网文子 skill 依赖 Python 脚本和项目状态文件，确保环境正确
```

#### 1.2 从主 SKILL.md 拆出的 reference 文件

| 新文件 | 内容来源 | 行数估算 |
|--------|---------|---------|
| `references/writing-core.md` | 原 SKILL.md 的"写作技巧库"（人物/情节/场景/对白） | ~120 行 |
| `references/webfiction.md` | 已有，需补充原 SKILL.md 中网文相关内容 | 已有 434 行 |
| `references/novel.md` | 已有，需补充原 SKILL.md 中小说相关内容 | 已有 89 行 |
| `references/screenplay.md` | 已有，不动 | 已有 561 行 |
| `references/output-formats.md` | 原 SKILL.md 的"输出格式"和"剧本开发文档输出" | ~80 行 |

**效果**：主 SKILL.md 从 322 行 → ~100 行，每次触发节省 ~2,800 token。

---

### Phase 2：Reference 加载策略改造（高优先级）

**目标**：将 "always" 标记改为条件门控，按需加载。

#### 2.1 改造 reference-loading-map.md 中的 "always" 项

| 文件 | 行数 | 当前标记 | 改为 | 条件 |
|------|------|---------|------|------|
| `genre-profiles.md` | 696 | init/plan always | **条件** | 只在用户选定题材后加载对应 section（不全量读） |
| `system-data-flow.md` | 341 | init always | **条件** | 只在调试数据链或校对产物时加载 |
| `creativity-constraints.md` | 327 | init Step 5 always | **条件** | 只在生成创意约束包时加载 |
| `selling-points.md` | 687 | init Step 5 always | **条件** | 同上 |
| `core-constraints.md` | 111 | write/review always | **内化** | 写入 context-agent 任务书模板，不再单独 Read |
| `strand-weave-pattern.md` | 111 | plan always | **条件** | 只在涉及多线交织时加载 |
| `plot-signal-vs-spoiler.md` | 53 | plan 章纲拆分 always | **条件** | 只在拆章时加载 |
| `review-schema.md` | 59 | review always | **内化** | 写入 reviewer agent 定义，不再单独 Read |

#### 2.2 为 genre-profiles.md 建立 section 索引

当前 `genre-profiles.md`（696 行）是一个大文件，包含所有题材的画像。改为：

```markdown
# 题材画像索引

> 不要全量读取本文件。根据用户选定的题材，Read 对应的 section。

## 题材 → 行号映射

| 题材 | 起始行 | 结束行 | 核心内容 |
|------|--------|--------|---------|
| 修仙 | 10 | 45 | 升级节奏、渡劫设计、宗门体系 |
| 玄幻 | 46 | 80 | 力量体系、势力格局 |
| 都市 | 81 | 115 | 现实感、职场线 |
| 古言 | 116 | 150 | 宫廷规则、礼仪 |
| ... | ... | ... | ... |

## 使用方式

1. 确定用户题材
2. Read 对应行号范围：`Read("references/genre-profiles.md", offset={起始行}, limit={行数})`
3. 不要 Read 整个文件
```

或者更彻底的方案：**将 genre-profiles.md 拆分为每个题材一个独立文件**（如 `references/genres/xuanhuan.md`、`references/genres/ancient.md`），消除大文件问题。

#### 2.3 为 md 参考文件增加 BM25 检索能力

扩展现有 `reference_search.py`，增加对 md 文件的分段检索：

```python
# reference_md_search.py
# 1. 按 heading 把所有 reference md 文件切分为 chunk
# 2. 建立 BM25 索引（复用 reference_search.py 的 BM25 实现）
# 3. 按 query 检索最相关的 3-5 个 chunk
# 4. 返回 JSON，Claude 只加载相关片段

# 用法：
# python reference_md_search.py --query "玄幻 题材画像" --top-k 3
# python reference_md_search.py --query "剧本 场景建构" --top-k 3 --category screenplay
```

**效果**：从可能全量读取 2,162 行 "always" 文件 → 按需读取 ~200-400 行，每次节省 ~8,000 token。

---

### Phase 3：增量章节上下文（高优先级）

**目标**：写第 N 章时，不全量读取前序章节，只读取与本章有依赖关系的内容。

#### 3.1 现状分析

`extract_chapter_context.py` 已有的智能加载：
- 只加载前 2 章摘要（第 326 行：`range(max(1, chapter_num - 2), chapter_num)`）
- 有 RAG assist（BM25 + 向量检索）
- 有 contract context 加载

`context-agent.md` 已有的分层模型：
- 3 层上下文（Global/Recent/Current）用于 100+ 章项目
- `load-context` 命令打包了 contracts、recent summaries、urgent loops 等

**但仍存在的问题**：
1. context-agent 可能在 Step B "按需深查" 中加载额外的设定集、大纲文件
2. 没有"只读与本章有依赖关系的前序章节"的机制
3. 伏笔系统知道"第 8 章埋的伏笔要在第 15 章回收"，但没有反向查询"第 15 章需要哪些前序章节"

#### 3.2 改造方案：章节依赖索引

**A. 新增函数：`get_relevant_chapters()`**

在 `extract_chapter_context.py` 中增加：

```python
def get_relevant_chapters(project_root: Path, chapter_num: int) -> List[Dict[str, Any]]:
    """
    返回本章实际需要引用的前序章节列表。

    查询来源：
    1. foreshadowing：本章要回收的伏笔来自哪些章
    2. character_dependency：本章出场角色上次出现在哪章
    3. scene_dependency：本章场景与哪些前序场景关联
    4. plot_node_dependency：本章 CBN/CPNs 依赖哪些前序节点

    返回格式：
    [
        {"chapter": 8, "reason": "伏笔回收: 灵根置换术残页", "section": "相关段落摘要"},
        {"chapter": 14, "reason": "角色承接: 韩立与陈巧倩的交易", "section": "相关段落摘要"},
    ]
    """
```

**B. 数据来源**

| 依赖类型 | 查询来源 | 说明 |
|---------|---------|------|
| 伏笔回收 | `index.db` 的 open_loops | 查找本章 chapter_num 在 `target_chapter` 或 `deadline` 中的伏笔 |
| 角色依赖 | `index.db` 的 entity appearances | 查找本章出场角色的上一次出场章节 |
| 场景依赖 | `chapter_meta` 的 scene references | 查找本章场景与前序场景的关联 |
| 情节节点 | `.story-system/chapters/chapter_NNN.json` 的 dependencies | 查找本章 CBN 依赖的前序 CBN |

**C. context-agent 改造**

在 context-agent 的 Step A 中，增加依赖查询：

```
### A：基础包（改造后）

1. `load-context --chapter {NNNN}` 获取基础包
2. `Read` 章纲原文
3. 调用 `get_relevant_chapters()` 获取本章依赖的前序章节列表
4. 对每个依赖章节：
   - 优先读 `.webnovel/summaries/ch{NNNN}.md`（~20 行摘要）
   - 如果摘要不够（需要具体对话/场景细节），再 Read 正文的相关段落
   - 不读无关章节
5. 确定卷号
6. 读取本章涉及角色的行为约束（如有）
```

**D. 章节摘要缓存**

确保每章 commit 时自动生成结构化摘要，存入 `.webnovel/summaries/ch{NNNN}.md`：

```markdown
# 第{N}章摘要

## 基本信息
- 章节号：{N}
- 标题：{title}
- 字数：{word_count}
- 时间：{in_story_time}

## 剧情摘要
{2-3 句话概括本章核心事件}

## 角色出场
- {角色A}：{状态变化}
- {角色B}：{状态变化}

## 伏笔开关
- 开启：{新埋的伏笔}
- 回收：{本章回收的伏笔}

## 场景
- 场景1：{地点} - {核心事件}
- 场景2：{地点} - {核心事件}

## 关键对话/细节
- {对后续章节有影响的关键信息}
```

**效果**：写第 15 章时，从可能读取 14 章全文（~42,000 字 ≈ 56,000 token）→ 读取 1-2 章摘要（~40 行）+ 0-1 章相关段落（~100 行），**节省 95%**。

---

### Phase 4：子 SKILL.md 瘦身（中优先级）

**目标**：子 Skill SKILL.md 中的详细说明拆到 reference 文件，SKILL.md 只保留流程骨架。

#### 4.1 webnovel-init SKILL.md（452 行 → ~200 行）

| 拆出内容 | 目标文件 | 行数 |
|---------|---------|------|
| Step 2-7 的详细收集项说明 | `skills/webnovel-init/references/deep-collection-guide.md` | ~150 行 |
| 内部数据模型 JSON | `skills/webnovel-init/references/data-model.md` | ~80 行 |
| 参考书拆解流程细节 | 已有 deconstruction-agent 定义 | 不重复 |

#### 4.2 webnovel-plan SKILL.md（405 行 → ~200 行）

| 拆出内容 | 目标文件 | 行数 |
|---------|---------|------|
| 详细 Step 说明（Step 4-9） | `skills/webnovel-plan/references/plan-steps-detail.md` | ~150 行 |
| 结构化节点规范 | `skills/webnovel-plan/references/node-spec.md` | ~50 行 |

#### 4.3 webnovel-write SKILL.md（241 行 → ~150 行）

| 拆出内容 | 目标文件 | 行数 |
|---------|---------|------|
| --rewrite 模式详细流程 | `skills/webnovel-write/references/rewrite-guide.md`（已有） | 移入 |
| Step 5 data-agent 调用细节 | 已有 data-agent 定义 | 不重复 |
| 充分性闸门 + 失败恢复 | `skills/webnovel-write/references/gates-and-recovery.md` | ~40 行 |

**效果**：子 Skill SKILL.md 总计从 1,732 行 → ~900 行，每次子 skill 触发节省 ~3,000 token。

---

### Phase 5：Agent 定义精简（低优先级）

**目标**：Agent 定义从 1,030 行 → ~700 行。

#### 5.1 context-agent（251 行 → ~150 行）

- 拆出：示例（第 203-240 行的凡人修仙传示例）→ `agents/examples/context-agent-example.md`
- 拆出：错误处理表（第 242-251 行）→ 合并到主流程说明
- 保留：身份、工具、执行流程、输出格式

#### 5.2 reviewer（179 行 → ~120 行）

- 拆出：AI 味检查的 5 个子维度详细说明（第 76-110 行）→ `references/ai-flavor-checklist.md`
- 保留：身份、检查维度列表、输出格式

#### 5.3 data-agent（139 行）、deconstruction-agent（295 行）

- data-agent 已较精简，微调即可
- deconstruction-agent 的分析框架说明可拆出部分

**效果**：Agent 定义总计从 1,030 行 → ~700 行，每次 agent 调用节省 ~1,500 token。

---

### Phase 6：题材库路由索引（中优先级）

**目标**：消除 13,331 + 7,718 行题材文件的盲读问题。

#### 6.1 创建题材路由索引

新建 `genres/INDEX.md`（~50 行）：

```markdown
# 题材库索引

> 根据用户选定的题材，Read 对应目录下的文件。不要全量扫描。

## 路由表

| 题材 | 目录 | 核心文件 | 适用场景 |
|------|------|---------|---------|
| 修仙/玄幻 | `genres/xuanhuan/` | `cultivation-levels.md` | 升级体系设计 |
| | | `power-systems.md` | 力量体系设计 |
| | | `xuanhuan-cool-points.md` | 爽点设计 |
| | | `xuanhuan-plot-patterns.md` | 情节模式 |
| 狗血言情 | `genres/dog-blood-romance/` | `character-archetypes.md` | 人设模板 |
| | | `emotional-tension.md` | 情感张力 |
| | | `torture-points.md` | 虐点设计 |
| 规则怪谈 | `genres/rules-mystery/` | `core-elements.md` | 规则设计 |
| | | `clue-design.md` | 线索设计 |
| | | `detective-design.md` | 推理人设 |
| 古装/宫斗 | `genres/period-drama/` | `ancient-dialogue.md` | 古风对白 |
| | | `palace-intrigue.md` | 宫斗设计 |
| 现实题材 | `genres/realistic/` | `character-depth.md` | 人物深度 |
| | | `reality-anchoring.md` | 现实锚定 |
| 知乎短篇 | `genres/zhihu-short/` | `hook-techniques.md` | 开头钩子 |
| | | `plot-compression.md` | 情节压缩 |

## 题材模板

`templates/genres/` 下有 37 个题材模板，用于 init 阶段。

| 题材分类 | 模板文件 |
|---------|---------|
| 玄幻修仙类 | 修仙.md, 系统流.md, 高武.md, 西幻.md, 无限流.md, 末世.md, 科幻.md |
| 都市现代类 | 都市异能.md, 都市日常.md, 都市脑洞.md, 现实题材.md, 黑暗题材.md, 电竞.md, 直播文.md |
| 言情类 | 古言.md, 宫斗宅斗.md, 青春甜宠.md, 豪门总裁.md, 职场婚恋.md, 民国言情.md, 幻想言情.md, 现言脑洞.md, 女频悬疑.md, 狗血言情.md, 替身文.md, 多子多福.md, 种田.md, 年代.md |
| 特殊题材 | 规则怪谈.md, 悬疑脑洞.md, 悬疑灵异.md, 历史古代.md, 历史脑洞.md, 游戏体育.md, 抗战谍战.md, 知乎短篇.md, 克苏鲁.md |

## 使用方式

1. 确定用户题材
2. 从路由表找到对应目录和文件
3. 只 Read 需要的 1-2 个文件
4. 不要 Read 整个 genres/ 目录
```

#### 6.2 在 webnovel-init 中引用索引

在 webnovel-init SKILL.md 的 Step 1 中：

```markdown
### Step 1：预检与上下文加载

加载最小参考：
1. `references/system-data-flow.md`（仅在需要校对数据链时）
2. `references/genre-tropes.md`（题材套路速查）
3. **不要预加载** `genres/` 或 `templates/genres/`
4. 用户选定题材后，Read `genres/INDEX.md` 找到对应文件，再精准加载
```

**效果**：从可能误读 13,331 行 → 精准读取 ~500 行，节省 ~25,000 token。

---

## 三、实施路径

| 阶段 | 改动 | 预计 token 节省 | 难度 | 风险 |
|------|------|----------------|------|------|
| **Phase 1** | 主 SKILL.md 路由化 | 每次触发 -3,000~5,000 | 低 | 低 |
| **Phase 2** | Reference "always" → 条件门控 | init/plan -10,000~15,000 | 中 | 低 |
| **Phase 3** | 增量章节上下文 | write -40,000~50,000 | 中 | 中 |
| **Phase 4** | 子 SKILL.md 瘦身 | 每次子 skill 触发 -3,000 | 低 | 低 |
| **Phase 5** | Agent 定义精简 | 每次 agent 调用 -1,500 | 低 | 低 |
| **Phase 6** | 题材库路由索引 | init -25,000 | 低 | 低 |

**推荐实施顺序**：Phase 1 → Phase 6 → Phase 4 → Phase 2 → Phase 3 → Phase 5

理由：
- Phase 1 + Phase 6 改动最小、见效最快、风险最低
- Phase 4 是 Phase 1 的自然延伸
- Phase 2 需要仔细测试每个 "always" 项的移除影响
- Phase 3 涉及 Python 脚本改动，需要更多测试
- Phase 5 优先级最低，因为 agent 调用次数有限

---

## 四、改造前后对比

### 场景：用户说"帮我写一个玄幻网文的第 3 章"

#### 改造前加载链

```
主 SKILL.md (322 行)                    → ~4,000 token
webnovel-write SKILL.md (241 行)        → ~3,000 token
context-agent 定义 (251 行)             → ~3,000 token
core-constraints.md (111 行)            → ~1,400 token  ← 内化后不加载
genre-profiles.md (696 行)              → ~8,700 token  ← 全量！
anti-ai-guide.md (74 行)                → ~900 token
polish-guide.md (351 行)                → ~4,400 token
style-adapter.md (71 行)                → ~900 token
typesetting.md (60 行)                  → ~750 token
+ 前 2 章正文（如果无摘要）              → ~8,000 token
+ agent 读取的项目状态文件               → ~2,000 token
+ CSV 检索结果                           → ~1,000 token
──────────────────────────────────────────
总计：~38,000+ token（仅系统提示词部分）
```

#### 改造后加载链

```
精简主 SKILL.md (~100 行)               → ~1,250 token
webnovel-write SKILL.md (精简 ~150 行)  → ~1,900 token
context-agent 精简定义 (~150 行)        → ~1,900 token
题材索引 → 命中玄幻 → 单文件加载         → ~1,200 token（替代 8,700）
anti-ai-guide.md (74 行)                → ~900 token（按需）
+ 前 2 章摘要（~40 行）                  → ~500 token（替代 8,000）
+ 依赖章节摘要（0-1 章，~20 行）         → ~250 token
+ CSV 检索结果                           → ~1,000 token
──────────────────────────────────────────
总计：~9,000 token
```

**节省：~29,000 token（~76%）**

### 场景：用户说"帮我初始化一个古言宫斗网文项目"

#### 改造前加载链

```
主 SKILL.md (322 行)                    → ~4,000 token
webnovel-init SKILL.md (452 行)         → ~5,600 token
system-data-flow.md (341 行)            → ~4,300 token  ← 条件化后不加载
genre-tropes.md (183 行)                → ~2,300 token
genre-profiles.md (696 行)              → ~8,700 token  ← 全量！
character-design.md (111 行)            → ~1,400 token
faction-systems.md (179 行)             → ~2,200 token
world-rules.md (86 行)                  → ~1,100 token
creativity-constraints.md (327 行)      → ~4,100 token  ← 条件化后按需
selling-points.md (687 行)              → ~8,600 token  ← 条件化后按需
setting-consistency.md (215 行)         → ~2,700 token
+ templates/genres/古言.md (257 行)     → ~3,200 token
──────────────────────────────────────────
总计：~48,000+ token
```

#### 改造后加载链

```
精简主 SKILL.md (~100 行)               → ~1,250 token
webnovel-init SKILL.md (精简 ~200 行)   → ~2,500 token
genre-tropes.md (183 行)                → ~2,300 token
题材索引 → 命中古言 → 古装目录 1 文件    → ~1,200 token（替代 8,700）
templates/genres/古言.md (257 行)       → ~3,200 token
+ 按需加载 creativity/selling-points     → ~4,000 token（只在 Step 5 时）
──────────────────────────────────────────
总计：~14,500 token
```

**节省：~33,500 token（~70%）**

---

## 五、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 路由表判断错误，加载了错误的 reference | 创作质量下降 | 路由表设计明确，边界清晰；允许用户手动指定 |
| 条件化后遗漏了必要的 reference | 流程中断 | 保留"如果流程报错，检查是否遗漏 reference"的提示 |
| 章节摘要质量不够，丢失关键信息 | 后续章节连贯性问题 | 摘要模板包含结构化字段（伏笔/角色/场景），不依赖自由文本 |
| 依赖索引查询不到某些隐式依赖 | 遗漏前序章节上下文 | 保留"前 2 章摘要"作为兜底，加上 RAG assist 补充 |
| Agent 定义精简后丢失重要指令 | 审查/任务书质量下降 | 精简只移除示例和重复说明，不移除核心指令 |

---

## 六、验收标准

| 指标 | 当前值 | 目标值 |
|------|--------|--------|
| 主 SKILL.md 行数 | 322 | ≤ 120 |
| 单次 write 流程的系统提示词 token | ~38,000 | ≤ 12,000 |
| 单次 init 流程的系统提示词 token | ~48,000 | ≤ 18,000 |
| 题材相关文件加载行数 | 最坏 13,331 | ≤ 600 |
| 写第 N 章时加载的前序章节数 | 最坏 N-1 | ≤ 3（摘要）+ 2（依赖） |
| "always" 标记的 reference 文件数 | 8 个 | ≤ 2 个 |
