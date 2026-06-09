# 题材库索引

> 根据用户选定的题材，Read 对应目录下的文件。不要全量扫描 genres/ 目录。

---

## 题材 → 文件路由表

### 玄幻修仙类

| 题材 | 核心文件 | 用途 |
|------|---------|------|
| 修仙/玄幻/高武 | `genres/xuanhuan/cultivation-levels.md` | 升级体系、境界链设计 |
| | `genres/xuanhuan/power-systems.md` | 力量体系规则 |
| | `genres/xuanhuan/xuanhuan-cool-points.md` | 爽点设计 |
| | `genres/xuanhuan/xuanhuan-plot-patterns.md` | 玄幻情节模式 |

### 言情类

| 题材 | 核心文件 | 用途 |
|------|---------|------|
| 狗血言情/甜宠/替身文 | `genres/dog-blood-romance/character-archetypes.md` | 言情人设模板 |
| | `genres/dog-blood-romance/emotional-tension.md` | 情感张力设计 |
| | `genres/dog-blood-romance/torture-points.md` | 虐点设计 |
| | `genres/dog-blood-romance/sweet-moments.md` | 甜宠桥段 |
| | `genres/dog-blood-romance/romance-pacing.md` | 感情线节奏 |
| | `genres/dog-blood-romance/romance-tropes.md` | 言情套路 |
| | `genres/dog-blood-romance/plot-templates.md` | 言情情节模板 |

### 古装/宫斗类

| 题材 | 核心文件 | 用途 |
|------|---------|------|
| 古言/宫斗宅斗/历史古代 | `genres/period-drama/ancient-dialogue.md` | 古风对白写法 |
| | `genres/period-drama/character-design.md` | 古装人设 |
| | `genres/period-drama/historical-setting.md` | 历史背景设定 |
| | `genres/period-drama/palace-intrigue.md` | 宫斗权谋设计 |
| | `genres/period-drama/plot-patterns.md` | 古装情节模式 |

### 悬疑/推理类

| 题材 | 核心文件 | 用途 |
|------|---------|------|
| 规则怪谈/悬疑推理 | `genres/rules-mystery/core-elements.md` | 核心要素 |
| | `genres/rules-mystery/clue-design.md` | 线索设计 |
| | `genres/rules-mystery/detective-design.md` | 推理人设 |
| | `genres/rules-mystery/trick-design.md` | 诡计设计 |
| | `genres/rules-mystery/revelation-design.md` | 揭秘设计 |
| | `genres/rules-mystery/structure-pacing.md` | 结构与节奏 |
| | `genres/rules-mystery/suspect-management.md` | 嫌疑人管理 |

### 现实题材类

| 题材 | 核心文件 | 用途 |
|------|---------|------|
| 现实题材/都市日常 | `genres/realistic/character-depth.md` | 人物深度 |
| | `genres/realistic/dialogue-authenticity.md` | 对白真实感 |
| | `genres/realistic/plot-logic.md` | 情节逻辑 |
| | `genres/realistic/reality-anchoring.md` | 现实锚定 |
| | `genres/realistic/social-issues.md` | 社会议题 |

### 短篇类

| 题材 | 核心文件 | 用途 |
|------|---------|------|
| 知乎短篇/脑洞文 | `genres/zhihu-short/hook-techniques.md` | 开头钩子 |
| | `genres/zhihu-short/plot-compression.md` | 情节压缩 |
| | `genres/zhihu-short/emotional-peaks.md` | 情感高潮 |
| | `genres/zhihu-short/ending-patterns.md` | 结尾模式 |
| | `genres/zhihu-short/genre-templates.md` | 短篇模板 |
| | `genres/zhihu-short/character-quick-build.md` | 快速人设 |
| | `genres/zhihu-short/pacing-rhythm.md` | 节奏控制 |

---

## 题材模板（templates/genres/）

用于 init 阶段，用户选定题材后 Read 对应模板。

| 分类 | 模板文件 |
|------|---------|
| 玄幻修仙 | `修仙.md`, `系统流.md`, `高武.md`, `西幻.md`, `无限流.md`, `末世.md`, `科幻.md` |
| 都市现代 | `都市异能.md`, `都市日常.md`, `都市脑洞.md`, `现实题材.md`, `黑暗题材.md`, `电竞.md`, `直播文.md` |
| 言情 | `古言.md`, `宫斗宅斗.md`, `青春甜宠.md`, `豪门总裁.md`, `职场婚恋.md`, `民国言情.md`, `幻想言情.md`, `现言脑洞.md`, `女频悬疑.md`, `狗血言情.md`, `替身文.md`, `多子多福.md`, `种田.md`, `年代.md` |
| 特殊题材 | `规则怪谈.md`, `悬疑脑洞.md`, `悬疑灵异.md`, `历史古代.md`, `历史脑洞.md`, `游戏体育.md`, `抗战谍战.md`, `知乎短篇.md`, `克苏鲁.md` |

---

## 使用方式

1. 确定用户题材
2. 从路由表找到对应目录和文件
3. 只 Read 需要的 1-2 个文件（优先核心文件列表的第一个）
4. 不要 Read 整个 genres/ 目录
5. 题材模板只在 init 阶段使用，plan/write 阶段不加载
