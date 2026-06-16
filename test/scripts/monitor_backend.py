#!/usr/bin/env python3
"""后台监控 DMG 后端：/api/health 响应时间与进程状态。"""
from __future__ import annotations

import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOG_PATH = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/tmp/wenjiang-backend-monitor.jsonl")
INTERVAL = float(sys.argv[2]) if len(sys.argv) > 2 else 3.0
TIMEOUT = float(sys.argv[3]) if len(sys.argv) > 3 else 5.0
APP_BIN = "文匠 Studio.app/Contents/MacOS/文匠 Studio"


def load_base_url() -> str:
    sys.path.insert(0, str(ROOT))
    import os
    os.environ.setdefault("STUDIO_TARGET", "dmg")
    import importlib
    import config
    importlib.reload(config)
    return config.BASE_URL.rstrip("/")


def main_pid() -> int | None:
    out = subprocess.check_output(["ps", "-ax", "-o", "pid=,command="], text=True, errors="replace")
    for line in out.splitlines():
        if APP_BIN in line and "Helper" not in line:
            return int(line.strip().split()[0])
    return None


def probe_health(base: str) -> dict:
    url = f"{base}/api/health"
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(url, timeout=TIMEOUT) as resp:
            body = resp.read(500).decode("utf-8", "replace")
            ms = (time.perf_counter() - start) * 1000
            return {
                "ok": resp.status == 200,
                "status": resp.status,
                "ms": round(ms, 1),
                "timeout": False,
                "partial": '"_partial"' in body,
            }
    except TimeoutError:
        return {"ok": False, "status": 0, "ms": TIMEOUT * 1000, "timeout": True, "error": "timeout"}
    except urllib.error.URLError as e:
        ms = (time.perf_counter() - start) * 1000
        return {"ok": False, "status": 0, "ms": round(ms, 1), "timeout": "timed out" in str(e).lower(), "error": str(e.reason or e)}
    except OSError as e:
        ms = (time.perf_counter() - start) * 1000
        return {"ok": False, "status": 0, "ms": round(ms, 1), "timeout": False, "error": str(e)}


def process_state(pid: int | None) -> str:
    if pid is None:
        return "not_running"
    try:
        out = subprocess.check_output(["ps", "-p", str(pid), "-o", "state="], text=True).strip()
        return out or "unknown"
    except subprocess.CalledProcessError:
        return "dead"


def main() -> int:
    base = load_base_url()
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    print(f"monitor: {base} every {INTERVAL}s -> {LOG_PATH}", flush=True)
    with LOG_PATH.open("w", encoding="utf-8") as log:
        while True:
            pid = main_pid()
            rec = {
                "ts": datetime.now().isoformat(timespec="seconds"),
                "pid": pid,
                "proc_state": process_state(pid),
                "health": probe_health(base),
            }
            log.write(json.dumps(rec, ensure_ascii=False) + "\n")
            log.flush()
            h = rec["health"]
            flag = ""
            if h.get("timeout"):
                flag = " TIMEOUT"
            elif h["ms"] >= 3000:
                flag = " SLOW"
            elif not h.get("ok"):
                flag = " FAIL"
            print(
                f"{rec['ts']} health={h.get('ms')}ms ok={h.get('ok')} proc={rec['proc_state']}{flag}",
                flush=True,
            )
            time.sleep(INTERVAL)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        raise SystemExit(0)
