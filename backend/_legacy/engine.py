from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any

import httpx

from .config import SCRIPTS_DIR, SKILLS_ROOT, WEBNOVEL_PY
from .storage import append_job_step, update_job, workspace_path
from .storage import (
    clear_chat_history,
    get_project,
    list_chapters,
    load_chat_history,
    save_chat_history,
)


def _run_webnovel(project_root: Path, *args: str) -> tuple[int, str, str]:
    if not WEBNOVEL_PY.is_file():
        return 1, "", f"未找到 webnovel.py: {WEBNOVEL_PY}"
    env = dict(**{k: v for k, v in __import__("os").environ.items()})
    env["PYTHONPATH"] = str(SCRIPTS_DIR) + (
        f":{env['PYTHONPATH']}" if env.get("PYTHONPATH") else ""
    )
    proc = subprocess.run(
        [sys.executable, str(WEBNOVEL_PY), "--project-root", str(project_root), *args],
        capture_output=True,
        text=True,
        encoding="utf-8",
        cwd=str(SCRIPTS_DIR),
        env=env,
    )
    return proc.returncode, proc.stdout, proc.stderr


def preflight(project_root: Path) -> dict[str, Any]:
    code, out, err = _run_webnovel(project_root, "preflight", "--format", "json")
    if code != 0:
        return {"ok": False, "error": err or out or "preflight 失败"}
    try:
        return {"ok": True, "report": json.loads(out)}
    except json.JSONDecodeError:
        return {"ok": True, "report": {"raw": out}}


def skill_info() -> dict[str, Any]:
    return {
        "skill_root": str(SKILLS_ROOT),
        "scripts_dir": str(SCRIPTS_DIR),
        "webnovel_cli": WEBNOVEL_PY.is_file(),
        "version": "0.1.0",
    }


def _auth_header_variants(api_key: str, protocol: str) -> list[dict[str, str]]:
    """按常见网关习惯依次尝试多种鉴权头（与 CC Switch / Claude SDK 对齐）。"""
    variants: list[dict[str, str]] = []
    if protocol == "anthropic":
        variants.append(
            {
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
            }
        )
    variants.append({"api-key": api_key})
    variants.append({"Authorization": f"Bearer {api_key}"})
    if protocol == "anthropic":
        variants.append({"x-api-key": api_key, "anthropic-version": "2023-06-01", "api-key": api_key})
    # 去重
    seen: set[tuple[tuple[str, str], ...]] = set()
    unique: list[dict[str, str]] = []
    for h in variants:
        key = tuple(sorted(h.items()))
        if key not in seen:
            seen.add(key)
            unique.append(h)
    return unique


def _extract_anthropic_text(data: dict[str, Any]) -> str:
    parts: list[str] = []
    for block in data.get("content") or []:
        if not isinstance(block, dict):
            continue
        if block.get("type") == "text" and block.get("text"):
            parts.append(str(block["text"]))
    if parts:
        return "\n".join(parts)
    # 兼容仅返回 thinking 或旧格式
    for block in data.get("content") or []:
        if isinstance(block, dict) and block.get("text"):
            return str(block["text"])
    return ""


async def _post_with_auth(
    client: httpx.AsyncClient,
    url: str,
    payload: dict[str, Any],
    api_key: str,
    protocol: str,
) -> httpx.Response:
    last_resp: httpx.Response | None = None
    for auth in _auth_header_variants(api_key, protocol):
        headers = {"Content-Type": "application/json", **auth}
        resp = await client.post(url, json=payload, headers=headers)
        if resp.status_code != 401:
            return resp
        last_resp = resp
    assert last_resp is not None
    return last_resp


async def _llm_request(cfg: dict[str, Any], system: str, user: str, *, max_tokens: int = 4096) -> str:
    return await _llm_chat_request(
        cfg,
        system,
        [{"role": "user", "content": user}],
        max_tokens=max_tokens,
    )


