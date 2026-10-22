#!/usr/bin/env python3
"""Downscale a QA screenshot for vision review."""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image


def main() -> None:
    if len(sys.argv) != 4:
        raise SystemExit("usage: vision-prep.py SOURCE DEST WIDTH")
    source, dest, width = Path(sys.argv[1]), Path(sys.argv[2]), int(sys.argv[3])
    image = Image.open(source).convert("RGB")
    if image.width > width:
        height = max(1, round(image.height * width / image.width))
        image = image.resize((width, height), Image.Resampling.LANCZOS)
    image.save(dest, optimize=True)


if __name__ == "__main__":
    main()
