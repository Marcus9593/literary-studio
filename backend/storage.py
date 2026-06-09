from __future__ import annotations

import json
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from .config import JOBS_PATH, PROJECTS_DIR, SETTINGS_PATH


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _default_settings() -> dict[str, Any]:
    return {"active_id": "", "models": []}


def _mask_key(key: str) -> str:
    key = str(key or "")
    if len(key) > 8:
        return f"{key[:4]}…{key[-4:]}"
    return ""


def _infer_protocol(base_url: str) -> str:
    url = base_url.lower()
    if "/anthropic" in url:
        return "anthropic"
    return "openai"


def get_model_by_id(model_id: str) -> dict[str, Any]:
    data = load_settings_raw()
    for m in data.get("models") or []:
        if m.get("id") == model_id:
            return m
    raise FileNotFoundError(f"模型配置不存在: {model_id}")


def _model_public(entry: dict[str, Any]) -> dict[str, Any]:
    key = str(entry.get("api_key") or "")
    base_url = str(entry.get("base_url") or "")
    return {
        "id": entry["id"],
        "name": entry.get("name") or entry.get("model") or "未命名",
        "protocol": entry.get("protocol") or _infer_protocol(base_url),
        "base_url": base_url,
        "model": entry.get("model", ""),
        "api_key_set": bool(key.strip()),
        "api_key_preview": _mask_key(key),
        "created_at": entry.get("created_at"),
        "updated_at": entry.get("updated_at"),
    }


def _migrate_legacy(raw: dict[str, Any]) -> dict[str, Any]:
    """将旧版单模型 settings.json 迁移为 models 列表。"""
    if raw.get("models"):
        return raw
    base_url = str(raw.get("base_url") or "").strip()
    model = str(raw.get("model") or "").strip()
    api_key = str(raw.get("api_key") or "").strip()
    if not base_url and not model and not api_key:
        return _default_settings()
    model_id = uuid.uuid4().hex[:12]
    ts = _now()
    entry = {
        "id": model_id,
        "name": model or "默认模型",
        "protocol": _infer_protocol(base_url or "https://api.openai.com/v1"),
        "base_url": base_url or "https://api.openai.com/v1",
        "model": model or "gpt-4o-mini",
        "api_key": api_key,
        "created_at": ts,
        "updated_at": ts,
    }
    return {"active_id": model_id, "models": [entry]}


def load_settings_raw() -> dict[str, Any]:
    if not SETTINGS_PATH.is_file():
        return _default_settings()
    raw = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
    migrated = _migrate_legacy(raw)
    if migrated != raw:
        _persist_raw(migrated)
    return migrated


def _persist_raw(data: dict[str, Any]) -> None:
    SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    SETTINGS_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def load_settings() -> dict[str, Any]:
    """兼容旧代码：返回当前启用模型的扁平配置。"""
    active = get_active_model()
    if not active:
        return {
            "provider": "openai_compatible",
            "base_url": "https://api.openai.com/v1",
            "model": "gpt-4o-mini",
            "api_key": "",
        }
    return {
        "provider": active.get("protocol", "openai"),
        "base_url": active.get("base_url", ""),
        "model": active.get("model", ""),
        "api_key": active.get("api_key", ""),
        "name": active.get("name", ""),
        "id": active.get("id", ""),
    }


def get_active_model() -> dict[str, Any] | None:
    data = load_settings_raw()
    active_id = str(data.get("active_id") or "")
    models: list[dict[str, Any]] = data.get("models") or []
    if not models:
        return None
    for m in models:
        if m.get("id") == active_id:
            return m
    return models[0]


def list_models_public() -> dict[str, Any]:
    data = load_settings_raw()
    models = [_model_public(m) for m in data.get("models") or []]
    active_id = str(data.get("active_id") or "")
    if models and not any(m["id"] == active_id for m in models):
        active_id = models[0]["id"]
    return {"active_id": active_id, "models": models}


