#!/usr/bin/env python3
"""CLI for document conversion — invoked by the Node backend."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from document_convert import (  # noqa: E402
    detect_upload_kind,
    extract_zip_to_workspace,
    import_document_file,
    supported_formats_payload,
)


def main() -> int:
    parser = argparse.ArgumentParser(description="Convert uploaded documents to Markdown")
    parser.add_argument("--workspace", help="Project workspace directory")
    parser.add_argument("--filename", help="Original filename")
    parser.add_argument("--subdir", default="正文", help="Target subdirectory")
    parser.add_argument("--data-file", help="Path to uploaded binary file")
    parser.add_argument("--formats-only", action="store_true", help="Print supported formats JSON")
    args = parser.parse_args()

    if args.formats_only:
        print(json.dumps(supported_formats_payload(), ensure_ascii=False))
        return 0

    if not args.workspace or not args.filename or not args.data_file:
        print(json.dumps({"error": "需要 --workspace、--filename、--data-file"}), file=sys.stderr)
        return 1

    workspace = Path(args.workspace)
    data_path = Path(args.data_file)
    if not data_path.is_file():
        print(json.dumps({"error": f"数据文件不存在: {data_path}"}), file=sys.stderr)
        return 1

    data = data_path.read_bytes()
    filename = args.filename

    try:
        kind = detect_upload_kind(filename)
    except ValueError as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        return 1

    try:
        if kind == "zip":
            converted = extract_zip_to_workspace(workspace, data)
            payload = {
                "status": "ok",
                "upload_type": "zip",
                "result": "extracted",
                "converted": converted,
            }
        else:
            record = import_document_file(
                workspace,
                filename=filename,
                data=data,
                subdir=args.subdir,
            )
            payload = {
                "status": "ok",
                "upload_type": "document",
                "result": "converted",
                "converted": [record],
            }
        print(json.dumps(payload, ensure_ascii=False))
        return 0
    except Exception as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
