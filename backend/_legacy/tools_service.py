from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from .config import (
    DEFAULT_SKILL_SCAN_DIRS,
    FIND_SKILL_CATALOGUE,
    FIND_SKILL_INSTALL_SCRIPT,
    FIND_SKILL_ROOT,
    FIND_SKILL_UPDATE_SCRIPT,
    MCP_CONFIG_CANDIDATES,
    SKILLS_ROOT,
    TOOLS_CONFIG_PATH,
    WEBNOVEL_PY,
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_tools_config() -> dict[str, Any]:
    if not TOOLS_CONFIG_PATH.is_file():
        return {"skill_scan_dirs": [], "extra_paths": {}}
    return json.loads(TOOLS_CONFIG_PATH.read_text(encoding="utf-8"))


def _save_tools_config(data: dict[str, Any]) -> dict[str, Any]:
    TOOLS_CONFIG_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return data


def get_tools_overview() -> dict[str, Any]:
    cfg = _load_tools_config()
    installed = scan_installed_skills()
    catalogue = catalogue_meta()
    mcp = list_mcp_configs()
    return {
        "literary_writer": {
            "path": str(SKILLS_ROOT),
            "webnovel_cli": WEBNOVEL_PY.is_file(),
            "exists": SKILLS_ROOT.is_dir(),
        },
        "find_skill": {
            "path": str(FIND_SKILL_ROOT),
            "catalogue_available": FIND_SKILL_CATALOGUE.is_file(),
            "install_script": FIND_SKILL_INSTALL_SCRIPT.is_file(),
            **catalogue,
        },
        "installed_skills_count": len(installed),
        "mcp_servers_count": sum(len(m.get("servers") or []) for m in mcp.get("files") or []),
        "skill_scan_dirs": get_skill_scan_dirs(),
        "config": cfg,
    }


def get_skill_scan_dirs() -> list[str]:
    cfg = _load_tools_config()
    extra = [Path(p).expanduser() for p in cfg.get("skill_scan_dirs") or []]
    dirs: list[Path] = []
    seen: set[str] = set()
    for p in [*DEFAULT_SKILL_SCAN_DIRS, *extra]:
        try:
            resolved = p.resolve()
        except OSError:
            continue
        key = str(resolved)
        if key not in seen and resolved.is_dir():
            seen.add(key)
            dirs.append(resolved)
    return [str(d) for d in dirs]


def _parse_frontmatter(text: str) -> dict[str, str]:
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end < 0:
        return {}
    block = text[3:end].strip()
    meta: dict[str, str] = {}
    for line in block.splitlines():
        if ":" not in line:
            continue
        key, _, val = line.partition(":")
        meta[key.strip()] = val.strip().strip('"').strip("'")
    return meta


def _skill_entry(skill_md: Path, root: Path) -> dict[str, Any]:
    rel = skill_md.parent.relative_to(root)
    text = skill_md.read_text(encoding="utf-8", errors="replace")
    meta = _parse_frontmatter(text)
    name = meta.get("name") or skill_md.parent.name
    sub_skills: list[str] = []
    skills_dir = skill_md.parent / "skills"
    if skills_dir.is_dir():
        for sub in sorted(skills_dir.glob("*/SKILL.md")):
            sub_skills.append(sub.parent.name)
    return {
        "id": str(rel).replace("/", "__"),
        "name": name,
        "folder": str(skill_md.parent),
        "relative_path": str(rel),
        "description": (meta.get("description") or "")[:280],
        "has_scripts": (skill_md.parent / "scripts").is_dir(),
        "sub_skills": sub_skills,
        "is_literary_writer": "literary-writer" in skill_md.parent.name,
    }


def scan_installed_skills() -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    seen_folders: set[str] = set()
    for scan_root in get_skill_scan_dirs():
        root = Path(scan_root)
        for skill_md in sorted(root.glob("**/SKILL.md")):
            folder = str(skill_md.parent.resolve())
            if folder in seen_folders:
                continue
            # 跳过 find-skill 子目录里的缓存等
            if "/cache/" in str(skill_md):
                continue
            seen_folders.add(folder)
            try:
                items.append(_skill_entry(skill_md, root))
            except (OSError, ValueError):
                continue
    items.sort(key=lambda x: (not x.get("is_literary_writer"), x.get("name", "")))
    return items


def catalogue_meta() -> dict[str, Any]:
    if not FIND_SKILL_CATALOGUE.is_file():
        return {"total": 0, "updated_at": None, "stale": True}
    data = json.loads(FIND_SKILL_CATALOGUE.read_text(encoding="utf-8"))
    updated = data.get("updated_at")
    stale = True
    if updated:
        try:
            dt = datetime.fromisoformat(str(updated).replace("Z", "+00:00"))
            age_days = (datetime.now(timezone.utc) - dt).days
            stale = age_days > 30
        except ValueError:
            pass
    return {
        "total": data.get("total", len(data.get("skills") or [])),
        "updated_at": updated,
        "stale": stale,
        "sources": data.get("sources") or {},
    }


def _clean_catalogue_name(raw: str) -> str:
    """[docx](url) -> docx"""
    m = re.match(r"\[([^\]]+)\]", raw or "")
    return m.group(1) if m else (raw or "").strip()


def search_catalogue(
    query: str = "",
    *,
    limit: int = 20,
    page: int = 1,
    agent: str = "any",
) -> dict[str, Any]:
    if not FIND_SKILL_CATALOGUE.is_file():
        return {
            "items": [],
            "total": 0,
            "page": page,
            "limit": limit,
            "query": query,
            "message": "未找到 find-skill 目录，请先安装 find-skill 技能",
        }
    data = json.loads(FIND_SKILL_CATALOGUE.read_text(encoding="utf-8"))
    skills: list[dict[str, Any]] = data.get("skills") or []
    q = query.strip().lower()
    filtered: list[dict[str, Any]] = []
    for s in skills:
        agents = s.get("agents") or []
        if agent != "any" and agent not in agents:
            continue
        name = _clean_catalogue_name(str(s.get("name") or ""))
        desc = str(s.get("description") or "")
        repo = str(s.get("repo") or "")
        hay = f"{name} {desc} {repo} {' '.join(s.get('tags') or [])}".lower()
        if q and q not in hay:
            continue
        filtered.append(
            {
                "name": name,
                "raw_name": s.get("name"),
                "description": desc[:240],
                "repo": repo,
                "repo_url": s.get("repo_url"),
                "install_url": s.get("install_url"),
                "stars": s.get("stars"),
                "agents": agents,
                "source": s.get("source"),
                "category": s.get("category"),
                "install_ref": repo or name,
            }
        )
    filtered.sort(
        key=lambda x: int(str(x.get("stars") or "0").replace(",", "") or 0),
        reverse=True,
    )
    total = len(filtered)
    start = max(0, (page - 1) * limit)
    end = start + limit
    return {
        "items": filtered[start:end],
        "total": total,
        "page": page,
        "limit": limit,
        "query": query,
        "meta": catalogue_meta(),
    }


def install_skill(
    source: str,
    *,
    target: str = "claude",
    force: bool = False,
) -> dict[str, Any]:
    if not FIND_SKILL_INSTALL_SCRIPT.is_file():
        raise FileNotFoundError(f"未找到安装脚本: {FIND_SKILL_INSTALL_SCRIPT}")
    src = source.strip()
    if not src:
        raise ValueError("请提供 skill 名称或 GitHub 地址")
    cmd = [
        "bash",
        str(FIND_SKILL_INSTALL_SCRIPT),
        src,
        "--target",
        target,
    ]
    if force:
        cmd.append("--force")
    proc = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=300,
    )
    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "安装失败").strip()
        raise RuntimeError(err[:800])
    return {
        "ok": True,
        "source": src,
        "target": target,
        "output": (proc.stdout or "")[-2000:],
    }


