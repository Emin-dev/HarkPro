# HarkPro

Public portfolio for **Emin İsmayılov**, published with GitHub Pages.

**Live site:** https://emin-dev.github.io/HarkPro/

The site only uses information from Emin's public GitHub account, public
repositories and their READMEs. Every substantive claim is mapped to a public
source in [docs/CONTENT-SOURCES.md](docs/CONTENT-SOURCES.md). The only external
links are `github.com/Emin-dev/*` and `emin-dev.github.io` pages.

## Pages

- `index.html` — Home: intro, three selected public projects, public facts.
- `projects.html` — Dot, AccessProof and Locale only.
- `about.html` — public repositories, how the projects are built, tool stack.
- `portfolio.pdf` — generated three-page copy of the site with clickable links.

## Design

Static HTML, CSS and a small vanilla-JS file. No framework and no runtime
dependencies. Self-hosted Geist fonts, light/dark themes, responsive bento
layout, generated CSS/SVG visuals, reduced-motion support and a skip link.
Exactly two "Download PDF" controls: top of Home and bottom of About.

## Run locally

```bash
python3 -m http.server 8000
```

Open <http://localhost:8000/>.

## Build and verify

```bash
npm install
npx playwright install chromium
python3 -m pip install pypdf pillow
npm run build
```

`npm run build` installs the bundled static Geist TTFs into
`~/.fonts/harkpro-portfolio`, creates `portfolio.pdf` with headless Chromium,
checks that all three section pages exist with clickable internal and external
links, then checks the HTML pages in light and dark themes at 1440 px and 390 px
for console errors, broken links, missing anchors and horizontal overflow. It
also rejects private or out-of-scope content, contact details, and any external
link that is not part of Emin-dev's GitHub or GitHub Pages.

## Visual QA

```bash
npm run qa
```

`qa:render` writes every site page at 1440 and 390 px in light and dark mode,
renders all three PDF pages to PNG under `docs/qa/`, refreshes
`assets/img/preview.jpg`, and records a manifest. `qa:vision` needs the OpenCode
CLI (`npm install -g opencode-ai@1.19.3`) and Pillow. It sends the images to
`opencode-go/qwen3.8-max` (falling back to `qwen3.8-flash`) and fails on any
reported overlap, clipping, blank page, broken image or contrast problem. If no
vision model is available, it writes the PNGs and prints `VISION-QA-NEEDED`.

## Deploy

GitHub Pages publishes from the `main` branch at the repository root
(`.nojekyll` disables Jekyll). Push to `main`; the workflow builds and verifies
the PDF, runs visual QA, commits the generated PDF and QA images, waits for the
Pages build and verifies the live pages and PDF.
