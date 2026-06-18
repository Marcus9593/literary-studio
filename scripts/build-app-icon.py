#!/usr/bin/env python3
"""Generate macOS/Windows app icons with Dock-safe padding.

macOS Dock squircle expects artwork ~80–82% of the 1024 canvas; edge-to-edge
icons look one size larger than system apps.
"""
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print('需要 Pillow: pip3 install Pillow', file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
ICONS = ROOT / 'electron' / 'icons'
SOURCE = ICONS / 'icon-source.png'
CANVAS = 1024
# Apple Big Sur icon grid safe area ≈ 824/1024
SAFE_SCALE = 824 / 1024

ICONSET_SIZES = [
    (16, 'icon_16x16.png'),
    (32, 'icon_16x16@2x.png'),
    (32, 'icon_32x32.png'),
    (64, 'icon_32x32@2x.png'),
    (128, 'icon_128x128.png'),
    (256, 'icon_128x128@2x.png'),
    (256, 'icon_256x256.png'),
    (512, 'icon_256x256@2x.png'),
    (512, 'icon_512x512.png'),
    (1024, 'icon_512x512@2x.png'),
]

ICO_SIZES = [16, 32, 48, 64, 128, 256]


def load_source() -> Image.Image:
    if SOURCE.is_file():
        return Image.open(SOURCE).convert('RGBA')
    icns = ICONS / 'icon.icns'
    if not icns.is_file():
        raise SystemExit(f'缺少 {SOURCE} 或 {icns}')
    tmp = ICONS / 'Extract.iconset'
    if tmp.exists():
        shutil.rmtree(tmp)
    subprocess.run(['iconutil', '-c', 'iconset', '-o', str(tmp), str(icns)], check=True)
    img = Image.open(tmp / 'icon_512x512@2x.png').convert('RGBA')
    shutil.rmtree(tmp)
    img.save(SOURCE)
    return img


def with_dock_padding(src: Image.Image) -> Image.Image:
    if src.size != (CANVAS, CANVAS):
        resample = Image.Resampling.LANCZOS if hasattr(Image, 'Resampling') else Image.LANCZOS
        src = src.resize((CANVAS, CANVAS), resample)
    inner = round(CANVAS * SAFE_SCALE)
    resample = Image.Resampling.LANCZOS if hasattr(Image, 'Resampling') else Image.LANCZOS
    scaled = src.resize((inner, inner), resample)
    canvas = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
    offset = (CANVAS - inner) // 2
    canvas.paste(scaled, (offset, offset), scaled)
    return canvas


def write_icns(padded: Image.Image, out: Path) -> None:
    iconset = ICONS / 'AppIcon.iconset'
    if iconset.exists():
        shutil.rmtree(iconset)
    iconset.mkdir()
    master = padded.convert('RGBA')
    resample = Image.Resampling.LANCZOS if hasattr(Image, 'Resampling') else Image.LANCZOS
    for dim, name in ICONSET_SIZES:
        master.resize((dim, dim), resample).save(iconset / name)
    subprocess.run(['iconutil', '-c', 'icns', str(iconset), '-o', str(out)], check=True)
    shutil.rmtree(iconset)


def write_ico(padded: Image.Image, out: Path) -> None:
    resample = Image.Resampling.LANCZOS if hasattr(Image, 'Resampling') else Image.LANCZOS
    images = [padded.resize((s, s), resample) for s in ICO_SIZES]
    images[0].save(
        out,
        format='ICO',
        sizes=[(s, s) for s in ICO_SIZES],
        append_images=images[1:],
    )


def main() -> None:
    padded = with_dock_padding(load_source())
    padded.save(ICONS / 'icon-dock-preview.png')
    if sys.platform == 'darwin':
        write_icns(padded, ICONS / 'icon.icns')
    else:
        print('⏭ 跳过 icon.icns（非 macOS）')
    write_ico(padded, ICONS / 'icon.ico')
    inner = round(CANVAS * SAFE_SCALE)
    print(f'✅ icon.icns / icon.ico 已生成（内容 {inner}×{inner}，安全区 {SAFE_SCALE:.1%}）')


if __name__ == '__main__':
    main()
