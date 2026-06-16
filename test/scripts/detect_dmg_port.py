#!/usr/bin/env python3
"""探测运行中的 DMG/Electron 后端端口，并写回 test/targets/dmg.json。"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DMG_JSON = ROOT / "targets" / "dmg.json"
APP_NAME = "文匠 Studio.app/Contents/MacOS/文匠 Studio"


def find_main_pid() -> int | None:
    out = subprocess.check_output(["ps", "-ax", "-o", "pid=,command="], text=True, errors="replace")
    for line in out.splitlines():
        if APP_NAME in line and "Helper" not in line:
            return int(line.strip().split()[0])
    return None


def listen_ports(pid: int) -> list[int]:
    out = subprocess.check_output(
        ["lsof", "-nP", "-a", "-p", str(pid), "-iTCP", "-sTCP:LISTEN"],
        text=True,
        errors="replace",
    )
    ports: list[int] = []
    for line in out.splitlines():
        m = re.search(r"127\.0\.0\.1:(\d+)", line)
        if m:
            ports.append(int(m.group(1)))
    return ports


def health_ok(port: int) -> bool:
    url = f"http://127.0.0.1:{port}/api/health"
    try:
        with urllib.request.urlopen(url, timeout=2) as resp:
            body = resp.read(200).decode("utf-8", "replace")
            return resp.status == 200 and '"status"' in body
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


def main() -> int:
    pid = find_main_pid()
    if pid is None:
        print("未找到运行中的「文匠 Studio」进程，请先启动 DMG 应用。", file=sys.stderr)
        return 1

    ports = listen_ports(pid)
    if not ports:
        print(f"进程 {pid} 未监听 127.0.0.1 端口，后端可能尚未就绪。", file=sys.stderr)
        return 1

    chosen = next((p for p in ports if health_ok(p)), None)
    if chosen is None:
        print(f"在端口 {ports} 上未找到 /api/health 响应。", file=sys.stderr)
        return 1

    cfg = json.loads(DMG_JSON.read_text(encoding="utf-8"))
    host = cfg.get("host", "127.0.0.1")
    cfg["host"] = host
    cfg["port"] = chosen
    cfg["base_url"] = f"http://{host}:{chosen}"
    cfg["ws_url"] = f"ws://{host}:{chosen}/ws"
    DMG_JSON.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"已更新 {DMG_JSON}: {cfg['base_url']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
