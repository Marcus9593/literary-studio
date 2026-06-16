#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "==> 探测 DMG 后端端口并更新 targets/dmg.json"
python3 scripts/detect_dmg_port.py

echo "==> 安装测试依赖"
python3 -m pip install -q -r requirements.txt

export STUDIO_TARGET=dmg
export PYTEST_DISABLE_PLUGIN_AUTOLOAD=1

echo "==> 运行全部接口测试 (modules + scenarios + tests，排除 _backup 重复副本) 目标: $STUDIO_TARGET"
python3 -m pytest modules scenarios tests --ignore=tests/_backup "$@"
