import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.cwd());
const outDir = join(root, "docs", "qa");
const pages = ["index.html", "projects.html", "about.html"];
const names = { "index.html": "home", "projects.html": "projects", "about.html": "about" };
const viewports = [
  { label: "1440", width: 1440, height: 900 },
  { label: "390", width: 390, height: 844 }
];
const themes = ["light", "dark"];

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
      } catch {
        response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        response.end("not found");
      }
    });
    server.listen(0, "127.0.0.1", () => resolveServer(server));
  });
}

async function settle(page) {
  await page.evaluate(() => {
    if (document.fonts) return document.fonts.ready;
    return undefined;
  });
  await page.evaluate(() => {
    document.querySelectorAll(".reveal").forEach((item) => item.classList.add("is-in"));
  });
  await page.waitForTimeout(220);
}

async function run() {
  await mkdir(outDir, { recursive: true });
  const entries = [];

  const server = await startServer();
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}/`;
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined
  });

  for (const pageFile of pages) {
    const name = names[pageFile];
    for (const viewport of viewports) {
      for (const theme of themes) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          colorScheme: theme,
          reducedMotion: "reduce"
        });
        await context.addInitScript((value) => {
          try { localStorage.setItem("emin-theme", value); } catch (error) {}
        }, theme);
        const page = await context.newPage();
        await page.goto(base + pageFile, { waitUntil: "networkidle" });
        await settle(page);
        const file = join(outDir, `site-${name}-${viewport.label}-${theme}.png`);
        await page.screenshot({ path: file, fullPage: true, animations: "disabled" });
        const info = await stat(file);
        entries.push({
          kind: "site",
          page: name,
          viewport: viewport.label,
          theme,
          file: `site-${name}-${viewport.label}-${theme}.png`,
          bytes: info.size
        });
        await context.close();
      }
    }
  }

  const ogContext = await browser.newContext({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 2,
    colorScheme: "light",
    reducedMotion: "reduce"
  });
  await ogContext.addInitScript(() => {
    try { localStorage.setItem("emin-theme", "light"); } catch (error) {}
  });
  const ogPage = await ogContext.newPage();
  await ogPage.goto(base + "index.html", { waitUntil: "networkidle" });
  await settle(ogPage);
  await ogPage.screenshot({
    path: join(root, "assets", "img", "preview.jpg"),
    type: "jpeg",
    quality: 88,
    animations: "disabled"
  });
  await ogContext.close();
  await browser.close();
  server.close();

  const pdfPath = join(root, "portfolio.pdf");
  const pdfStat = await stat(pdfPath);
  const prefix = join(outDir, "pdf-page");
  const render = spawnSync("pdftoppm", ["-png", "-r", "120", pdfPath, prefix], { encoding: "utf8" });
  if (render.status !== 0) {
    throw new Error(`pdftoppm failed: ${render.stderr || render.stdout}`);
  }
  const pdfFiles = (await readdir(outDir))
    .filter((file) => /^pdf-page-\d+\.png$/.test(file))
    .sort();
  if (pdfFiles.length !== 3) {
    throw new Error(`expected 3 PDF page PNGs, rendered ${pdfFiles.length}`);
  }
  for (const file of pdfFiles) {
    const info = await stat(join(outDir, file));
    if (info.size < 15_000) throw new Error(`${file} looks blank (${info.size} bytes)`);
    entries.push({ kind: "pdf", page: file.replace(/^pdf-page-|\.png$/g, ""), file, bytes: info.size });
  }

  const compareNames = ["home", "projects", "about"];
  for (let index = 0; index < pdfFiles.length; index += 1) {
    const name = compareNames[index];
    const file = `compare-${name}.png`;
    const result = spawnSync(
      "python3",
      [
        join(root, "scripts", "compare-pages.py"),
        join(outDir, `site-${name}-1440-light.png`),
        join(outDir, pdfFiles[index]),
        join(outDir, file),
        `${name} at 1440 light`
      ],
      { encoding: "utf8" }
    );
    if (result.status !== 0) {
      throw new Error(`compare-pages.py failed: ${result.stderr || result.stdout}`);
    }
    const info = await stat(join(outDir, file));
    if (info.size < 20_000) throw new Error(`${file} looks blank (${info.size} bytes)`);
    entries.push({ kind: "compare", page: name, file, bytes: info.size });
  }

  await writeFile(
    join(outDir, "manifest.json"),
    `${JSON.stringify({ pdfBytes: pdfStat.size, entries }, null, 2)}\n`
  );
  console.log(
    `Wrote ${entries.filter((entry) => entry.kind === "site").length} site screenshots, ` +
    `${pdfFiles.length} PDF page PNGs, ${compareNames.length} side-by-side comparisons, and assets/img/preview.jpg`
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
