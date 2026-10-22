#!/usr/bin/env python3
"""Create a side-by-side desktop-site / PDF-page comparison image."""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def load(path: Path, width: int) -> Image.Image:
    image = Image.open(path).convert("RGB")
    height = max(1, round(image.height * width / image.width))
    return image.resize((width, height), Image.Resampling.LANCZOS)


def label_font() -> ImageFont.ImageFont:
    for candidate in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ):
        try:
            return ImageFont.truetype(candidate, 24)
        except OSError:
            continue
    return ImageFont.load_default()


def main() -> None:
    if len(sys.argv) != 5:
        raise SystemExit("usage: compare-pages.py SITE_PNG PDF_PNG OUTPUT_PNG LABEL")
    site_path, pdf_path, out_path = (Path(value) for value in sys.argv[1:4])
    label = sys.argv[4]

    width = 620
    site = load(site_path, width)
    pdf = load(pdf_path, width)
    gap = 28
    bar = 52
    height = bar + max(site.height, pdf.height) + 24

    canvas = Image.new("RGB", (width * 2 + gap, height), "#ffffff")
    draw = ImageDraw.Draw(canvas)
    font = label_font()
    draw.text((16, 14), f"Website · {label}", fill="#1d1d1f", font=font)
    draw.text((width + gap + 16, 14), f"PDF · {label}", fill="#1d1d1f", font=font)
    canvas.paste(site, (0, bar))
    canvas.paste(pdf, (width + gap, bar))
    draw.rectangle(
        [width + gap // 2, bar, width + gap // 2 + 1, height - 24],
        fill="#e5e5ea",
    )
    canvas.save(out_path, optimize=True)


if __name__ == "__main__":
    main()
