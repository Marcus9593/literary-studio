# 角色弧光追踪系统

## 一、弧光类型

### 1.1 五种弧光形态

| 类型 | 代号 | 核心变化 | 典型示例 |
|------|------|---------|---------|
| 正向弧光 | `positive` | 角色克服致命缺陷，拥抱真相 | 懦弱者成为英雄 |
| 负向弧光 | `negative` | 角色拒绝真相，堕入更深的谎言 | 善良者走向暴政 |
| 平坦弧光 | `flat` | 角色本身不变，但改变了周围世界 | 超人式角色坚守信念影响他人 |
| 堕落弧光 | `corruption` | 角色主动拥抱谎言，从光明走向黑暗 | 天才科学家成为反派 |
| 混合弧光 | `mixed` | 多条弧光线交织，角色在不同维度上同时经历不同变化 | 在爱情中成长但在事业中堕落 |

### 1.2 弧光选择原则

弧光类型由角色的 **致命缺陷（fatal_flaw）** 与 **核心真相（core_truth）** 之间的关系决定：

- **正向**：缺陷被克服，真相被接受
- **负向**：缺陷加深，真相被拒绝
- **平坦**：缺陷不构成核心冲突，真相始终被持有
- **堕落**：角色原本持有真相，但主动放弃
- **混合**：在不同主题线上，角色同时经历不同方向的弧光

---

## 二、六阶段弧光模型

基于角色内心转变的叙事理论，将弧光分为 6 个阶段：

### 阶段 1：谎言（The Lie）
> **角色相信一个谎言**

- 角色持有错误的世界观或信念
- 这个谎言通常是角色应对创伤的防御机制
- 例："我不需要任何人，独自一人就能活下去"

**追踪信号**：
- character_notes 中的 `lie` 字段
- 角色独白或内心活动中的自我欺骗
- 其他角色对主角错误认知的反馈

### 阶段 2：欲望（The Want）
> **角色追求一个外在目标**

- 角色基于谎言设定一个外在目标
- 这个目标表面上看起来合理，但实际上是谎言的延伸
- 例："我要成为最强的修士，证明我不需要任何人"

**追踪信号**：
- 角色明确表达的目标
- character_notes 中的 `want` 字段
- 推动情节前进的行动

### 阶段 3：冲突（The Friction）
> **欲望与需求产生摩擦**

- 角色的外在追求（want）与内在真实需求（need）开始冲突
- 角色遇到无法用谎言解释的困境
- 例："为了变强，我不得不依赖他人——但这与我的信念矛盾"

**追踪信号**：
- 角色在两个选择之间犹豫
- 需要他人帮助但拒绝承认
- character_notes 中的 `need` 字段被触发
- story_events 中的 `value_shift_occurred` 事件

### 阶段 4：危机（The Crisis）
> **角色面对真相**

- 角色被迫面对谎言的虚假性
- 通常是故事的最低点或最黑暗时刻
- 例："原来我一直都是错的，我一直在伤害在乎我的人"

**追踪信号**：
- story_events 中的 `lie_challenged` 事件
- character_state_changed 中的重大状态变化
- 角色面临生死抉择或重大失去

### 阶段 5：高潮抉择（The Climax Choice）
> **角色选择：接受真相还是拒绝它**

- 弧光的决定性时刻
- 正向弧光：角色选择接受真相，即使代价巨大
- 负向弧光：角色选择拒绝真相，即使证据确凿
- 例："我选择相信他们，即使可能被背叛"

**追踪信号**：
- story_events 中的 `arc_stage_changed` 事件
- 角色做出与其一贯行为相反的决定
- 高潮场景中的关键对白

### 阶段 6：新平衡（The New Equilibrium）
> **角色转变或保持不变**

- 正向弧光：角色获得新的世界观，缺陷被克服
- 负向弧光：角色回到起点或更糟的状态
- 平坦弧光：角色保持不变，但世界因他们而改变
- 例："我不再是那个孤独的人，我学会了信任"

