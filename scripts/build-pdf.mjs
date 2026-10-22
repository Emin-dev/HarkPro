import { chromium } from "playwright";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.cwd());
const pages = [
  { file: "index.html", key: "home" },
  { file: "projects.html", key: "projects" },
  { file: "about.html", key: "about" }
];

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".pdf": "application/pdf"
};

const logo = '<svg viewBox="0 0 36 36" aria-hidden="true"><rect width="36" height="36" rx="9" fill="#161f39"/><path fill="#f5f5f7" d="M25.096 30c-.072 0-.12-.048-.168-.12-4.776-6.384-12.216-10.8-20.736-11.688C4.048 18.168 4 18.096 4 18s.048-.168.192-.192c8.52-.888 15.96-5.304 20.736-11.688.048-.072.096-.12.168-.12s.096.024.168.072A15.02 15.02 0 0 1 31.12 18a15.02 15.02 0 0 1-5.856 11.928c-.072.048-.096.072-.168.072"/></svg>';

function startServer() {
  return new Promise((resolveServer) => {
    const server = createServer(async (request, response) => {
      try {
        const url = new URL(request.url || "/", "http://127.0.0.1");
        let pathname = decodeURIComponent(url.pathname);
        if (pathname === "/") pathname = "/index.html";
        const file = normalize(join(root, pathname));
        if (!file.startsWith(root)) throw new Error("outside root");
        const body = await readFile(file);
        response.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" });
        response.end(body);
      } catch {
        response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        response.end("not found");
      }
    });
    server.listen(0, "127.0.0.1", () => resolveServer(server));
  });
}

function mainOf(html, file) {
  const match = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (!match) throw new Error(`No <main> found in ${file}`);
  return match[1];
}

function rewriteLinks(html) {
  return html.replace(/\bhref="([^"]+)"/g, (full, href) => {
    if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return full;
    if (href.startsWith("http://") || href.startsWith("https://")) return full;

    const [pathPart, hashPart] = href.split("#");
    const target = hashPart ? `#${hashPart}` : null;
    if (pathPart === "" || pathPart === "./" || pathPart === "index.html" || pathPart === "./index.html" || pathPart === "/HarkPro/" || pathPart === "/HarkPro/index.html") {
      return `href="${target || "#home"}"`;
    }
    if (pathPart === "projects.html" || pathPart === "./projects.html") return `href="${target || "#projects"}"`;
    if (pathPart === "about.html" || pathPart === "./about.html") return `href="${target || "#about"}"`;
    if (pathPart === "portfolio.pdf") return 'href="https://emin-dev.github.io/HarkPro/portfolio.pdf"';
    return full;
  });
}

async function audit(page) {
  return page.evaluate(() => {
    const minPt = 9;
    const minPx = minPt * (96 / 72) - 0.6;
    const violations = [];
    const docs = Array.from(document.querySelectorAll(".pdf-doc"));

    for (const doc of docs) {
      const id = doc.id || "page";
      if (doc.scrollHeight > doc.clientHeight + 1) {
        violations.push(`${id}: content is ${doc.scrollHeight - doc.clientHeight}px taller than the A4 page`);
      }
      if (doc.scrollWidth > doc.clientWidth + 1) {
        violations.push(`${id}: content is ${doc.scrollWidth - doc.clientWidth}px wider than the A4 page`);
      }

      const docRect = doc.getBoundingClientRect();
      for (const element of doc.querySelectorAll("body *")) {
        const style = getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") continue;
        const rect = element.getBoundingClientRect();
        if (!rect.width && !rect.height) continue;

        const hasText = Array.from(element.childNodes).some(
          (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0
        );
        if (hasText) {
          const px = parseFloat(style.fontSize);
          if (px < minPx) {
            const label = element.textContent.replace(/\s+/g, " ").trim().slice(0, 40);
            violations.push(`${id}: ${px.toFixed(1)}px text (minimum ${minPt}pt): "${label}"`);
          }
          if (element.scrollWidth > element.clientWidth + 1 && style.overflow !== "visible") {
            violations.push(`${id}: clipped text in "${element.textContent.replace(/\s+/g, " ").trim().slice(0, 40)}"`);
          }
        }

        if (rect.right > docRect.right + 1 || rect.bottom > docRect.bottom + 1) {
          violations.push(`${id}: <${element.tagName.toLowerCase()} class="${element.className}"> overflows the page box (right ${Math.round(rect.right)}/${Math.round(docRect.right)}, bottom ${Math.round(rect.bottom)}/${Math.round(docRect.bottom)})`);
        }
      }

      for (const tile of doc.querySelectorAll(".tile")) {
        if (tile.scrollHeight > tile.clientHeight + 1 || tile.scrollWidth > tile.clientWidth + 1) {
          const label = tile.className.replace(/\s+/g, ".");
          violations.push(`${id}: tile ${label} is clipping its content (${tile.scrollHeight - tile.clientHeight}px tall)`);
        }
      }

      if (doc.textContent.toLowerCase().includes("download pdf")) {
        violations.push(`${id}: still contains a Download PDF control`);
      }
    }

    return { violations: [...new Set(violations)] };
  });
}

async function run() {
  const server = await startServer();
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}/`;

  const sections = [];
  for (const page of pages) {
    const html = await readFile(join(root, page.file), "utf8");
    sections.push(`<section class="pdf-doc pdf-doc--${page.key}" id="${page.key}">
<header class="pdf-head">${logo}<span>Emin İsmayılov</span></header>
<div class="pdf-body">${rewriteLinks(mainOf(html, page.file))}</div>
</section>`);
  }

  const document = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <base href="${base}">
  <title>Emin İsmayılov — Portfolio</title>
  <link rel="stylesheet" href="assets/css/site.css">
  <link rel="stylesheet" href="assets/css/pdf.css">
</head>
<body>${sections.join("\n")}</body>
</html>`;

  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined
  });
  const page = await browser.newPage({ viewport: { width: 673, height: 1006 }, colorScheme: "light" });
  await page.emulateMedia({ media: "print", colorScheme: "light" });
  await page.setContent(document, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.evaluate(() => {
    document.querySelectorAll(".pdf-btn, .pdf-cta").forEach((node) => node.remove());
  });
  await page.waitForTimeout(300);

  const report = await audit(page);
  await mkdir(join(root, "docs", "qa"), { recursive: true });
  await writeFile(join(root, "docs", "qa", "pdf-layout.json"), `${JSON.stringify(report, null, 2)}\n`);
  if (report.violations.length) {
    console.error("PDF layout check failed:");
    for (const violation of report.violations) console.error(` - ${violation}`);
    await browser.close();
    server.close();
    throw new Error(`${report.violations.length} layout problem(s)`);
  }

  const pdf = await page.pdf({
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    tagged: true,
    outline: true,
    displayHeaderFooter: false
  });
  await writeFile(join(root, "portfolio.pdf"), pdf);

  const title = await page.title();
  const bytes = pdf.byteLength;
  await browser.close();
  server.close();
  console.log(`Wrote portfolio.pdf (${bytes} bytes, ${title}); layout check clean`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