async def _llm_chat_request(
    cfg: dict[str, Any],
    system: str,
    messages: list[dict[str, str]],
    *,
    max_tokens: int = 4096,
) -> str:
    api_key = str(cfg.get("api_key") or "").strip()
    if not api_key:
        raise RuntimeError(f"模型「{cfg.get('name', cfg.get('model'))}」未配置 API Key")

    base_url = str(cfg.get("base_url") or "https://api.openai.com/v1").rstrip("/")
    model = str(cfg.get("model") or "gpt-4o-mini")
    protocol = str(cfg.get("protocol") or "")
    if not protocol:
        protocol = "anthropic" if "/anthropic" in base_url.lower() else "openai"

    async with httpx.AsyncClient(timeout=120.0) as client:
        if protocol == "anthropic":
            url = f"{base_url}/v1/messages"
            anthropic_messages = [
                {
                    "role": "assistant" if m["role"] == "assistant" else "user",
                    "content": [{"type": "text", "text": m["content"]}],
                }
                for m in messages
            ]
            payload: dict[str, Any] = {
                "model": model,
                "max_tokens": max_tokens,
                "system": system,
                "messages": anthropic_messages,
                "temperature": 0.85,
            }
            resp = await _post_with_auth(client, url, payload, api_key, protocol)
            if resp.status_code >= 400:
                raise RuntimeError(_format_llm_error(resp))
            data = resp.json()
            text = _extract_anthropic_text(data)
            if text:
                return text
            raise RuntimeError("LLM 返回格式异常")

        url = f"{base_url}/chat/completions"
        payload = {
            "model": model,
            "messages": [{"role": "system", "content": system}, *messages],
            "temperature": 0.85,
            "max_completion_tokens": max_tokens,
        }
        resp = await _post_with_auth(client, url, payload, api_key, protocol)
        if resp.status_code >= 400:
            raise RuntimeError(_format_llm_error(resp))
        data = resp.json()
        return data["choices"][0]["message"]["content"]


def _format_llm_error(resp: httpx.Response) -> str:
    body = resp.text[:500]
    if resp.status_code == 401:
        return (
            f"LLM 鉴权失败 (401)：API Key 无效。"
            f"请确认与 CC Switch / 控制台中填写的密钥一致。响应: {body}"
        )
    if resp.status_code == 402:
        return f"LLM 账户余额不足 (402)。响应: {body}"
    return f"LLM 请求失败 ({resp.status_code}): {body}"


async def llm_complete(system: str, user: str) -> str:
    from .storage import get_active_model

    cfg = get_active_model()
    if not cfg:
        raise RuntimeError("请先在「模型设置」中添加并启用一个模型配置")
    return await _llm_request(cfg, system, user)


def build_project_context(project_id: str) -> dict[str, Any]:
    meta = get_project(project_id)
    root = workspace_path(project_id)
    chapters = list_chapters(project_id)
    outline_excerpt = ""
    outline_path = root / "大纲" / "总纲.md"
    if outline_path.is_file():
        outline_excerpt = outline_path.read_text(encoding="utf-8", errors="replace")[:3000]

    settings_excerpt = ""
    settings_dir = root / "设定集"
    if settings_dir.is_dir():
        parts: list[str] = []
        for path in sorted(settings_dir.glob("*.md"))[:3]:
            parts.append(path.read_text(encoding="utf-8", errors="replace")[:800])
        settings_excerpt = "\n\n".join(parts)[:2000]

    latest_excerpt = ""
    latest_title = ""
    if chapters:
        latest = chapters[-1]
        latest_title = latest["title"]
        latest_path = root / "正文" / latest["filename"]
        if latest_path.is_file():
            text = latest_path.read_text(encoding="utf-8", errors="replace")
            latest_excerpt = text[-3500:] if len(text) > 3500 else text

    next_chapter = len(chapters) + 1
    import re

    for ch in reversed(chapters):
        m = re.search(r"第(\d+)章", ch["title"])
        if m:
            next_chapter = int(m.group(1)) + 1
            break

    return {
        "title": meta.get("title"),
        "genre": meta.get("genre"),
        "chapter_count": len(chapters),
        "next_chapter_suggestion": next_chapter,
        "chapters": [
            {"title": c["title"], "words": c["words"]} for c in chapters[-12:]
        ],
        "latest_chapter_title": latest_title,
        "latest_chapter_excerpt": latest_excerpt,
        "outline_excerpt": outline_excerpt,
        "settings_excerpt": settings_excerpt,
    }