**追踪信号**：
- story_events 中的 `truth_discovered` 事件
- 角色在新情境下的行为模式变化
- character_state_changed 中的最终状态

---

## 三、弧光追踪数据模型

### 3.1 角色弧光状态 JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "CharacterArc",
  "type": "object",
  "required": ["character_id", "arc_type", "current_stage", "stages"],
  "properties": {
    "character_id": {
      "type": "string",
      "description": "角色唯一标识"
    },
    "arc_type": {
      "type": "string",
      "enum": ["positive", "negative", "flat", "corruption", "mixed"],
      "description": "弧光类型"
    },
    "current_stage": {
      "type": "integer",
      "minimum": 0,
      "maximum": 5,
      "description": "当前阶段索引（0-5 对应 6 个阶段）"
    },
    "fatal_flaw": {
      "type": "string",
      "description": "角色的致命缺陷（自动推断或手动设定）"
    },
    "core_truth": {
      "type": "string",
      "description": "角色需要接受的核心真相"
    },
    "lie": {
      "type": "string",
      "description": "角色相信的谎言"
    },
    "want": {
      "type": "string",
      "description": "角色的外在欲望"
    },
    "need": {
      "type": "string",
      "description": "角色的内在需求"
    },
    "stages": {
      "type": "array",
      "items": {
        "$ref": "#/definitions/ArcStage"
      },
      "description": "6 个阶段的详细状态"
    },
    "timeline": {
      "type": "array",
      "items": {
        "$ref": "#/definitions/ArcEvent"
      },
      "description": "弧光关键时刻时间线"
    },
    "confidence": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "description": "弧光分析置信度"
    },
    "last_updated_chapter": {
      "type": "integer",
      "description": "最后一次更新的章节"
    }
  },
  "definitions": {
    "ArcStage": {
      "type": "object",
      "required": ["index", "name", "status"],
      "properties": {
        "index": {
          "type": "integer",
          "minimum": 0,
          "maximum": 5
        },
        "name": {
          "type": "string",
          "enum": ["谎言", "欲望", "冲突", "危机", "高潮抉择", "新平衡"]
        },
        "status": {
          "type": "string",
          "enum": ["pending", "active", "completed", "skipped"]
        },
        "chapter_entered": {
          "type": ["integer", "null"],
          "description": "进入该阶段的章节号"
        },
        "chapter_completed": {
          "type": ["integer", "null"],
          "description": "完成该阶段的章节号"
        },
        "evidence": {
          "type": "array",
          "items": { "type": "string" },
          "description": "支持该阶段判断的证据事件 ID"
        }
      }
    },
    "ArcEvent": {
      "type": "object",
      "required": ["chapter", "event_type", "description"],
      "properties": {
        "chapter": {
          "type": "integer"
        },
        "event_type": {
          "type": "string",
          "enum": [
            "arc_stage_changed",
            "lie_challenged",
            "truth_discovered",
            "fatal_flaw_revealed",
            "want_expressed",
            "need_recognized",
            "climax_choice"
          ]
        },
        "description": {
          "type": "string"
        },
        "story_event_id": {
          "type": ["string", "null"],
          "description": "关联的 story_events 记录 ID"
        }
      }
    }
  }
}
```

### 3.2 多角色弧光交织设计

当多个角色的弧光在同一故事中交织时，需要追踪以下关系：

#### 弧光交织模式

| 模式 | 说明 | 示例 |
|------|------|------|
| 镜像 | 两个角色经历相似的弧光，但做出相反选择 | 双主角，一个正向一个负向 |
| 对立 | 角色的弧光相互推动，形成张力 | 主角的成长推动反派的堕落 |
| 辅助 | 配角的弧光服务于主角弧光 | 导师的平坦弧光支撑主角的正向弧光 |
| 交织 | 多条弧光线在关键节点交汇 | 群像剧中的多线叙事 |

#### 交织追踪数据结构

```json
{
  "arc_interweave": {
    "type": "array",
    "items": {
      "type": "object",
      "properties": {
        "character_a": { "type": "string" },
        "character_b": { "type": "string" },
        "pattern": {
          "type": "string",
          "enum": ["mirror", "opposition", "support", "intertwine"]
        },
        "intersection_chapters": {
          "type": "array",
          "items": { "type": "integer" }
        },
        "description": { "type": "string" }
      }
    }
  }
}
```

---

## 四、弧光阶段转换信号

### 4.1 自动检测信号

系统通过以下信号自动推断弧光阶段转换：

| 信号源 | 阶段转换 | 置信度权重 |
|--------|---------|-----------|
| character_notes.lie 出现 | 0 -> 1 | 0.9 |
| character_notes.want 出现 | 1 -> 2 | 0.85 |
| value_shift_occurred 事件 | 2 -> 3 | 0.7 |
| lie_challenged 事件 | 3 -> 4 | 0.8 |
| arc_stage_changed 事件（手动触发） | 任意 -> 任意 | 1.0 |
| truth_discovered 事件 | 4 -> 5 | 0.85 |
| character_state_changed 中的重大变化 | 3 -> 4 或 4 -> 5 | 0.6 |

### 4.2 置信度计算

```javascript
// 弧光阶段判断置信度公式
confidence = base_confidence
  * source_weight        // 数据源权重（notes=0.9, events=0.7, heuristic=0.5）
  * evidence_count_boost // 证据数量加成（每条证据 +0.05，上限 0.2）
  * recency_factor       // 时效性因子（最近章节的证据权重更高）
