# How to edit the portfolio

The site is plain HTML, CSS and one small JavaScript file. There is no build step
for the website itself, but content must stay within public GitHub sources.

## Change text or projects

| What | File |
| --- | --- |
| Home hero and three project tiles | `index.html` |
| Project details | `projects.html` |
| Public-repository facts and tool stack | `about.html` |
| Email, LinkedIn, GitHub | `contact.html` |
| Shared colors, type, bento layout, dark mode | `assets/css/site.css` |
| Theme toggle, reveal motion | `assets/js/site.js` |
| Claim-by-claim source list | `docs/CONTENT-SOURCES.md` |

Only Dot, AccessProof and Locale belong on the projects page. Do not add private
ventures, employers, unreleased ideas or claims that are not on Emin's public
GitHub. Contact is email, GitHub and LinkedIn only.

## Keep the PDF buttons to two

There must be exactly two links with the text **Download PDF**:

1. Top of `index.html`, in the hero actions.
2. Bottom of `contact.html`, in the `.pdf-cta` block.

The PDF is regenerated from all four site pages by CI, so it stays in sync.

## Build and QA

```bash
npm install
npx playwright install chromium
python3 -m pip install pypdf pillow
npm run build
npm run qa
```

`npm run build` writes `portfolio.pdf` (installing the bundled Geist TTFs so the
PDF uses the same fonts as the site), verifies it has exactly four pages and
clickable links, then checks the site in light/dark at desktop and mobile widths.
`npm run qa` writes screenshots to `docs/qa/` and runs the qwen3.8-max vision
review. Fix every reported issue and run it again.

## Before pushing

```bash
npm run build
npm run qa
```

Commit the regenerated `portfolio.pdf`, `assets/img/preview.jpg` and `docs/qa/`
files with the source changes. Push to `main`; the workflow rebuilds, verifies,
and waits for GitHub Pages.
