from __future__ import annotations

import io
import re
import zipfile
from pathlib import Path
from typing import Any

# 支持上传并转为 Markdown 的扩展名
DOCUMENT_EXTENSIONS = {".md", ".markdown", ".txt", ".docx", ".pdf", ".html", ".htm"}
ARCHIVE_EXTENSIONS = {".zip"}
SUPPORTED_UPLOAD_EXTENSIONS = DOCUMENT_EXTENSIONS | ARCHIVE_EXTENSIONS

# zip 解压后需要扫描并转换的目录（相对项目 workspace）
CONVERT_SCAN_DIRS = ("正文", "大纲", "设定集", "")


def _normalize_markdown(text: str, *, title: str | None = None) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\n{4,}", "\n\n\n", text.strip())
    if title and not text.lstrip().startswith("#"):
        text = f"# {title}\n\n{text}"
    return text + "\n"


def _decode_text(data: bytes) -> str:
    try:
        from charset_normalizer import from_bytes

        match = from_bytes(data).best()
        if match is not None:
            return str(match)
    except ImportError:
        pass
    for enc in ("utf-8", "utf-8-sig", "gb18030", "gbk"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


def _docx_to_markdown(data: bytes) -> str:
    import mammoth

    result = mammoth.convert_to_markdown(io.BytesIO(data))
    md = (result.value or "").strip()
    if not md:
        raise ValueError("Word 文档解析后无有效文本，可能是扫描件或空文档")
    return md


def _clean_pdf_page_text(text: str) -> str:
    """整理 pymupdf 提取的页面文本，保留段落、压缩多余空行。"""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = [ln.rstrip() for ln in text.split("\n")]
    blocks: list[str] = []
    buf: list[str] = []
    for ln in lines:
        if not ln.strip():
            if buf:
                blocks.append("\n".join(buf))
                buf = []
            continue
        buf.append(ln.strip())
    if buf:
        blocks.append("\n".join(buf))
    return "\n\n".join(blocks).strip()


def _pdf_to_markdown(
    data: bytes,
    *,
    title: str | None = None,
    source_path: str | Path | None = None,
) -> tuple[str, int]:
    """
    使用 pymupdf (fitz) 提取 PDF 并转为 Markdown。
    优先 fitz.open(文件路径)，与本地验证脚本一致；否则使用内存流。

    安装: pip3 install pymupdf
    """
    import fitz  # pymupdf  # noqa: F401

    doc = None
    try:
        path = Path(source_path) if source_path else None
        if path and path.is_file():
            doc = fitz.open(str(path))
        else:
            doc = fitz.open(stream=data, filetype="pdf")

        page_count = len(doc)
        parts: list[str] = []
        for i, page in enumerate(doc):
            text = page.get_text() or ""
            block = _clean_pdf_page_text(text)
            if block:
                parts.append(f"## 第 {i + 1} 页\n\n{block}")

        if not parts:
            raise ValueError(
                f"PDF 共 {page_count} 页但未提取到文本，可能是扫描版图片 PDF，需 OCR 后再上传"
            )

        body = "\n\n".join(parts)
        md = _normalize_markdown(body, title=title) if title else _normalize_markdown(body)
        return md, page_count
    finally:
        if doc is not None:
            doc.close()


def _pdf_bytes_via_tempfile(data: bytes, *, title: str | None = None) -> tuple[str, int]:
    """先落盘再 fitz.open(path)，兼容部分复杂 PDF。"""
    import tempfile

    tmp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(data)
            tmp_path = tmp.name
        return _pdf_to_markdown(data, title=title, source_path=tmp_path)
    finally:
        if tmp_path:
            Path(tmp_path).unlink(missing_ok=True)


def _html_to_markdown(data: bytes) -> str:
    from markdownify import markdownify as html_to_md

    html = _decode_text(data)
    return html_to_md(html, heading_style="ATX").strip()


def convert_bytes_to_markdown(
    data: bytes,
    *,
    filename: str,
    title: str | None = None,
) -> tuple[str, str]:
    """
    将文件字节转为 Markdown。
    返回 (markdown正文, 使用的转换器名称)
    """
    ext = Path(filename).suffix.lower()
    stem = Path(filename).stem
    display_title = title or stem

    if ext in (".md", ".markdown"):
        return _normalize_markdown(_decode_text(data), title=display_title), "native_md"

    if ext == ".txt":
        text = _decode_text(data)
        return _normalize_markdown(text, title=display_title), "txt"

    if ext == ".docx":
        md = _docx_to_markdown(data)
        return _normalize_markdown(md, title=display_title), "docx"

    if ext == ".pdf":
        md, pages = _pdf_bytes_via_tempfile(data, title=display_title)
        return md, f"pdf_pymupdf_{pages}p"

    if ext in (".html", ".htm"):
        md = _html_to_markdown(data)
        return _normalize_markdown(md, title=display_title), "html"

    if ext == ".doc":
        raise ValueError("暂不支持旧版 .doc，请用 Word 另存为 .docx 后上传")

    raise ValueError(f"不支持的文件格式: {ext}")


def _fix_upload_filename(name: str) -> str:
    """Fix UTF-8 filenames mis-decoded as latin1 by HTTP upload parsers."""
    if not name:
        return name
    try:
        fixed = name.encode("latin1").decode("utf-8")
        if re.search(r"[\u4e00-\u9fff]", fixed) and "\ufffd" not in fixed:
            if not re.search(r"[\u4e00-\u9fff]", name):
                return fixed
    except (UnicodeDecodeError, UnicodeEncodeError):
        pass
    return name


def safe_md_filename(original: str, *, prefix: str = "导入") -> str:
    original = _fix_upload_filename(original)
    stem = Path(original).stem
    safe = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", stem).strip("._") or "未命名"
    safe = safe[:80]
    return f"{prefix}-{safe}.md"


def save_markdown_to_workspace(
    workspace: Path,
    *,
    md_content: str,
    output_name: str,
    subdir: str = "正文",
) -> Path:
    target_dir = workspace / subdir if subdir else workspace
    target_dir.mkdir(parents=True, exist_ok=True)
    out_path = target_dir / output_name
    if out_path.exists():
        base = out_path.stem
        n = 2
        while out_path.exists():
            out_path = target_dir / f"{base}-{n}.md"
            n += 1
    out_path.write_text(md_content, encoding="utf-8")
    return out_path


def import_document_file(
    workspace: Path,
    *,
    filename: str,
    data: bytes,
    subdir: str = "正文",
) -> dict[str, Any]:
    md, converter = convert_bytes_to_markdown(data, filename=filename)
    out_name = safe_md_filename(filename)
    out_path = save_markdown_to_workspace(
        workspace,
        md_content=md,
        output_name=out_name,
        subdir=subdir,
    )
    result: dict[str, Any] = {
        "source": filename,
        "output": str(out_path.relative_to(workspace)),
        "converter": converter,
        "words": len(md.replace(" ", "").replace("\n", "")),
    }
    if converter.startswith("pdf_pymupdf_") and converter.endswith("p"):
        try:
            result["pages"] = int(converter.replace("pdf_pymupdf_", "").replace("p", ""))
        except ValueError:
            pass
    return result


def _should_convert_path(path: Path) -> bool:
    return path.suffix.lower() in DOCUMENT_EXTENSIONS - {".md", ".markdown"}


def convert_workspace_documents(workspace: Path) -> list[dict[str, Any]]:
    """扫描 workspace 内 docx/pdf 等并就地转为 .md（删除原文件可选）。"""
    converted: list[dict[str, Any]] = []
    for rel_dir in CONVERT_SCAN_DIRS:
        base = workspace / rel_dir if rel_dir else workspace
        if not base.is_dir():
            continue
        for path in sorted(base.rglob("*")):
            if not path.is_file() or not _should_convert_path(path):
                continue
            try:
                data = path.read_bytes()
                record = import_document_file(
                    workspace,
                    filename=path.name,
                    data=data,
                    subdir=str(path.parent.relative_to(workspace)).replace("\\", "/")
                    if path.parent != workspace
                    else "正文",
                )
                path.unlink()
                converted.append(record)
            except Exception as exc:
                converted.append(
                    {
                        "source": str(path.relative_to(workspace)),
                        "error": str(exc),
                    }
                )
    return converted


WORKSPACE_DIRS = frozenset({"正文", "大纲", "设定集", "archive", "试验稿"})


def _zip_member_name(raw: str) -> str:
    return raw.replace("\\", "/").lstrip("./")


def _zip_skip_member(name: str) -> bool:
    return (
        not name
        or name.startswith("__MACOSX")
        or "/." in name
        or name.startswith(".")
    )


def _zip_strip_prefix(names: list[str]) -> str:
    clean = [n for n in names if n and not n.endswith("/")]
    if not clean or not all("/" in n for n in clean):
        return ""
    roots = {n.split("/")[0] for n in clean}
    if len(roots) != 1:
        return ""
    root = next(iter(roots))
    if root in WORKSPACE_DIRS:
        return ""
    return f"{root}/"


def _unique_dest(dest: Path) -> Path:
    if not dest.exists():
        return dest
    n = 2
    while True:
        candidate = dest.with_name(f"{dest.stem}-{n}{dest.suffix}")
        if not candidate.exists():
            return candidate
        n += 1


def _normalize_workspace_layout(workspace: Path) -> None:
    """把常见 zip 包结构整理为 workspace/正文/*.md 等标准布局。"""
    import shutil

    body = workspace / "正文"
    body.mkdir(parents=True, exist_ok=True)

    for md in list(workspace.glob("*.md")):
        shutil.move(str(md), str(_unique_dest(body / md.name)))

    for child in list(workspace.iterdir()):
        if not child.is_dir() or child.name in WORKSPACE_DIRS or child.name.startswith("."):
            continue
        inner_body = child / "正文"
        if inner_body.is_dir():
            for md in inner_body.rglob("*.md"):
                if md.is_file():
                    shutil.move(str(md), str(_unique_dest(body / md.name)))
        for md in child.glob("*.md"):
            if md.is_file():
                shutil.move(str(md), str(_unique_dest(body / md.name)))
        try:
            if child.is_dir() and not any(child.rglob("*")):
                child.rmdir()
        except OSError:
            pass


def extract_zip_to_workspace(workspace: Path, data: bytes) -> list[dict[str, Any]]:
    if workspace.exists():
        import shutil

        shutil.rmtree(workspace)
    workspace.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        members: list[tuple[zipfile.ZipInfo, str]] = []
        for info in zf.infolist():
            if info.is_dir():
                continue
            name = _zip_member_name(info.filename)
            if _zip_skip_member(name):
                continue
            members.append((info, name))

        prefix = _zip_strip_prefix([name for _, name in members])
        for info, name in members:
            rel = name[len(prefix) :] if prefix and name.startswith(prefix) else name
            if not rel or rel.endswith("/"):
                continue
            target = workspace / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(zf.read(info))

    _normalize_workspace_layout(workspace)
    return convert_workspace_documents(workspace)


def detect_upload_kind(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext in ARCHIVE_EXTENSIONS:
        return "zip"
    if ext in DOCUMENT_EXTENSIONS:
        return "document"
    raise ValueError(
        f"不支持的文件类型「{ext}」。支持："
        f"{', '.join(sorted(SUPPORTED_UPLOAD_EXTENSIONS))}"
    )


def supported_formats_payload() -> dict[str, Any]:
    return {
        "documents": sorted(DOCUMENT_EXTENSIONS),
        "archives": sorted(ARCHIVE_EXTENSIONS),
        "hints": {
            "docx": "Word 2007+ 文档，保留标题与段落结构",
            "pdf": "pymupdf (fitz) 按页提取文字并转为 Markdown；扫描版需 OCR",
            "txt": "自动识别 UTF-8 / GBK 编码",
            "zip": "项目包；包内 docx/pdf 会自动转为 md",
        },
    }