def create_model(payload: dict[str, Any]) -> dict[str, Any]:
    data = load_settings_raw()
    model_id = uuid.uuid4().hex[:12]
    ts = _now()
    base_url = str(payload.get("base_url") or "").strip()
    entry = {
        "id": model_id,
        "name": str(payload.get("name") or payload.get("model") or "新模型").strip(),
        "protocol": str(payload.get("protocol") or _infer_protocol(base_url)).strip(),
        "base_url": base_url,
        "model": str(payload.get("model") or "").strip(),
        "api_key": str(payload.get("api_key") or "").strip(),
        "created_at": ts,
        "updated_at": ts,
    }
    if not entry["base_url"]:
        raise ValueError("Base URL 不能为空")
    if not entry["model"]:
        raise ValueError("模型名称不能为空")
    if not entry["api_key"]:
        raise ValueError("API Key 不能为空")

    models: list[dict[str, Any]] = list(data.get("models") or [])
    models.append(entry)
    active_id = str(data.get("active_id") or "") or model_id
    _persist_raw({"active_id": active_id, "models": models})
    return _model_public(entry)


def update_model(model_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    data = load_settings_raw()
    models: list[dict[str, Any]] = list(data.get("models") or [])
    idx = next((i for i, m in enumerate(models) if m.get("id") == model_id), None)
    if idx is None:
        raise FileNotFoundError(f"模型配置不存在: {model_id}")

    entry = dict(models[idx])
    if "name" in payload and payload["name"] is not None:
        entry["name"] = str(payload["name"]).strip() or entry.get("name", "")
    if "protocol" in payload and payload["protocol"]:
        entry["protocol"] = str(payload["protocol"]).strip()
    if "base_url" in payload and payload["base_url"] is not None:
        base_url = str(payload["base_url"]).strip()
        if base_url:
            entry["base_url"] = base_url
    if "model" in payload and payload["model"] is not None:
        model_name = str(payload["model"]).strip()
        if model_name:
            entry["model"] = model_name
    if "api_key" in payload and str(payload.get("api_key") or "").strip():
        entry["api_key"] = str(payload["api_key"]).strip()
    entry["updated_at"] = _now()
    models[idx] = entry
    _persist_raw({"active_id": data.get("active_id", ""), "models": models})
    return _model_public(entry)


def delete_model(model_id: str) -> dict[str, str]:
    data = load_settings_raw()
    models: list[dict[str, Any]] = list(data.get("models") or [])
    remaining = [m for m in models if m.get("id") != model_id]
    if len(remaining) == len(models):
        raise FileNotFoundError(f"模型配置不存在: {model_id}")

    active_id = str(data.get("active_id") or "")
    if active_id == model_id:
        active_id = remaining[0]["id"] if remaining else ""
    _persist_raw({"active_id": active_id, "models": remaining})
    return {"status": "deleted", "active_id": active_id}


def set_active_model(model_id: str) -> dict[str, Any]:
    data = load_settings_raw()
    models: list[dict[str, Any]] = list(data.get("models") or [])
    if not any(m.get("id") == model_id for m in models):
        raise FileNotFoundError(f"模型配置不存在: {model_id}")
    _persist_raw({"active_id": model_id, "models": models})
    return list_models_public()


# ── 兼容旧 API ──

def save_settings(payload: dict[str, Any]) -> dict[str, Any]:
    active = get_active_model()
    if active:
        update_payload = {
            k: payload[k]
            for k in ("base_url", "model", "api_key")
            if k in payload
        }
        if payload.get("provider"):
            update_payload["protocol"] = payload["provider"]
        return update_model(active["id"], update_payload)
    return create_model(
        {
            "name": payload.get("model", "默认模型"),
            "protocol": payload.get("provider", "openai"),
            "base_url": payload.get("base_url", ""),
            "model": payload.get("model", ""),
            "api_key": payload.get("api_key", ""),
        }
    )


def settings_public(raw: dict[str, Any] | None = None) -> dict[str, Any]:
    return list_models_public()


# ── 项目 / 任务（保持不变）──

def list_projects() -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    if not PROJECTS_DIR.is_dir():
        return items
    for meta_path in sorted(PROJECTS_DIR.glob("*/meta.json")):
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        items.append(meta)
    items.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
    return items


def project_dir(project_id: str) -> Path:
    return PROJECTS_DIR / project_id


def get_project(project_id: str) -> dict[str, Any]:
    meta_path = project_dir(project_id) / "meta.json"
    if not meta_path.is_file():
        raise FileNotFoundError(f"项目不存在: {project_id}")
    return json.loads(meta_path.read_text(encoding="utf-8"))


def save_project_meta(meta: dict[str, Any]) -> None:
    root = project_dir(meta["id"])
    root.mkdir(parents=True, exist_ok=True)
    (root / "meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def create_project(title: str, genre: str = "玄幻") -> dict[str, Any]:
    project_id = uuid.uuid4().hex[:12]
    root = project_dir(project_id)
    root.mkdir(parents=True, exist_ok=True)
    workspace = root / "workspace"
    for sub in ("正文", "大纲", "设定集", ".webnovel"):
        (workspace / sub).mkdir(parents=True, exist_ok=True)

    state = {
        "project_info": {
            "title": title,
            "genre": genre,
            "target_words": 0,
            "target_chapters": 0,
        },
        "progress": {
            "current_chapter": 0,
            "total_words": 0,
            "last_updated": _now(),
            "volumes_completed": [],
            "current_volume": 1,
            "volumes_planned": [],
        },
        "protagonist_state": {
            "name": "",
            "power": {"realm": "", "layer": 0, "bottleneck": ""},
            "location": {"current": "", "last_chapter": 0},
            "golden_finger": {"name": "", "level": 0, "cooldown": 0},
        },
        "relationships": {},
        "world_settings": {"power_system": [], "factions": [], "locations": []},
        "review_checkpoints": [],
        "strand_tracker": {
            "last_quest_chapter": 0,
            "last_fire_chapter": 0,
            "last_constellation_chapter": 0,
            "current_dominant": "quest",
            "chapters_since_switch": 0,
            "history": [],
        },
        "plot_threads": {"active_threads": [], "foreshadowing": []},
        "disambiguation_warnings": [],
        "disambiguation_pending": [],
        "chapter_meta": {},
    }
    (workspace / ".webnovel" / "state.json").write_text(
        json.dumps(state, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (workspace / "大纲" / "总纲.md").write_text(
        f"# {title}\n\n## 一句话概述\n\n待补充\n",
        encoding="utf-8",
    )

    meta = {
        "id": project_id,
        "title": title,
        "genre": genre,
        "created_at": _now(),
        "updated_at": _now(),
        "workspace": str(workspace),
    }
    save_project_meta(meta)
    return meta


def touch_project(project_id: str) -> None:
    meta = get_project(project_id)
    meta["updated_at"] = _now()
    save_project_meta(meta)


def workspace_path(project_id: str) -> Path:
    meta = get_project(project_id)
    return Path(meta["workspace"])


def list_chapters(project_id: str) -> list[dict[str, Any]]:
    body_dir = workspace_path(project_id) / "正文"
    if not body_dir.is_dir():
        return []
    chapters: list[dict[str, Any]] = []
    for path in sorted(body_dir.glob("*.md")):
        text = path.read_text(encoding="utf-8", errors="replace")
        chapters.append(
            {
                "filename": path.name,
                "title": path.stem,
                "words": len(text.replace(" ", "").replace("\n", "")),
                "preview": text[:200],
            }
        )
    return chapters


def _chat_path(project_id: str) -> Path:
    return workspace_path(project_id) / ".webnovel" / "chat.json"


def load_chat_history(project_id: str) -> list[dict[str, Any]]:
    path = _chat_path(project_id)
    if not path.is_file():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        messages = data.get("messages") or []
        return [m for m in messages if m.get("role") in ("user", "assistant") and m.get("content")]
    except (OSError, json.JSONDecodeError):
        return []


def save_chat_history(project_id: str, messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    path = _chat_path(project_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    trimmed = messages[-40:]
    path.write_text(
        json.dumps({"messages": trimmed}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return trimmed


def clear_chat_history(project_id: str) -> None:
    path = _chat_path(project_id)
    if path.is_file():
        path.unlink()


def load_jobs() -> dict[str, Any]:
    if not JOBS_PATH.is_file():
        return {}
    return json.loads(JOBS_PATH.read_text(encoding="utf-8"))


def save_jobs(jobs: dict[str, Any]) -> None:
    JOBS_PATH.write_text(json.dumps(jobs, ensure_ascii=False, indent=2), encoding="utf-8")


def get_job(job_id: str) -> dict[str, Any]:
    jobs = load_jobs()
    if job_id not in jobs:
        raise FileNotFoundError(job_id)
    return jobs[job_id]


def create_job(project_id: str, job_type: str, params: dict[str, Any]) -> dict[str, Any]:
    job_id = uuid.uuid4().hex[:16]
    job = {
        "id": job_id,
        "project_id": project_id,
        "type": job_type,
        "params": params,
        "status": "queued",
        "steps": [],
        "result": None,
        "error": None,
        "created_at": _now(),
        "updated_at": _now(),
    }
    jobs = load_jobs()
    jobs[job_id] = job
    save_jobs(jobs)
    return job


def update_job(job_id: str, **fields: Any) -> dict[str, Any]:
    jobs = load_jobs()
    job = jobs[job_id]
    job.update(fields)
    job["updated_at"] = _now()
    jobs[job_id] = job
    save_jobs(jobs)
    return job


def append_job_step(job_id: str, step: str, status: str, detail: str = "") -> None:
    job = get_job(job_id)
    job["steps"].append(
        {"step": step, "status": status, "detail": detail, "at": _now()}
    )
    update_job(job_id, steps=job["steps"])


def delete_project(project_id: str) -> None:
    shutil.rmtree(project_dir(project_id), ignore_errors=True)


def read_cc_switch_config() -> dict[str, Any]:
    """读取 CC Switch 写入的 ~/.claude/settings.json 中的当前模型配置。"""
    path = Path.home() / ".claude" / "settings.json"
    if not path.is_file():
        raise FileNotFoundError("未找到 ~/.claude/settings.json，请先在 CC Switch 中配置并启用提供商")
    raw = json.loads(path.read_text(encoding="utf-8"))
    env = raw.get("env") or {}
    base = str(
        env.get("ANTHROPIC_BASE_URL") or env.get("OPENAI_BASE_URL") or ""
    ).strip()
    key = str(
        env.get("ANTHROPIC_AUTH_TOKEN") or env.get("OPENAI_API_KEY") or ""
    ).strip()
    model = str(
        env.get("ANTHROPIC_MODEL") or env.get("OPENAI_MODEL") or "gpt-4o-mini"
    ).strip()
    if not base:
        raise ValueError("CC Switch 配置中未找到 ANTHROPIC_BASE_URL / OPENAI_BASE_URL")
    if not key:
        raise ValueError("CC Switch 配置中未找到 ANTHROPIC_AUTH_TOKEN / OPENAI_API_KEY")
    protocol = (
        "anthropic"
        if env.get("ANTHROPIC_AUTH_TOKEN") or "/anthropic" in base.lower()
        else "openai"
    )
    return {
        "name": "CC Switch 当前",
        "protocol": protocol,
        "base_url": base,
        "model": model,
        "api_key": key,
        "source": "cc-switch",
    }
