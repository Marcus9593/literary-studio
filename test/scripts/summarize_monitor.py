#!/usr/bin/env python3
"""汇总 monitor_backend.py 输出。"""
from __future__ import annotations

import json
import statistics
import sys
from pathlib import Path

path = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/wenjiang-backend-monitor.jsonl")
if not path.exists():
    print("无监控日志:", path)
    raise SystemExit(1)

rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
if not rows:
    print("监控日志为空")
    raise SystemExit(1)

times = [r["health"]["ms"] for r in rows if r["health"].get("ms") is not None]
timeouts = [r for r in rows if r["health"].get("timeout")]
failures = [r for r in rows if not r["health"].get("ok")]
slow = [r for r in rows if r["health"].get("ms", 0) >= 3000 and r["health"].get("ok")]
dead = [r for r in rows if r.get("proc_state") in ("dead", "not_running")]

print(f"样本数: {len(rows)}")
print(f"health 中位: {statistics.median(times):.0f}ms  P95: {statistics.quantiles(times, n=20)[18]:.0f}ms  max: {max(times):.0f}ms")
print(f"超时: {len(timeouts)}  失败: {len(failures)}  慢(>=3s): {len(slow)}  进程异常: {len(dead)}")
if timeouts:
    print("\n超时时刻:")
    for r in timeouts[:10]:
        print(" ", r["ts"], r["health"].get("error", ""))
if slow:
    print("\n最慢 5 次:")
    for r in sorted(slow, key=lambda x: x["health"]["ms"], reverse=True)[:5]:
        print(f"  {r['ts']} {r['health']['ms']}ms")
if dead:
    print("\n进程异常:")
    for r in dead[:5]:
        print(" ", r["ts"], r["proc_state"])

raise SystemExit(1 if timeouts or dead else 0)
