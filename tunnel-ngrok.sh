#!/usr/bin/env bash
# 将本机文匠 Studio (8765) 暴露到公网，供朋友临时访问。
# 首次使用：在 https://dashboard.ngrok.com/get-started/your-authtoken 复制 token，然后：
#   ngrok config add-authtoken <你的token>
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
PORT="${PORT:-8765}"

if ! command -v ngrok >/dev/null 2>&1; then
  echo "未找到 ngrok。安装: brew install --cask ngrok"
  exit 1
fi

if ! lsof -i ":$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "端口 $PORT 未监听，正在启动文匠 Studio…"
  (cd "$ROOT" && ./start.sh) &
  for _ in $(seq 1 30); do
    lsof -i ":$PORT" -sTCP:LISTEN >/dev/null 2>&1 && break
    sleep 0.5
  done
fi

if ! lsof -i ":$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "ERROR: 服务未在 127.0.0.1:$PORT 启动"
  exit 1
fi

echo "本地服务: http://127.0.0.1:$PORT"
echo "启动 ngrok 隧道（Ctrl+C 结束）…"
echo "公网地址可在另一终端查看: curl -s http://127.0.0.1:4040/api/tunnels | python3 -m json.tool"
exec ngrok http "$PORT"
