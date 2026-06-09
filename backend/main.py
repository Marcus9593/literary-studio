from __future__ import annotations

import asyncio
import shutil
from pathlib import Path
from typing import Any, Optional

from fastapi import BackgroundTasks, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .config import FRONTEND_DIST
from .document_convert import supported_formats_payload
from .engine import (
    build_project_context,
    preflight,
    project_chat,
    run_write_chapter_job,
    skill_info,
    test_model_connection,
)
from .tools_service import (
    get_tools_overview,
    install_skill,
    list_mcp_configs,
    save_mcp_config,
    scan_installed_skills,
    search_catalogue,
    set_literary_writer_root,
    update_catalogue,
)
from .storage import (
    create_job,
    create_model,
    create_project,
    clear_chat_history,
    delete_model,
    delete_project,
    get_active_model,
    get_model_by_id,
    get_job,
    get_project,
    list_chapters,
    load_chat_history,
    list_models_public,
    list_projects,
    read_cc_switch_config,
    save_settings,
    set_active_model,
    touch_project,
    update_model,
    workspace_path,
)
from .upload_service import handle_project_upload

app = FastAPI(title="文匠 Studio", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SettingsUpdate(BaseModel):
    provider: str = "openai_compatible"
    base_url: str = "https://api.openai.com/v1"
    model: str = "gpt-4o-mini"
    api_key: str = ""


class ModelCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    protocol: str = "openai"
    base_url: str = Field(min_length=1)
    model: str = Field(min_length=1, max_length=120)
    api_key: str = Field(min_length=1)


class ModelUpdate(BaseModel):
    name: Optional[str] = None
    protocol: Optional[str] = None
    base_url: Optional[str] = None
    model: Optional[str] = None
    api_key: Optional[str] = None


class ModelTestRequest(BaseModel):
    protocol: str = "openai"
    base_url: str = Field(min_length=1)
    model: str = Field(min_length=1, max_length=120)
    api_key: Optional[str] = None
    model_id: Optional[str] = None


class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    genre: str = "玄幻"


class WriteChapterRequest(BaseModel):
    chapter: int = Field(ge=1, le=9999)
    title: str = "开篇"
    outline: str = ""


class ChatMessageRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)


class SkillInstallRequest(BaseModel):
    source: str = Field(min_length=1)
    target: str = "claude"
    force: bool = False


class LiteraryWriterRootRequest(BaseModel):
    path: str = Field(min_length=1)


class McpSaveRequest(BaseModel):
    path: str = Field(min_length=1)
    content: dict[str, Any]


@app.get("/api/health")
def health() -> dict[str, Any]:
    info = skill_info()
    return {"status": "ok", "literary_writer": info}


@app.get("/api/settings")
def get_settings() -> dict[str, Any]:
    return list_models_public()


@app.put("/api/settings")
def put_settings(body: SettingsUpdate) -> dict[str, Any]:
    try:
        return save_settings(body.model_dump())
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.get("/api/models")
def api_list_models() -> dict[str, Any]:
    return list_models_public()


@app.post("/api/models")
def api_create_model(body: ModelCreate) -> dict[str, Any]:
    try:
        return create_model(body.model_dump())
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.put("/api/models/{model_id}")
def api_update_model(model_id: str, body: ModelUpdate) -> dict[str, Any]:
    try:
        return update_model(model_id, body.model_dump(exclude_unset=True))
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.delete("/api/models/{model_id}")
def api_delete_model(model_id: str) -> dict[str, Any]:
    try:
        return delete_model(model_id)
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc


@app.post("/api/models/{model_id}/activate")
def api_activate_model(model_id: str) -> dict[str, Any]:
    try:
        return set_active_model(model_id)
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc


@app.get("/api/models/import/cc-switch")
def api_import_cc_switch() -> dict[str, Any]:
    try:
        cfg = read_cc_switch_config()
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    key = cfg["api_key"]
    return {
        "name": cfg["name"],
        "protocol": cfg["protocol"],
        "base_url": cfg["base_url"],
        "model": cfg["model"],
        "api_key": key,
        "api_key_preview": f"{key[:4]}…{key[-4:]}" if len(key) > 8 else "",
        "source": cfg["source"],
    }


