# How to edit the portfolio

The site is plain HTML, CSS and one small JavaScript file. There is no build step for the website itself.

## Change text or projects

| What | File |
| --- | --- |
| Home hero and project tiles | `index.html` |
| Projects and venture details | `projects.html` |
| Experience, ventures, education, certifications | `about.html` |
| Email, LinkedIn, GitHub | `contact.html` |
| Shared colors, type, bento layout, dark mode | `assets/css/site.css` |
| Theme toggle, reveal motion | `assets/js/site.js` |

Each project tile uses a short heading, one or two sentences, a status tag and a link. Keep claims factual and do not add invented metrics. Ideas are labelled `Concept` or `Idea`; shipped work uses `Shipped` or `Live`.

## Keep the PDF buttons to two

There must be exactly two links with the text **Download PDF**:

1. Top of `index.html`, in the hero actions.
2. Bottom of `contact.html`, in the `.pdf-cta` block.

Do not add a third one. The PDF is regenerated from all four pages by CI, so it always follows the site.

## PDF

```bash
npm install
npx playwright install chromium
python3 -m pip install pypdf
npm run build
```

This writes `portfolio.pdf` and verifies it. The build combines the four pages, converts internal links to PDF anchors, keeps external links clickable and forces the light print theme.

## Before pushing

```bash
npm run build
```

The checks fail on missing pages, missing PDF links, console errors, broken internal links or horizontal overflow on mobile. Push to `main`; the workflow rebuilds the PDF, commits it and waits for GitHub Pages.