def parse_write_plan(text: str) -> dict[str, Any] | None:
    import re

    m = re.search(r"```write_plan\s*\n(.*?)\n```", text, re.DOTALL | re.IGNORECASE)
    if not m:
        return None
    try:
        data = json.loads(m.group(1).strip())
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict):
        return None
    chapter = data.get("chapter")
    title = str(data.get("title") or "").strip()
    outline = str(data.get("outline") or data.get("goal") or "").strip()
    if not title and not outline:
        return None
    return {
        "chapter": int(chapter) if chapter else None,
        "title": title or "续章",
        "outline": outline,
    }


async def project_chat(project_id: str, message: str) -> dict[str, Any]:
    from .storage import get_active_model

    cfg = get_active_model()
    if not cfg:
        raise RuntimeError("请先在「模型设置」中添加并启用一个模型配置")

    user_message = message.strip()
    if not user_message:
        raise ValueError("消息不能为空")

    history = load_chat_history(project_id)
    context = build_project_context(project_id)
    system_prompt = f"""你是网文创作助手，帮助作者在已有项目上续写、改纲、分析情节与人物。

工作方式：
- 先理解作者意图，结合项目已有正文再回答
- 导入续写场景：先帮作者梳理「写到哪了、人物状态、未回收伏笔」，再讨论下一章方向
- 语气像编辑搭档，简洁有料，避免空泛鼓励
- 不要一次输出完整章节正文；讨论方向、大纲、冲突设计即可
- 当作者明确要动笔、或方向已敲定时，在回复末尾附加写作方案（JSON）：

```write_plan
{{"chapter": 章节号, "title": "章节标题", "outline": "本章目标与情节点"}}
```

项目上下文（JSON）：
{json.dumps(context, ensure_ascii=False, indent=2)}"""

    prior = [{"role": m["role"], "content": m["content"]} for m in history[-16:]]
    prior.append({"role": "user", "content": user_message})

    reply = await _llm_chat_request(cfg, system_prompt, prior, max_tokens=4096)
    write_plan = parse_write_plan(reply)

    ts = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()
    updated = save_chat_history(
        project_id,
        [
            *history,
            {"role": "user", "content": user_message, "at": ts},
            {
                "role": "assistant",
                "content": reply,
                "at": ts,
                "write_plan": write_plan,
            },
        ],
    )
    return {
        "messages": updated,
        "write_plan": write_plan,
        "context_summary": {
            "chapter_count": context.get("chapter_count"),
            "next_chapter_suggestion": context.get("next_chapter_suggestion"),
        },
    }


async def test_model_connection(cfg: dict[str, Any]) -> dict[str, Any]:
    """发送极短请求验证模型配置是否可用。"""
    text = await _llm_request(
        cfg,
        "你是助手。",
        "回复 OK",
        max_tokens=256,
    )
    preview = (text or "").strip()[:80]
    if not preview:
        preview = "（模型已响应，但未返回文本内容）"
    return {"ok": True, "reply_preview": preview}


def _chapter_filename(chapter: int, title: str) -> str:
    safe = "".join(c for c in title if c.isalnum() or c in "._-")[:40] or "未命名"
    return f"第{chapter:04d}章-{safe}.md"