@app.post("/api/models/test")
async def api_test_model_config(body: ModelTestRequest) -> dict[str, Any]:
    cfg = {
        "protocol": body.protocol,
        "base_url": body.base_url.strip(),
        "model": body.model.strip(),
        "api_key": str(body.api_key or "").strip(),
        "name": body.model,
    }
    if not cfg["api_key"] and body.model_id:
        try:
            saved = get_model_by_id(body.model_id)
            cfg["api_key"] = str(saved.get("api_key") or "").strip()
        except FileNotFoundError as exc:
            raise HTTPException(404, str(exc)) from exc
    if not cfg["api_key"]:
        raise HTTPException(400, "请填写 API Key")
    try:
        return await test_model_connection(cfg)
    except RuntimeError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.post("/api/models/{model_id}/test")
async def api_test_model(model_id: str) -> dict[str, Any]:
    try:
        cfg = get_model_by_id(model_id)
        return await test_model_connection(cfg)
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.get("/api/projects")
def api_list_projects() -> list[dict[str, Any]]:
    return list_projects()


@app.post("/api/projects")
def api_create_project(body: ProjectCreate) -> dict[str, Any]:
    return create_project(body.title.strip(), body.genre.strip())


@app.get("/api/projects/{project_id}")
def api_get_project(project_id: str) -> dict[str, Any]:
    try:
        meta = get_project(project_id)
        meta["chapters"] = list_chapters(project_id)
        meta["preflight"] = preflight(workspace_path(project_id))
        return meta
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc


@app.delete("/api/projects/{project_id}")
def api_delete_project(project_id: str) -> dict[str, str]:
    try:
        delete_project(project_id)
        return {"status": "deleted"}
    except Exception as exc:
        raise HTTPException(500, str(exc)) from exc


@app.get("/api/projects/{project_id}/chapters")
def api_chapters(project_id: str) -> list[dict[str, Any]]:
    try:
        return list_chapters(project_id)
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc


@app.get("/api/projects/{project_id}/chat")
def api_get_chat(project_id: str) -> dict[str, Any]:
    try:
        get_project(project_id)
        messages = load_chat_history(project_id)
        context = build_project_context(project_id)
        return {
            "messages": messages,
            "context_summary": {
                "chapter_count": context.get("chapter_count"),
                "next_chapter_suggestion": context.get("next_chapter_suggestion"),
                "latest_chapter_title": context.get("latest_chapter_title"),
            },
        }
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc


@app.post("/api/projects/{project_id}/chat")
async def api_post_chat(project_id: str, body: ChatMessageRequest) -> dict[str, Any]:
    try:
        get_project(project_id)
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc

    active = get_active_model()
    if not active or not str(active.get("api_key") or "").strip():
        raise HTTPException(400, "请先在「模型设置」中添加模型配置并填写 API Key")

    try:
        return await project_chat(project_id, body.message)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.delete("/api/projects/{project_id}/chat")
def api_clear_chat(project_id: str) -> dict[str, str]:
    try:
        get_project(project_id)
        clear_chat_history(project_id)
        return {"status": "cleared"}
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc


@app.get("/api/projects/{project_id}/chapters/{filename}")
def api_chapter_content(project_id: str, filename: str) -> dict[str, str]:
    root = workspace_path(project_id)
    path = root / "正文" / Path(filename).name
    if not path.is_file():
        raise HTTPException(404, "章节不存在")
    return {"filename": path.name, "content": path.read_text(encoding="utf-8")}


@app.get("/api/upload/formats")
def api_upload_formats() -> dict[str, Any]:
    return supported_formats_payload()


