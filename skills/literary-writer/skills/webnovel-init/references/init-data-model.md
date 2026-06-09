# 初始化数据模型与执行细节

> 本文件包含 init 流程的内部数据模型和执行命令细节。由 webnovel-init SKILL.md 按需引用。

---

## 内部数据模型（初始化收集对象）

```json
{
  "project": {
    "title": "",
    "genre": "",
    "target_words": 0,
    "target_chapters": 0,
    "one_liner": "",
    "core_conflict": "",
    "target_reader": "",
    "platform": ""
  },
  "protagonist": {
    "name": "",
    "desire": "",
    "flaw": "",
    "archetype": "",
    "structure": "单主角"
  },
  "relationship": {
    "heroine_config": "",
    "heroine_names": [],
    "heroine_role": "",
    "co_protagonists": [],
    "co_protagonist_roles": [],
    "antagonist_tiers": {},
    "antagonist_level": "",
    "antagonist_mirror": ""
  },
  "golden_finger": {
    "type": "",
    "name": "",
    "style": "",
    "visibility": "",
    "irreversible_cost": "",
    "growth_rhythm": ""
  },
  "world": {
    "scale": "",
    "factions": "",
    "power_system_type": "",
    "social_class": "",
    "resource_distribution": "",
    "currency_system": "",
    "currency_exchange": "",
    "sect_hierarchy": "",
    "cultivation_chain": "",
    "cultivation_subtiers": ""
  },
  "constraints": {
    "anti_trope": "",
    "hard_constraints": [],
    "core_selling_points": [],
    "opening_hook": ""
  }
}
```

## 题材集合（用于归一化与映射）

- 玄幻修仙类：修仙 | 系统流 | 高武 | 西幻 | 无限流 | 末世 | 科幻
- 都市现代类：都市异能 | 都市日常 | 都市脑洞 | 现实题材 | 黑暗题材 | 电竞 | 直播文
- 言情类：古言 | 宫斗宅斗 | 青春甜宠 | 豪门总裁 | 职场婚恋 | 民国言情 | 幻想言情 | 现言脑洞 | 女频悬疑 | 狗血言情 | 替身文 | 多子多福 | 种田 | 年代
- 特殊题材：规则怪谈 | 悬疑脑洞 | 悬疑灵异 | 历史古代 | 历史脑洞 | 游戏体育 | 抗战谍战 | 知乎短篇 | 克苏鲁

## init_project.py 执行命令

```bash
python "${SCRIPTS_DIR}/webnovel.py" init \
  "${PROJECT_ROOT}" \
  "{title}" \
  "{genre}" \
  --protagonist-name "{protagonist_name}" \
  --target-words {target_words} \
  --target-chapters {target_chapters} \
  --golden-finger-name "{gf_name}" \
  --golden-finger-type "{gf_type}" \
  --golden-finger-style "{gf_style}" \
  --core-selling-points "{core_points}" \
  --protagonist-structure "{protagonist_structure}" \
  --heroine-config "{heroine_config}" \
  --heroine-names "{heroine_names}" \
  --heroine-role "{heroine_role}" \
  --co-protagonists "{co_protagonists}" \
  --co-protagonist-roles "{co_protagonist_roles}" \
  --antagonist-tiers "{antagonist_tiers}" \
  --world-scale "{world_scale}" \
  --factions "{factions}" \
  --power-system-type "{power_system_type}" \
  --social-class "{social_class}" \
  --resource-distribution "{resource_distribution}" \
  --gf-visibility "{gf_visibility}" \
  --gf-irreversible-cost "{gf_irreversible_cost}" \
  --currency-system "{currency_system}" \
  --currency-exchange "{currency_exchange}" \
  --sect-hierarchy "{sect_hierarchy}" \
  --cultivation-chain "{cultivation_chain}" \
  --cultivation-subtiers "{cultivation_subtiers}" \
  --protagonist-desire "{protagonist_desire}" \
  --protagonist-flaw "{protagonist_flaw}" \
  --protagonist-archetype "{protagonist_archetype}" \
  --antagonist-level "{antagonist_level}" \
  --target-reader "{target_reader}" \
  --platform "{platform}"
```

## idea_bank.json 结构

```json
{
  "selected_idea": {
    "title": "",
    "one_liner": "",
    "anti_trope": "",
    "hard_constraints": []
  },
  "constraints_inherited": {
    "anti_trope": "",
    "hard_constraints": [],
    "protagonist_flaw": "",
    "antagonist_mirror": "",
    "opening_hook": ""
  }
}
```

## 项目目录安全规则

- `project_root` 必须由书名安全化生成（去非法字符，空格转 `-`）。
- 构造公式：`project_root = <当前工作目录>/<书名安全化结果>`，即 `PROJECT_ROOT="${WORKSPACE_ROOT}/${PROJECT_SLUG}"`。
- 若安全化结果为空或以 `.` 开头，自动前缀 `proj-`。
- 禁止在插件目录下生成项目文件（`${CLAUDE_PLUGIN_ROOT}`）。
- 禁止直接把 `WORKSPACE_ROOT` 当作 `PROJECT_ROOT`，除非用户明确指定当前目录本身就是书项目根。

推荐安全化命令：

```bash
PROJECT_SLUG="$(python -X utf8 -c "import re,sys; title=sys.argv[1].strip(); slug=re.sub(r'[\\\\/:*?\"<>|]+','',title); slug=re.sub(r'\\s+','-',slug).strip('-'); print(('proj-' + slug) if (not slug or slug.startswith('.')) else slug)" "{title}")"
PROJECT_ROOT="${WORKSPACE_ROOT}/${PROJECT_SLUG}"
echo "WORKSPACE_ROOT=${WORKSPACE_ROOT}"
echo "PROJECT_SLUG=${PROJECT_SLUG}"
echo "PROJECT_ROOT=${PROJECT_ROOT}"
```

## Story System 初始化命令

```bash
GENRE="$(python -X utf8 -c "import json,os; root=os.environ['PROJECT_ROOT']; s=json.load(open(root + '/.webnovel/state.json',encoding='utf-8')); print(s.get('project',{}).get('genre',''))")"

python -X utf8 "${SCRIPTS_DIR}/webnovel.py" --project-root "${PROJECT_ROOT}" \
  story-system "${GENRE}" --genre "${GENRE}" --persist --format json
```

说明：
- 此时不传 `--chapter`，只生成 `MASTER_SETTING.json` 和 `anti_patterns.json`
- 不传 `--emit-runtime-contracts`（还没有卷/章级数据）
- plan 阶段拆到具体章节时再生成 volume/chapter/review 合同