async def run_write_chapter_job(job_id: str, project_id: str, chapter: int, title: str, outline: str) -> None:
    update_job(job_id, status="running")
    root = workspace_path(project_id)

    try:
        append_job_step(job_id, "preflight", "running", "校验 literary-writer 环境")
        pf = preflight(root)
        if not pf.get("ok"):
            raise RuntimeError(pf.get("error", "preflight 失败"))
        append_job_step(job_id, "preflight", "done", "环境就绪")

        append_job_step(job_id, "context", "running", "组装写作任务书（初版简化）")
        outline_path = root / "大纲" / "总纲.md"
        canon_outline = ""
        if outline_path.is_file():
            canon_outline = outline_path.read_text(encoding="utf-8")[:4000]

        prior_md = ""
        body_dir = root / "正文"
        if body_dir.is_dir():
            md_files = sorted(body_dir.glob("*.md"), key=lambda p: p.stat().st_mtime, reverse=True)
            if md_files:
                prior_md = md_files[0].read_text(encoding="utf-8", errors="replace")[:3000]
        task_book = {
            "chapter": chapter,
            "title": title,
            "goal": outline or "推进主线冲突，章末留悬念",
            "canon_excerpt": canon_outline,
            "prior_chapter_excerpt": prior_md,
            "constraints": [
                "中文网文排版，段首缩进两字符",
                "对话用引号，减少 AI 味副词",
                "章末保留未解决问题",
            ],
        }
        append_job_step(job_id, "context", "done", "任务书已生成")

        append_job_step(job_id, "draft", "running", "调用配置的 LLM 起草正文")
        system_prompt = """你是 literary-writer 网文写作引擎的执笔 Agent。
根据写作任务书产出章节纯正文（不要标题行、不要 markdown 代码块、不要解释性前后缀）。
遵守：展示而非告知；对话有潜台词；章末悬念；2000-2800 字左右。"""

        user_prompt = json.dumps(task_book, ensure_ascii=False, indent=2)
        content = await llm_complete(system_prompt, user_prompt)
        append_job_step(job_id, "draft", "done", f"约 {len(content)} 字")

        append_job_step(job_id, "review", "running", "轻量审查（规则检测）")
        issues: list[dict[str, Any]] = []
        banned = ["缓缓", "淡淡", "微微", "眸中闪过", "瞳孔微缩", "他感到"]
        for phrase in banned:
            if phrase in content:
                issues.append(
                    {
                        "severity": "medium",
                        "category": "ai_flavor",
                        "description": f"检测到 AI 味表达：{phrase}",
                        "blocking": False,
                    }
                )
        if "。" * 3 in content:
            issues.append(
                {
                    "severity": "low",
                    "category": "other",
                    "description": "存在过多省略号",
                    "blocking": False,
                }
            )
        append_job_step(
            job_id,
            "review",
            "done",
            f"{len(issues)} 条提示" if issues else "未发现明显问题",
        )

        append_job_step(job_id, "commit", "running", "写入正文目录")
        body_dir = root / "正文"
        body_dir.mkdir(parents=True, exist_ok=True)
        filename = _chapter_filename(chapter, title)
        out_path = body_dir / filename
        out_path.write_text(content.strip() + "\n", encoding="utf-8")

        state_path = root / ".webnovel" / "state.json"
        if state_path.is_file():
            state = json.loads(state_path.read_text(encoding="utf-8"))
            progress = state.setdefault("progress", {})
            progress["current_chapter"] = chapter
            progress["total_words"] = int(progress.get("total_words", 0)) + len(
                content.replace(" ", "").replace("\n", "")
            )
            progress["last_updated"] = __import__(
                "datetime"
            ).datetime.now(__import__("datetime").timezone.utc).isoformat()
            state_path.write_text(
                json.dumps(state, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

        append_job_step(job_id, "commit", "done", filename)
        update_job(
            job_id,
            status="completed",
            result={
                "filename": filename,
                "path": str(out_path),
                "word_count": len(content.replace(" ", "").replace("\n", "")),
                "issues": issues,
            },
        )
    except Exception as exc:
        append_job_step(job_id, "error", "failed", str(exc))
        update_job(job_id, status="failed", error=str(exc))
