from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = Path(os.environ.get("LITERARY_STUDIO_DATA", ROOT / "data"))
PROJECTS_DIR = DATA_DIR / "projects"
SETTINGS_PATH = DATA_DIR / "settings.json"
JOBS_PATH = DATA_DIR / "jobs.json"
TOOLS_CONFIG_PATH = DATA_DIR / "tools.json"

def _literary_writer_default() -> Path:
    tools_path = DATA_DIR / "tools.json"
    if tools_path.is_file():
        try:
            raw = json.loads(tools_path.read_text(encoding="utf-8"))
            custom = str(raw.get("literary_writer_root") or "").strip()
            if custom:
                p = Path(custom).expanduser().resolve()
                if p.is_dir():
                    return p
        except (OSError, json.JSONDecodeError, ValueError):
            pass
    env = os.environ.get("LITERARY_WRITER_ROOT")
    if env:
        return Path(env).expanduser().resolve()
    bundled = (ROOT / "skills" / "literary-writer").resolve()
    if bundled.is_dir():
        return bundled
    return (ROOT.parent / "skills" / "literary-writer").resolve()


SKILLS_ROOT = _literary_writer_default()
SCRIPTS_DIR = SKILLS_ROOT / "scripts"
WEBNOVEL_PY = SCRIPTS_DIR / "webnovel.py"

# 本地 Skill 扫描目录（可通过 tools.json 扩展）
DEFAULT_SKILL_SCAN_DIRS = [
    ROOT / "skills",
    Path.home() / ".claude" / "skills",
    Path.home() / ".cursor" / "skills",
    Path.home() / ".codex" / "skills",
]

FIND_SKILL_ROOT = Path(
    os.environ.get(
        "FIND_SKILL_ROOT",
        Path.home() / ".claude" / "skills" / "find-skill",
    )
).resolve()
FIND_SKILL_CATALOGUE = FIND_SKILL_ROOT / "cache" / "catalogue.json"
FIND_SKILL_INSTALL_SCRIPT = FIND_SKILL_ROOT / "scripts" / "install-skill.sh"
FIND_SKILL_UPDATE_SCRIPT = FIND_SKILL_ROOT / "update-skills-catalogue.sh"

MCP_CONFIG_CANDIDATES = [
    Path.home() / ".cursor" / "mcp.json",
    ROOT / ".cursor" / "mcp.json",
    Path.home() / ".claude" / "mcp.json",
]

FRONTEND_DIST = ROOT / "frontend" / "dist"

for path in (DATA_DIR, PROJECTS_DIR):
    path.mkdir(parents=True, exist_ok=True)
