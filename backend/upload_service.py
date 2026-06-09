from __future__ import annotations

from pathlib import Path
from typing import Any

from .document_convert import (
    detect_upload_kind,
    extract_zip_to_workspace,
    import_document_file,
)
from .engine import preflight
from .storage import list_chapters, touch_project, workspace_path


def handle_project_upload(
    project_id: str,
    *,
    filename: str,
    data: bytes,
    target_subdir: str = "正文",
) -> dict[str, Any]:
    workspace = workspace_path(project_id)
    kind = detect_upload_kind(filename)
    converted: list[dict[str, Any]] = []

    if kind == "zip":
        converted = extract_zip_to_workspace(workspace, data)
        result_status = "zip_extracted"
    else:
        record = import_document_file(
            workspace,
            filename=filename,
            data=data,
            subdir=target_subdir,
        )
        converted = [record]
        result_status = "document_imported"

    touch_project(project_id)
    return {
        "status": "ok",
        "upload_type": kind,
        "result": result_status,
        "converted": converted,
        "chapters": list_chapters(project_id),
        "preflight": preflight(workspace),
    }
