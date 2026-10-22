#!/usr/bin/env python3
"""Verify the generated portfolio PDF contains four pages and clickable links."""
from __future__ import annotations

import sys
from pathlib import Path

from pypdf import PdfReader


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    raise SystemExit(1)


def main() -> None:
    pdf_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("portfolio.pdf")
    if not pdf_path.exists():
        fail("portfolio.pdf is missing")
    if pdf_path.stat().st_size < 50_000:
        fail("portfolio.pdf is unexpectedly small")

    reader = PdfReader(str(pdf_path))
    if len(reader.pages) != 4:
        fail(f"expected exactly 4 PDF pages (one per section), found {len(reader.pages)}")

    page_texts = [" ".join((page.extract_text() or "").split()) for page in reader.pages]
    normalized = [text.lower() for text in page_texts]

    markers = {
        0: ["home", "emin", "built in the open", "dot", "accessproof", "locale"],
        1: ["projects", "public work", "dot", "accessproof", "locale", "qwen"],
        2: ["about", "public by default", "113 public repositories", "local-first", "toolbox"],
        3: ["contact", "say hello", "eminpromax@icloud.com", "linkedin", "github"],
    }
    for index, needles in markers.items():
        if len(page_texts[index]) < 120:
            fail(f"page {index + 1}: looks blank or too short ({len(page_texts[index])} chars)")
        for needle in needles:
            if needle not in normalized[index]:
                fail(f"page {index + 1}: missing text marker {needle!r}")

    forbidden = [
        "rent" + "butik",
        "ad" + "board",
        "ai" + "hub",
        "crowd" + "funding",
        "mecha" + "tronics",
        "scrum " + "master",
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

    if internal < 12:
        fail(f"expected clickable internal page links on every page, found {internal}")
    if external < 8:
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
        "linkedin.com/in/",
        "mailto:eminpromax@icloud.com",
    ]
    joined_uris = " ".join(external_uris)
    for needle in required_external:
        if needle not in joined_uris:
            fail(f"missing clickable external link {needle!r}")

    print(
        f"PASS: portfolio.pdf — {len(reader.pages)} pages, "
        f"{internal} internal link annotations, {external} external link annotations"
    )


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as error:  # noqa: BLE001 - CI verifier should fail loudly
        print(f"FAIL: {error}")
        sys.exit(1)
