#!/usr/bin/env python3
"""CLI for Markdown → docx export — invoked by the Node backend."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from document_export import (  # noqa: E402
    is_docx_export_available,
    markdown_to_docx_bytes,
)


def main() -> int:
    parser = argparse.ArgumentParser(description="Export Markdown to Word")
    parser.add_argument(
        "--mode",
        choices=["md_to_docx", "check"],
        default="md_to_docx",
    )
    parser.add_argument("--md-file", help="Source markdown file path")
    parser.add_argument("--output", help="Output .docx path")
    parser.add_argument("--title", default="", help="Optional document title")
    args = parser.parse_args()

    if args.mode == "check":
        print(json.dumps({"available": is_docx_export_available()}, ensure_ascii=False))
        return 0

    if not args.md_file or not args.output:
        print(json.dumps({"error": "需要 --md-file 与 --output"}), file=sys.stderr)
        return 1

    md_path = Path(args.md_file)
    out_path = Path(args.output)
    if not md_path.is_file():
        print(json.dumps({"error": f"Markdown 文件不存在: {md_path}"}), file=sys.stderr)
        return 1

    try:
        md = md_path.read_text(encoding="utf-8")
        data = markdown_to_docx_bytes(md, title=args.title or None)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_bytes(data)
        print(json.dumps({"status": "ok", "output": str(out_path)}, ensure_ascii=False))
        return 0
    except Exception as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
