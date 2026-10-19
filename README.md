# HarkPro

A static GitHub Pages version of **Emin İsmayılov — Builder & Product Lead**, rebuilt from the Hark page with the same layout, copy, imagery and interactions.

**Live site:** https://emin-dev.github.io/HarkPro/

## What is included

- `index.html` — the complete one-page portfolio, with its CSS, JavaScript and content self-contained except for local fonts and images.
- `assets/fonts/` — self-hosted Geist and Geist Mono (latin + latin-ext subsets), licensed under the SIL Open Font License.
- `assets/img/` — optimized hero photo, social preview and Apple touch icon.
- `favicon.svg` — matching site icon.
- `robots.txt`, `sitemap.xml` — basic search-engine metadata.
- `404.html` — redirects unknown paths back to the portfolio.
- `.nojekyll` — serves the files as-is, without Jekyll processing.

No build step, package manager, framework or server-side code is required.

## Run locally

From the repository root:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000/>.

## Deploy with GitHub Pages

This repository is configured to publish from the `main` branch at the repository root.

For a fresh copy:

1. Push the files to a GitHub repository.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select **main** and **/(root)**, then save.

The site will be available at `https://<user>.github.io/<repository>/`.

All asset paths are relative, so the same files also work from a subdirectory or any static host.

## Design and content

Design and copy are preserved from the original Hark page. Fonts are self-hosted so the page does not depend on Google Fonts at runtime. Geist is © The Geist Project Authors and distributed under the SIL Open Font License; see `assets/fonts/OFL.txt`.
