#!/usr/bin/env python3
"""生成 favicon：满幅圆角色块 + 大号「文」，标签栏视觉重量对齐 GitHub / 小米等满幅图标。"""
from __future__ import annotations

from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError as exc:
    raise SystemExit("需要 Pillow：pip install Pillow") from exc

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public"

# 色块铺满画布（与小米等一致）；字按画布比例放大，小尺寸光学补偿
PAD_RATIO = 0
RADIUS_RATIO = 11 / 44
GLYPH_CANVAS_RATIO = 0.68
ACCENT = (139, 58, 26)
ACCENT_END = (192, 78, 36)
WHITE = (255, 255, 255)

# 优先较粗的黑体，16px 下笔画更清晰
FONT_CANDIDATES = [
    "/System/Library/Fonts/STHeiti Medium.ttc",
    "/System/Library/Fonts/PingFang.ttc",
    "/System/Library/Fonts/Supplemental/Songti.ttc",
    "/Library/Fonts/Arial Unicode.ttf",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc",
]


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in FONT_CANDIDATES:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def rounded_rect_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def render_icon(canvas: int) -> Image.Image:
    pad = round(canvas * PAD_RATIO)
    inner = canvas - pad * 2
    radius = max(2, round(inner * RADIUS_RATIO))
    font_size = max(9, round(canvas * GLYPH_CANVAS_RATIO))

    img = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    px = Image.new("RGBA", (inner, inner), (0, 0, 0, 0))

    for y in range(inner):
        for x in range(inner):
            t = (x + y) / max(1, 2 * (inner - 1))
            r = int(ACCENT[0] + (ACCENT_END[0] - ACCENT[0]) * t)
            g = int(ACCENT[1] + (ACCENT_END[1] - ACCENT[1]) * t)
            b = int(ACCENT[2] + (ACCENT_END[2] - ACCENT[2]) * t)
            px.putpixel((x, y), (r, g, b, 255))

    mask = rounded_rect_mask(inner, radius)
    tile = Image.composite(px, Image.new("RGBA", (inner, inner), (0, 0, 0, 0)), mask)

    draw = ImageDraw.Draw(tile)
    font = load_font(font_size)
    text = "文"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx = (inner - tw) / 2 - bbox[0]
    ty = (inner - th) / 2 - bbox[1]
    stroke = 1 if canvas <= 24 else 0
    draw.text(
        (tx, ty),
        text,
        fill=WHITE,
        font=font,
        stroke_width=stroke,
        stroke_fill=WHITE,
    )

    img.paste(tile, (pad, pad), tile)
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    sizes = {
        "favicon-16.png": 16,
        "favicon-32.png": 32,
        "favicon-48.png": 48,
        "apple-touch-icon.png": 180,
    }
    icons: list[Image.Image] = []
    for name, size in sizes.items():
        icon = render_icon(size)
        icon.save(OUT / name, format="PNG", optimize=True)
        print(f"wrote {name} ({size}px)")
        if size in (16, 32, 48):
            icons.append(icon)

    icons[0].save(
        OUT / "favicon.ico",
        format="ICO",
        sizes=[(i.width, i.height) for i in icons],
        append_images=icons[1:],
    )
    print("wrote favicon.ico")


if __name__ == "__main__":
    main()
