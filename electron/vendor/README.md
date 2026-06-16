# Electron 打包依赖（本地维护，不提交 Git）

构建 Intel (x64) DMG 前，将运行时依赖放在此目录。`scripts/build-electron.mjs` 检测到文件存在后会**跳过在线下载**。

## 目录结构

```
vendor/
├── claude/
│   └── claude          # macOS Intel：Mach-O x86_64 原生二进制
└── python/
    └── bin/
        └── python3     # 独立 venv（docx/pdf 导入用）
```

## Claude CLI（Intel / darwin-x64）

1. 从本机已安装的 Claude Code 扩展复制（版本需与扩展一致）：

```bash
mkdir -p electron/vendor/claude
cp ~/.vscode/extensions/anthropic.claude-code-*-darwin-x64/resources/native-binary/claude \
   electron/vendor/claude/claude
chmod +x electron/vendor/claude/claude
```

2. 验证：

```bash
file electron/vendor/claude/claude    # 应为 Mach-O 64-bit executable x86_64
electron/vendor/claude/claude --version
```

## Python（可选，用于 docx/pdf/zip 导入）

```bash
/usr/local/bin/python3 -m venv --copies electron/vendor/python
electron/vendor/python/bin/python3 -m pip install -r backend/requirements.txt
```

> 不要用 `/usr/bin/python3` 建 venv（符号链接会导致 electron-builder 打包失败）。

## 构建

```bash
node scripts/build-electron.mjs --x64
```

打包后路径：`文匠 Studio.app/.../app.asar.unpacked/electron/vendor/claude/claude`
