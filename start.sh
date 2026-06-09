#!/usr/bin/env bash
# 文匠 Studio — macOS / Linux 启动入口
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
exec node "$ROOT/scripts/start.mjs"
