import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, rm, writeFile } from "node:fs/promises";
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
    if (pathPart === "portfolio.pdf") return 'href="https://emin-dev.github.io/HarkPro/portfolio.pdf"';
    return full;
  });
}

const extraPrintCss = `
  .pdf-doc { padding-top: 2mm; }
  .pdf-doc + .pdf-doc { margin-top: 0; }
  .pdf-doc .page-head { padding-top: 4mm; }
  .pdf-doc .hero { min-height: 0; }
  .pdf-doc .reveal { opacity: 1 !important; transform: none !important; }
  .pdf-doc a { text-decoration: none; }
`;

async function run() {
  const server = await startServer();
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}/`;

  const navLabels = { home: "Home", projects: "Projects", about: "About", contact: "Contact" };
  const footers = {
    home: [["projects", "Projects"], ["about", "About"], ["contact", "Contact"], ["https://github.com/Emin-dev", "GitHub"]],
    projects: [["home", "Home"], ["about", "About"], ["contact", "Contact"], ["https://github.com/Emin-dev", "GitHub"]],
    about: [["home", "Home"], ["projects", "Projects"], ["contact", "Contact"], ["https://github.com/Emin-dev", "GitHub"]],
    contact: [["home", "Home"], ["projects", "Projects"], ["about", "About"], ["https://github.com/Emin-dev", "GitHub"]]
  };
  const sections = [];
  for (const page of pages) {
    const html = await readFile(join(root, page.file), "utf8");
    const nav = pages.map((item) => {
      const current = item.key === page.key ? ' aria-current="page"' : "";
      return `<a href="#${item.key}"${current}>${navLabels[item.key]}</a>`;
    }).join("");
    const footerLinks = footers[page.key].map(([href, text]) => {
      const link = href.startsWith("http") ? href : `#${href}`;
      return `<a href="${link}">${text}</a>`;
    }).join("");
    sections.push(`<section class="pdf-doc" id="${page.key}">
<header class="pdf-nav"><span class="pdf-nav-brand"><svg viewBox="0 0 36 36" aria-hidden="true"><rect width="36" height="36" rx="9" fill="#161f39"/><path fill="#f5f5f7" d="M25.096 30c-.072 0-.12-.048-.168-.12-4.776-6.384-12.216-10.8-20.736-11.688C4.048 18.168 4 18.096 4 18s.048-.168.192-.192c8.52-.888 15.96-5.304 20.736-11.688.048-.072.096-.12.168-.12s.096.024.168.072A15.02 15.02 0 0 1 31.12 18a15.02 15.02 0 0 1-5.856 11.928c-.072.048-.096.072-.168.072"/></svg>Emin İsmayılov</span><nav aria-label="PDF pages">${nav}</nav><span class="pdf-theme" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg></span></header>
${rewriteLinks(mainOf(html, page.file))}
<footer class="pdf-foot"><p>© 2026 Emin İsmayılov</p><nav aria-label="PDF footer">${footerLinks}</nav></footer>
</section>`);
  }

  const document = `<!doctype html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8">
  <base href="${base}">
  <title>Emin İsmayılov — Portfolio</title>
  <link rel="stylesheet" href="assets/css/site.css">
  <style>${extraPrintCss}</style>
</head>
<body>${sections.join("\n")}</body>
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
