# literary-writer（工程内嵌）

全栈文学创作 Skill，已集成到文匠 Studio 工程中，**无需**再安装到 `~/.cursor/skills`。

## 位置

```
skills/literary-writer/
├── SKILL.md              # 主 Skill 入口
├── skills/               # 子 Skill（webnovel-write / plan / init …）
├── scripts/webnovel.py   # CLI 写章引擎
├── references/           # 体裁参考文档
├── templates/            # 输出模板
├── agents/               # Agent 定义
└── genres/               # 题材配置
```

当前版本：**7.0.0**（见 `.claude-plugin/plugin.json`）

## 与 Studio 的集成

- 启动时 `bootstrapToolsConfig()` 自动将 `data/tools.json` 的 `literary_writer_root` 指向本目录
- `skill_scan_dirs` 自动包含 `skills/`，工具中心可扫描到 literary-writer 及子 Skill
- 默认 Skill 绑定：`literary-writer`（可在工具中心修改）

## 从外部目录更新

若你在 `E:\归档\literary-writer` 维护主副本，可同步到工程：

```bash
# Windows（默认源 E:\归档\literary-writer）
node scripts/sync-literary-writer.mjs

# 指定路径
node scripts/sync-literary-writer.mjs "D:\path\to\literary-writer"

# macOS / Linux
LITERARY_WRITER_SOURCE=/path/to/literary-writer node scripts/sync-literary-writer.mjs
```

同步后重启 Studio：`npm start`

## Python 依赖（可选）

写章 preflight / `webnovel.py` CLI 如需完整能力，在 skill 目录安装依赖：

```bash
cd skills/literary-writer/scripts
pip install -r requirements.txt
```

未安装 Python 依赖时，Studio 仍可通过 LLM Runtime 写章；CLI 增强功能可能不可用。
