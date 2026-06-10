import io
import tempfile
import zipfile
from pathlib import Path

from document_convert import extract_zip_to_workspace


def _zip_bytes(entries: dict[str, str]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for name, text in entries.items():
            zf.writestr(name, text)
    return buf.getvalue()


def test_flat_body_dir():
    ws = Path(tempfile.mkdtemp())
    data = _zip_bytes({"\u6b63\u6587/ch1.md": "# one\n"})
    extract_zip_to_workspace(ws, data)
    assert (ws / "\u6b63\u6587" / "ch1.md").is_file()


def test_strip_wrapper_folder():
    ws = Path(tempfile.mkdtemp())
    data = _zip_bytes({"project/\u6b63\u6587/ch1.md": "# one\n"})
    extract_zip_to_workspace(ws, data)
    assert (ws / "\u6b63\u6587" / "ch1.md").is_file()


def test_root_md_hoisted_to_body():
    ws = Path(tempfile.mkdtemp())
    data = _zip_bytes({"ch1.md": "# one\n", "ch2.md": "# two\n"})
    extract_zip_to_workspace(ws, data)
    assert (ws / "\u6b63\u6587" / "ch1.md").is_file()
    assert (ws / "\u6b63\u6587" / "ch2.md").is_file()