def update_catalogue() -> dict[str, Any]:
    if not FIND_SKILL_UPDATE_SCRIPT.is_file():
        raise FileNotFoundError(f"未找到更新脚本: {FIND_SKILL_UPDATE_SCRIPT}")
    proc = subprocess.run(
        ["bash", str(FIND_SKILL_UPDATE_SCRIPT)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=600,
    )
    if proc.returncode != 0:
        raise RuntimeError((proc.stderr or proc.stdout or "更新失败")[:800])
    return {"ok": True, "meta": catalogue_meta(), "output": (proc.stdout or "")[-1500:]}


MCP_TEMPLATE = """{
  "mcpServers": {
    "example-server": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed"],
      "env": {}
    }
  }
}
"""


def list_mcp_configs() -> dict[str, Any]:
    files: list[dict[str, Any]] = []
    for path in MCP_CONFIG_CANDIDATES:
        entry: dict[str, Any] = {
            "path": str(path),
            "exists": path.is_file(),
            "servers": [],
            "error": None,
        }
        if path.is_file():
            try:
                raw = json.loads(path.read_text(encoding="utf-8"))
                servers = raw.get("mcpServers") or raw.get("servers") or {}
                if isinstance(servers, dict):
                    for name, cfg in servers.items():
                        if not isinstance(cfg, dict):
                            continue
                        entry["servers"].append(
                            {
                                "name": name,
                                "command": cfg.get("command"),
                                "url": cfg.get("url"),
                                "args": cfg.get("args"),
                                "env_keys": list((cfg.get("env") or {}).keys()),
                            }
                        )
            except (OSError, json.JSONDecodeError) as exc:
                entry["error"] = str(exc)
        files.append(entry)
    primary = next((f for f in files if f["exists"]), files[0] if files else None)
    return {
        "files": files,
        "primary_path": primary["path"] if primary else str(MCP_CONFIG_CANDIDATES[0]),
        "template": MCP_TEMPLATE,
    }


def save_mcp_config(path: str, content: dict[str, Any]) -> dict[str, Any]:
    target = Path(path).expanduser().resolve()
    if target.name != "mcp.json":
        raise ValueError("仅允许写入 mcp.json 配置文件")
    allowed_parents = {p.parent.resolve() for p in MCP_CONFIG_CANDIDATES}
    if target.parent not in allowed_parents and target.parent != Path.home() / ".cursor":
        raise ValueError("不允许写入该路径")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(content, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {"ok": True, "path": str(target)}


def set_literary_writer_root(path: str) -> dict[str, Any]:
    import os
    import backend.config as config_mod

    p = Path(path).expanduser().resolve()
    if not p.is_dir():
        raise FileNotFoundError(f"目录不存在: {p}")
    cfg = _load_tools_config()
    cfg["literary_writer_root"] = str(p)
    _save_tools_config(cfg)
    os.environ["LITERARY_WRITER_ROOT"] = str(p)
    config_mod.SKILLS_ROOT = p
    config_mod.SCRIPTS_DIR = p / "scripts"
    config_mod.WEBNOVEL_PY = config_mod.SCRIPTS_DIR / "webnovel.py"
    return {
        "path": str(p),
        "webnovel_cli": config_mod.WEBNOVEL_PY.is_file(),
    }