```

---

## 五、自检清单

### 5.1 弧光完整性检查

- [ ] 每个主角都有明确的 `lie`、`want`、`need` 定义
- [ ] 弧光类型已确定（正向/负向/平坦/堕落/混合）
- [ ] 致命缺陷（fatal_flaw）已被识别和记录
- [ ] 6 个阶段中至少 4 个有明确的叙事证据
- [ ] 高潮抉择场景已规划或已完成

### 5.2 弧光连贯性检查

- [ ] 阶段转换有明确的触发事件
- [ ] 角色行为与当前弧光阶段一致
- [ ] 没有跳跃式阶段转换（除非有充分铺垫）
- [ ] 弧光推进速度与故事节奏匹配

### 5.3 多角色弧光协调检查

- [ ] 主角弧光是故事的核心驱动力
- [ ] 配角弧光服务于主角弧光或主题
- [ ] 没有弧光冲突导致的叙事矛盾
- [ ] 交织点有足够的叙事空间

### 5.4 数据质量检查

- [ ] 弧光分析置信度 >= 0.80
- [ ] 每个阶段至少有 2 条 evidence 记录
- [ ] timeline 中的事件按章节顺序排列
- [ ] character_notes 中的 lie/want/need 已与弧光状态同步

---

## 六、与现有系统的集成

### 6.1 与 story_events 的关系

弧光追踪系统建立在 story_events 之上：

- `arc_stage_changed`：记录阶段转换
- `lie_challenged`：记录谎言被挑战的时刻
- `truth_discovered`：记录真相被发现的时刻

### 6.2 与 knowledge bundle 的关系

从 character_notes 中提取弧光核心要素：

- `lie` -> 弧光阶段 0 的核心内容
- `want` -> 弧光阶段 1 的核心内容
- `need` -> 弧光阶段 3 的内在驱动力
- `fatal_flaw` -> 弧光的根本原因

### 6.3 与 story_understanding 的关系

arc-analyzer.js 是 story-understanding 模块的一部分，负责：

1. 从 knowledge bundle 读取角色设定
2. 从 story_events 追踪状态变化
3. 推断当前弧光阶段
4. 生成弧光相关的 story actions
