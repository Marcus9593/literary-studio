# 测试目标配置

每个 JSON 文件描述一个可测的后端实例。通过环境变量 `STUDIO_TARGET` 选择目标（默认 `local`）。

| 文件 | 用途 |
|------|------|
| `local.json` | 本地 `npm start` 开发后端（默认 8765） |
| `dmg.json` | DMG / Electron 桌面版内置后端 |

## DMG 端口

Electron 每次启动会占用新的随机端口。运行 DMG 测试前可自动探测并写回配置：

```bash
cd test
python3 scripts/detect_dmg_port.py
STUDIO_TARGET=dmg pytest
```

或一键执行：

```bash
./run_dmg_tests.sh
```

## 环境变量优先级

`STUDIO_BASE_URL` / `STUDIO_WS_URL` / `STUDIO_ADMIN_*` 环境变量会覆盖 JSON 中的对应字段。
