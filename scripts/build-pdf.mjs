import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.cwd());
const pages = [
  { file: "index.html", key: "home" },
  { file: "projects.html", key: "projects" },
  { file: "about.html", key: "about" },
  { file: "contact.html", key: "contact" }
];

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".pdf": "application/pdf"
};

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
      } catch (error) {
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
    if (pathPart === "contact.html" || pathPart === "./contact.html") return `href="${target || "#contact"}"`;
    if (pathPart === "portfolio.pdf") return `href="#contact"`;
    return full;
  });
}

const extraPrintCss = `
  .pdf-doc { padding-top: 2mm; }
  .pdf-doc + .pdf-doc { margin-top: 0; }
  .pdf-doc .page-head { padding-top: 4mm; }
  .pdf-doc .hero { min-height: 0; }
  .pdf-doc .pdf-cta { display: none !important; }
  .pdf-doc .reveal { opacity: 1 !important; transform: none !important; }
  .pdf-doc a { text-decoration: none; }
`;

async function run() {
  const server = await startServer();
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}/`;

  const sections = [];
  for (const page of pages) {
    const html = await readFile(join(root, page.file), "utf8");
    sections.push(`<section class="pdf-doc" id="${page.key}">\n${rewriteLinks(mainOf(html, page.file))}\n</section>`);
  }

  const contents = `<footer class="pdf-toc">
    <span class="eyebrow">Portfolio</span>
    <div class="pdf-toc-links">
      <a href="#home">Home</a>
      <a href="#projects">Projects</a>
      <a href="#about">About</a>
      <a href="#contact">Contact</a>
    </div>
    <p>eminpromax@icloud.com · github.com/Emin-dev · Baku, Azerbaijan</p>
  </footer>`;

  const document = `<!doctype html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8">
  <base href="${base}">
  <title>Emin İsmayılov — Portfolio</title>
  <link rel="stylesheet" href="assets/css/site.css">
  <style>${extraPrintCss}</style>
</head>
<body>${sections.join("\n")}${contents}</body>
</html>`;

  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: "light" });
  await page.emulateMedia({ media: "print", colorScheme: "light" });
  await page.setContent(document, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(300);

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
  console.log(`Wrote portfolio.pdf (${bytes} bytes, ${title})`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
