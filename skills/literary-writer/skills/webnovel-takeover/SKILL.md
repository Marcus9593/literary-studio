---
name: webnovel-takeover
description: 导入并分析已有的半成品小说项目，逆向工程项目结构，生成接管报告并可选初始化 .webnovel/ 目录。
allowed-tools: Read Write Edit Grep Bash Agent AskUserQuestion
---

# 接管已有项目

## 目标

- 扫描用户提供的已有小说文本（目录或文件列表）
- 逆向工程提取：实体、设定、关系、风格指纹、结构分析
- 检测已有文本中的设定冲突与未闭合伏笔
- 生成接管报告（`接管报告/takeover_report.md`）
- 可选：基于分析结果 bootstrap 一个 `.webnovel/` 项目目录

## 模式

| 模式 | 流程 | 说明 |
|------|------|------|
| `analyze-only` | Step 1→2→3→4→5 | 只生成接管报告 |
| `full-takeover` | Step 1→2→3→4→5→6→7 | 报告 + 初始化项目 |

默认为 `analyze-only`。用户明确要求初始化项目时使用 `full-takeover`。

## 硬规则

- 必须使用 `Agent` 工具调用 `takeover-analyzer`；不得由主流程口头代替
- 分析结果必须有置信度标注，低于 0.5 的条目标记为"待确认"
- 不修改用户提供的源文件
- 生成的接管报告必须包含质量评估（confidence + coverage）

## 优先级

用户要求 > 分析质量门控 > 项目约束 > skill 流程

---

## 执行流程

### 准备：环境

```bash
export WORKSPACE_ROOT="${CLAUDE_PROJECT_DIR:-$PWD}"
export SCRIPTS_DIR="${CLAUDE_PLUGIN_ROOT:?}/scripts"
export SKILL_ROOT="${CLAUDE_PLUGIN_ROOT:?}/skills/webnovel-takeover"
```

### Step 1：扫描与索引已有文本

1. `AskUserQuestion` 获取文本路径：
   - 单文件（整本小说在一个文件中）
   - 目录（每章一个文件）
   - 多文件列表（用户手动指定）

2. 扫描目录，识别章节边界：
   - 常见模式：`第X章`、`Chapter X`、数字编号、`---` 分隔符
   - 若无法自动识别，`AskUserQuestion` 请用户确认

3. 生成章节目录清单：
   ```
   ch0001: 正文/第001章-标题.md (3200字)
   ch0002: 正文/第002章-标题.md (2800字)
   ...
   ```

4. 统计：总章节数、总字数、平均每章字数

### Step 2：实体与设定提取

```text
Agent(
  subagent_type: "literary-writer:takeover-analyzer",
  prompt: "chapters=[章节目录清单]; analysis_mode=batch; project_root=${PROJECT_ROOT}; scripts_dir=${SCRIPTS_DIR}。按批次处理（每批 5-10 章），提取实体、设定、关系。"
)
```

提取内容：
- 角色（姓名/别名/类型/属性/境界/性格）
- 地点、组织、物品
- 力量体系规则（从文本中推断）
- 世界观规则（从文本中推断）
- 角色关系图谱

### Step 3：结构分析

```text
Agent(
  subagent_type: "literary-writer:takeover-analyzer",
  prompt: "analysis_mode=structure; chapters=[章节目录清单]; entities=[Step 2 结果]。逆向工程：卷结构、主线/副线识别、情节节奏、高潮分布、伏笔状态。"
)
```

分析内容：
- 卷结构划分（如有明显分卷）
- 主线和副线识别
- 情节节奏（高潮/低谷分布）
- 伏笔清单（已闭合/未闭合）
- 粗粒度时间线

### Step 4：风格指纹提取

```text
Agent(
  subagent_type: "literary-writer:takeover-analyzer",
  prompt: "analysis_mode=style; chapters=[章节目录清单]。从高质量段落中提取风格样本，分析句式偏好、词汇密度、对话风格、叙事视角、情绪描写模式。"
)
```

输出 `style_fingerprint` JSON，存储到 `.webnovel/style_fingerprint.json`。

### Step 5：冲突检测与接管报告

1. 对比 Step 2 中提取的实体状态，检测设定冲突：
   - 角色能力跳跃（同一角色在不同章节的能力描述矛盾）
   - 时间线矛盾（事件顺序冲突）
   - 地点逻辑冲突（地理描述不一致）
   - 未闭合伏笔（埋了但没回收的伏笔）

2. 生成接管报告 `接管报告/takeover_report.md`：
   - 项目概览（章节/字数/题材/视角）
   - 实体清单（角色/地点/组织/物品）
   - 结构分析（卷/主线/副线/节奏/伏笔）
   - 风格指纹（句式/词汇/对话/叙事/情绪）
   - 冲突清单（设定冲突/时间线矛盾/未闭合伏笔）
   - 接管建议（续写起点/优先修复/风格注意事项）

3. 质量评估：参照 `references/takeover-checklist.md` 的质量门控

### Step 6：项目骨架初始化（full-takeover 模式）

基于 Step 2-4 的分析结果，生成项目文件：

```bash
python -X utf8 "${SCRIPTS_DIR}/webnovel.py" --project-root "${WORKSPACE_ROOT}" \
  init --takeover-data "${PROJECT_ROOT}/.webnovel/takeover_analysis.json"
```

生成内容：
- `.webnovel/state.json`（基于提取的进度和主角状态）
- `设定集/世界观.md`（基于推断的世界观）
- `设定集/主角卡.md`（基于提取的主角信息）
- `设定集/力量体系.md`（基于推断的力量体系）
- `大纲/总纲.md`（基于逆向工程的结构）
- `.webnovel/style_fingerprint.json`（风格指纹）

### Step 7：验证与交接

1. 运行 preflight 验证：
   ```bash
   python -X utf8 "${SCRIPTS_DIR}/webnovel.py" --project-root "${PROJECT_ROOT}" preflight
   ```

2. 展示接管报告摘要（关键数据 + 风格指纹 + 冲突清单）

3. `AskUserQuestion` 确认：
   - 是否需要修正识别结果？
   - 从哪一章开始续写？
   - 是否需要修复已识别的冲突？

---

## 失败处理

| 场景 | 处理 |
|------|------|
| 无法识别章节边界 | `AskUserQuestion` 请用户提供章节列表 |
| 文本太短（< 5 章） | 降级为快速分析，跳过卷结构识别 |
| 实体提取置信度过低 | 标记"待确认"，在报告中列出供用户修正 |
| 用户拒绝初始化 | 只保留接管报告，不生成项目文件 |
| 分析过程中断 | 保存已完成的分析结果，下次可继续 |
