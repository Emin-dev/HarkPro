#!/usr/bin/env python3
"""Verify the generated portfolio PDF: 3 designed pages, readable text, no overflow."""
from __future__ import annotations

import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

from pypdf import PdfReader

# A4 content box: 16 mm side/top margins, 15 mm bottom margin.
MM = 72 / 25.4
LEFT = 16 * MM
RIGHT = 16 * MM
TOP = 16 * MM
BOTTOM = 15 * MM
TOLERANCE = 1.0 * MM
MIN_FONT_PT = 9.0


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    raise SystemExit(1)


def font_sizes(page) -> list[tuple[float, str]]:
    sizes: list[tuple[float, str]] = []

    def visit(text, cm, tm, font_dict, font_size):
        value = text.strip()
        if value:
            sizes.append((float(font_size), value[:40]))

    page.extract_text(visitor_text=visit)
    return sizes


def bbox_overflow(pdf_path: Path) -> list[str]:
    try:
        result = subprocess.run(
            ["pdftotext", "-bbox-layout", str(pdf_path), "-"],
            check=True,
            capture_output=True,
            text=True,
            timeout=60,
        )
    except FileNotFoundError:
        return ["pdftotext is not installed, cannot check text overflow"]
    except subprocess.CalledProcessError as error:
        return [f"pdftotext failed: {error.stderr.strip()}"]

    problems: list[str] = []
    root = ET.fromstring(result.stdout)
    for index, page in enumerate(
        (node for node in root.iter() if node.tag.rsplit("}", 1)[-1] == "page"), start=1
    ):
        width = float(page.get("width", "0"))
        height = float(page.get("height", "0"))
        for word in (node for node in page.iter() if node.tag.rsplit("}", 1)[-1] == "word"):
            text = (word.text or "").strip()
            if not text:
                continue
            x_min = float(word.get("xMin", "0"))
            x_max = float(word.get("xMax", "0"))
            y_min = float(word.get("yMin", "0"))
            y_max = float(word.get("yMax", "0"))
            if (
                x_min < LEFT - TOLERANCE
                or x_max > width - RIGHT + TOLERANCE
                or y_min < TOP - TOLERANCE
                or y_max > height - BOTTOM + TOLERANCE
            ):
                problems.append(
                    f"page {index}: text {text!r} is outside the safe area "
                    f"({x_min:.1f},{y_min:.1f})-({x_max:.1f},{y_max:.1f})"
                )
    return problems


def embedded_fonts(pdf_path: Path) -> list[str]:
    try:
        result = subprocess.run(
            ["pdffonts", str(pdf_path)],
            check=True,
            capture_output=True,
            text=True,
            timeout=60,
        )
    except FileNotFoundError:
        return ["pdffonts is not installed, cannot check embedded fonts"]
    except subprocess.CalledProcessError as error:
        return [f"pdffonts failed: {error.stderr.strip()}"]

    problems: list[str] = []
    for line in result.stdout.splitlines()[2:]:
        if not line.strip():
            continue
        parts = line.split()
        if len(parts) < 5:
            continue
        embedded = parts[-5]
        if embedded.lower() != "yes":
            problems.append(f"font is not embedded: {parts[0]}")
    return problems


def main() -> None:
    pdf_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("portfolio.pdf")
    if not pdf_path.exists():
        fail("portfolio.pdf is missing")
    if pdf_path.stat().st_size < 50_000:
        fail("portfolio.pdf is unexpectedly small")

    reader = PdfReader(str(pdf_path))
    if len(reader.pages) != 3:
        fail(f"expected exactly 3 PDF pages (one per section), found {len(reader.pages)}")

    page_texts = [" ".join((page.extract_text() or "").split()) for page in reader.pages]
    normalized = [text.lower() for text in page_texts]

    markers = {
        0: ["emin", "built in the open", "dot", "accessproof", "locale", "at a glance"],
        1: ["public work", "dot", "accessproof", "locale", "qwen", "shipped"],
        2: ["about", "public by default", "113 public repositories", "local-first", "toolbox"],
    }
    for index, needles in markers.items():
        if len(page_texts[index]) < 120:
            fail(f"page {index + 1}: looks blank or too short ({len(page_texts[index])} chars)")
        if not page_texts[index].startswith("Emin İsmayılov"):
            fail(f"page {index + 1}: does not start with the name-only header")
        for needle in needles:
            if needle not in normalized[index]:
                fail(f"page {index + 1}: missing text marker {needle!r}")

    for index, page in enumerate(reader.pages, start=1):
        sizes = font_sizes(page)
        if not sizes:
            fail(f"page {index}: no selectable text found")
        smallest, sample = min(sizes)
        if smallest < MIN_FONT_PT - 0.1:
            fail(f"page {index}: {smallest:.1f}pt text is below {MIN_FONT_PT}pt ({sample!r})")

    for problem in bbox_overflow(pdf_path):
        fail(problem)
    for problem in embedded_fonts(pdf_path):
        fail(problem)

    forbidden = [
        "rent" + "butik",
        "ad" + "board",
        "ai" + "hub",
        "crowd" + "funding",
        "mecha" + "tronics",
        "scrum " + "master",
        "eminpromax",
        "linkedin",
        "mailto:",
        "tel:",
        "vercel",
        "contact",
        "m5 pro",
        "48 gb",
        "download pdf",
    ]
    joined = " ".join(normalized)
    for needle in forbidden:
        if needle in joined:
            fail(f"contains removed private content {needle!r}")

    internal = 0
    external = 0
    destinations: set[str] = set()
    external_uris: set[str] = set()

    for page in reader.pages:
        for annot_ref in page.get("/Annots") or []:
            annot = annot_ref.get_object()
            if annot.get("/Subtype") != "/Link":
                continue
            dest = annot.get("/Dest")
            action = annot.get("/A")
            if dest is not None:
                internal += 1
                destinations.add(str(dest))
            elif action is not None and action.get("/URI"):
                external += 1
                external_uris.add(str(action["/URI"]))

    if internal < 3:
        fail(f"expected clickable internal page links, found {internal}")
    if external < 6:
        fail(f"expected clickable external links, found {external}")

    known = set(reader.named_destinations.keys())
    for dest in destinations:
        if dest not in known:
            fail(f"internal link points to unknown anchor {dest!r}")

    required_external = [
        "github.com/Emin-dev",
        "github.com/Emin-dev/Dot",
        "github.com/Emin-dev/accessproof",
        "github.com/Emin-dev/locale",
        "emin-dev.github.io/accessproof",
    ]
    joined_uris = " ".join(external_uris)
    for needle in required_external:
        if needle not in joined_uris:
            fail(f"missing clickable external link {needle!r}")

    for needle in ("linkedin", "mailto:", "tel:", "vercel", "eminpromax"):
        if needle in joined_uris.lower():
            fail(f"contains forbidden PDF link {needle!r}")

    smallest = min(
        (min(size for size, _ in font_sizes(page)) for page in reader.pages),
        default=0,
    )
    print(
        f"PASS: portfolio.pdf — {len(reader.pages)} pages, min font {smallest:.1f}pt, "
        f"{internal} internal links, {external} external links, fonts embedded, no overflow"
    )


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as error:  # noqa: BLE001 - CI verifier should fail loudly
        print(f"FAIL: {error}")
        sys.exit(1)
