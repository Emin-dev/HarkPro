# HarkPro

Investor-facing portfolio for **Emin İsmayılov**, founder and builder in Baku.

**Live site:** https://emin-dev.github.io/HarkPro/

## Pages

- `index.html` — Home: one-line intro, six project tiles, at-a-glance facts.
- `projects.html` — Dot, Studio games, Rust/WASM tools, Adboard, AIHub, crowdfunding, more open source.
- `about.html` — experience, ventures, education, certifications and languages.
- `contact.html` — email, LinkedIn and GitHub.
- `portfolio.pdf` — generated copy of all four pages with clickable links.

## Design

Static HTML, CSS and a small vanilla-JS file. No framework and no runtime dependencies. Self-hosted Geist fonts, light/dark themes, responsive bento layout, generated CSS/SVG visuals, reduced-motion support and a skip link. Exactly two "Download PDF" controls: top of Home and bottom of Contact.

## Run locally

```bash
python3 -m http.server 8000
```

Open <http://localhost:8000/>.

## Build and verify

```bash
npm install
npx playwright install chromium
python3 -m pip install pypdf
npm run build
```

`npm run build` creates `portfolio.pdf` with headless Chromium, checks that all four page markers and clickable internal/external links are present, then checks the four HTML pages for console errors, broken internal links and mobile overflow.

The GitHub Actions workflow runs the same checks on every push, commits the regenerated `portfolio.pdf`, waits for the GitHub Pages build and verifies the live pages and PDF.

## Deploy

GitHub Pages publishes from the `main` branch at the repository root (`.nojekyll` disables Jekyll). Push to `main`; the workflow builds the PDF and the Pages build publishes the site.

## Edit

See [docs/HOW-TO-EDIT.md](docs/HOW-TO-EDIT.md). Content lives directly in the four HTML files; shared styling is in `assets/css/site.css` and behavior in `assets/js/site.js`.