@app.post("/api/projects/{project_id}/upload")
async def api_upload_project(
    project_id: str,
    file: UploadFile = File(...),
    subdir: str = Query(
        "正文",
        description="单文件导入目标目录：正文 / 大纲 / 设定集",
    ),
) -> dict[str, Any]:
    try:
        get_project(project_id)
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc

    if not file.filename:
        raise HTTPException(400, "缺少文件名")

    if subdir not in ("正文", "大纲", "设定集"):
        raise HTTPException(400, "subdir 须为：正文、大纲、设定集")

    data = await file.read()
    if not data:
        raise HTTPException(400, "文件为空")

    try:
        return handle_project_upload(
            project_id,
            filename=file.filename,
            data=data,
            target_subdir=subdir,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(500, f"上传处理失败: {exc}") from exc


@app.get("/api/projects/{project_id}/download")
def api_download_project(project_id: str) -> FileResponse:
    try:
        workspace = workspace_path(project_id)
        meta = get_project(project_id)
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc

    archive_base = project_dir(project_id) / "export"
    archive_base.mkdir(parents=True, exist_ok=True)
    zip_path = archive_base / f"{meta['title']}.zip"
    if zip_path.is_file():
        zip_path.unlink()

    shutil.make_archive(str(zip_path.with_suffix("")), "zip", workspace)
    return FileResponse(
        path=str(zip_path),
        filename=zip_path.name,
        media_type="application/zip",
    )


@app.post("/api/projects/{project_id}/write")
async def api_write_chapter(
    project_id: str,
    body: WriteChapterRequest,
    background_tasks: BackgroundTasks,
) -> dict[str, Any]:
    try:
        get_project(project_id)
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc

    active = get_active_model()
    if not active or not str(active.get("api_key") or "").strip():
        raise HTTPException(
            400,
            "请先在「模型设置」中添加模型配置并填写 API Key",
        )

    job = create_job(
        project_id,
        "write_chapter",
        body.model_dump(),
    )

    def _runner() -> None:
        asyncio.run(
            run_write_chapter_job(
                job["id"],
                project_id,
                body.chapter,
                body.title,
                body.outline,
            )
        )
        touch_project(project_id)

    background_tasks.add_task(_runner)
    return {"job_id": job["id"], "status": "queued"}


@app.get("/api/jobs/{job_id}")
def api_get_job(job_id: str) -> dict[str, Any]:
    try:
        return get_job(job_id)
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc


@app.get("/api/tools/overview")
def api_tools_overview() -> dict[str, Any]:
    return get_tools_overview()


@app.get("/api/tools/skills")
def api_tools_skills() -> list[dict[str, Any]]:
    return scan_installed_skills()


@app.get("/api/tools/skills/search")
def api_tools_skills_search(
    q: str = "",
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    agent: str = "any",
) -> dict[str, Any]:
    return search_catalogue(q, limit=limit, page=page, agent=agent)


@app.post("/api/tools/skills/install")
def api_tools_skills_install(body: SkillInstallRequest) -> dict[str, Any]:
    try:
        return install_skill(body.source, target=body.target, force=body.force)
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.post("/api/tools/skills/catalogue/update")
def api_tools_catalogue_update() -> dict[str, Any]:
    try:
        return update_catalogue()
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(400, str(exc)) from exc


@app.put("/api/tools/literary-writer")
def api_tools_literary_writer(body: LiteraryWriterRootRequest) -> dict[str, Any]:
    try:
        return set_literary_writer_root(body.path)
    except FileNotFoundError as exc:
        raise HTTPException(404, str(exc)) from exc


@app.get("/api/tools/mcp")
def api_tools_mcp() -> dict[str, Any]:
    return list_mcp_configs()


@app.put("/api/tools/mcp")
def api_tools_mcp_save(body: McpSaveRequest) -> dict[str, Any]:
    try:
        return save_mcp_config(body.path, body.content)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


# SPA static files
if FRONTEND_DIST.is_dir() and (FRONTEND_DIST / "index.html").is_file():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str) -> FileResponse:
        if full_path.startswith("api/"):
            raise HTTPException(404)
        candidate = FRONTEND_DIST / full_path
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST / "index.html")
