#!/usr/bin/env python3
"""Verify the generated portfolio PDF contains every page and clickable links."""
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
    if len(reader.pages) < 4:
        fail(f"expected at least 4 PDF pages, found {len(reader.pages)}")

    text = "\n".join((page.extract_text() or "") for page in reader.pages)
    normalized = " ".join(text.split()).lower()

    markers = {
        "home": ["emin", "builder", "the things i build"],
        "projects": ["projects & ventures", "dot", "rust + webassembly", "adboard", "aihub"],
        "about": ["about & experience", "rentbutik", "mechatronics", "scrum master"],
        "contact": ["contact", "eminpromax@icloud.com", "linkedin", "github"],
    }
    for page_name, needles in markers.items():
        for needle in needles:
            if needle.lower() not in normalized:
                fail(f"{page_name}: missing text marker {needle!r}")

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

    if internal < 4:
        fail(f"expected clickable internal links, found {internal}")
    if external < 5:
        fail(f"expected clickable external links, found {external}")

    known = set(reader.named_destinations.keys())
    for dest in destinations:
        if dest not in known:
            fail(f"internal link points to unknown anchor {dest!r}")

    required_external = [
        "github.com/Emin-dev",
        "github.com/Emin-dev/Dot",
        "linkedin.com/in/",
        "mailto:eminpromax@icloud.com",
    ]
    joined = " ".join(external_uris)
    for needle in required_external:
        if needle not in joined:
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
