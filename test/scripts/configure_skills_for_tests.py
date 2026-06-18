#!/usr/bin/env python3
"""Point installed Electron app at bundled literary-writer skill for integration tests."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from helpers.client import ApiClient


def main() -> int:
    lw = os.environ.get(
        "STUDIO_LITERARY_WRITER_ROOT",
        r"C:\Users\Administrator\AppData\Local\Programs\literary-studio\resources\skills\literary-writer",
    )
    c = ApiClient()
    c.login("admin", "admin123")

    r1 = c.put("/tools/literary-writer", json_body={"path": lw})
    if r1.status_code != 200:
        print(f"literary-writer path failed: {r1.status_code} {r1.text[:200]}", file=sys.stderr)
        return 1
    print(f"literary-writer path ok: {lw}")

    r2 = c.put("/tools/default-skill", json_body={"skill_id": "literary-writer"})
    if r2.status_code != 200:
        print(f"default-skill failed: {r2.status_code} {r2.text[:200]}", file=sys.stderr)
        return 1
    print("default skill set to literary-writer")

    r3 = c.get("/tools/skills/capabilities/default")
    print(f"capabilities/default: {r3.status_code}")
    return 0 if r3.status_code == 200 else 1


if __name__ == "__main__":
    raise SystemExit(main())
