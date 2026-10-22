import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.cwd());
const basePages = ["index.html", "projects.html", "about.html"];
const failures = [];

const forbidden = [
  "rent" + "butik",
  "ad" + "board",
  "ai" + "hub",
  "crowd" + "funding",
  "six " + "years",
  "6 " + "years",
  "mecha" + "tronics",
  "scrum " + "master",
  "ba" + "ku",
  "quantum" + "brainlabs",
  "ba" + "ku" + "edu",
  "agile" + "minds",
  "agile_" + "pulse",
  "meridian " + "academy",
  "emin " + "education",
  "cozy " + "nook",
  "quiet " + "tiles",
  "rule" + "shift",
  "scriver",
  "eminpromax",
  "linkedin",
  "mailto:",
  "tel:",
  "vercel",
  "contact"
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
      } catch {
        response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        response.end("not found");
      }
    });
    server.listen(0, "127.0.0.1", () => resolveServer(server));
  });
}

function check(condition, message) {
  if (!condition) failures.push(message);
}

function allowedExternal(href) {
  try {
    const url = new URL(href);
    if (url.protocol !== "https:") return false;
    if (url.hostname === "github.com") return /^\/Emin-dev(?:\/|$)/.test(url.pathname);
    if (url.hostname === "emin-dev.github.io") return true;
    return false;
  } catch {
    return false;
  }
}

async function checkExternal(url) {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; EminPortfolioCheck/1.0)" },
      signal: AbortSignal.timeout(25_000)
    });
    if (response.status < 200 || response.status >= 400) failures.push(`external ${response.status}: ${url}`);
  } catch (error) {
    failures.push(`external unreachable: ${url} (${error.message})`);
  }
}

async function run() {
  try {
    const pdf = await stat(join(root, "portfolio.pdf"));
    check(pdf.size > 50_000, "portfolio.pdf is missing or too small");
  } catch {
    failures.push("portfolio.pdf is missing");
  }

  for (const file of [...basePages, "404.html"]) {
    const html = await readFile(join(root, file), "utf8");
    const lower = html.toLowerCase();
    for (const term of forbidden) {
      check(!lower.includes(term), `${file}: contains removed private content "${term}"`);
    }
  }

  try {
    await stat(join(root, "contact.html"));
    failures.push("contact.html must not exist");
  } catch {}

  const sitemap = await readFile(join(root, "sitemap.xml"), "utf8");
  check(!sitemap.toLowerCase().includes("contact"), "sitemap.xml: contact page must not be listed");

  const server = await startServer();
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}/`;
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined
  });

  let downloadButtons = 0;
  const externalLinks = new Set();

  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({ viewport, colorScheme: theme });
      await context.addInitScript((value) => {
        try { localStorage.setItem("emin-theme", value); } catch (error) {}
      }, theme);

      for (const file of basePages) {
        const page = await context.newPage();
        const consoleErrors = [];
        page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
        page.on("pageerror", (error) => consoleErrors.push(error.message));

        const response = await page.goto(base + file, { waitUntil: "networkidle" });
        check(response && response.status() === 200, `${file}: did not load with 200`);
        await page.evaluate(() => {
          document.querySelectorAll(".reveal").forEach((item) => item.classList.add("is-in"));
        });
        await page.waitForTimeout(160);

        const info = await page.evaluate(() => {
          const anchors = Array.from(document.querySelectorAll("a[href]"));
          const pdfButtons = anchors.filter((a) => a.classList.contains("pdf-btn"));
          return {
            lang: document.documentElement.lang,
            title: document.title,
            theme: document.documentElement.getAttribute("data-theme"),
            h1s: document.querySelectorAll("h1").length,
            description: document.querySelector('meta[name="description"]')?.content || "",
            canonical: document.querySelector('link[rel="canonical"]')?.href || "",
            overflow: document.documentElement.scrollWidth - window.innerWidth,
            pdfButtons: pdfButtons.length,
            pdfText: pdfButtons.map((a) => a.textContent.replace(/\s+/g, " ").trim()),
            anchors: anchors.map((a) => a.getAttribute("href"))
          };
        });

        check(info.lang === "en", `${file}: missing lang=en`);
        check(info.title.length > 10, `${file}: title too short`);
        check(info.theme === theme, `${file}: theme ${theme} was not applied`);
        check(info.h1s === 1, `${file}: expected exactly one h1, found ${info.h1s}`);
        check(info.description.length > 40, `${file}: meta description too short`);
        check(info.canonical.includes("emin-dev.github.io/HarkPro/"), `${file}: canonical URL missing`);
        check(info.overflow <= 1, `${file}: horizontal overflow at ${viewport.width}px/${theme} (${info.overflow}px)`);
        check(consoleErrors.length === 0, `${file}: console errors: ${consoleErrors.join(" | ")}`);
        if (viewport.width === 1440 && theme === "light") downloadButtons += info.pdfButtons;
        for (const text of info.pdfText) check(text === "Download PDF", `${file}: PDF button text is ${JSON.stringify(text)}`);

        for (const href of info.anchors) {
          if (!href || href.startsWith("mailto:") || href.startsWith("/")) continue;
          if (href.startsWith("#")) {
            const id = href.slice(1);
            if (id) {
              const exists = await page.evaluate((target) => Boolean(document.getElementById(target)), id);
              check(exists, `${file}: missing anchor target ${href}`);
            }
            continue;
          }
          if (href.startsWith("http://") || href.startsWith("https://")) {
            check(allowedExternal(href), `${file}: external link not allowed ${href}`);
            externalLinks.add(href);
            continue;
          }
          if (href === "portfolio.pdf") {
            const pdfResponse = await page.request.get(new URL(href, base + file).href);
            check(pdfResponse.status() === 200, `${file}: portfolio.pdf link returned ${pdfResponse.status()}`);
            continue;
          }
          const target = new URL(href, base + file);
          const targetResponse = await page.request.get(target.href);
          check(targetResponse.status() === 200, `${file}: internal link ${href} returned ${targetResponse.status()}`);
        }
        await page.close();
      }
      await context.close();
    }
  }

  for (const href of externalLinks) await checkExternal(href);

  check(downloadButtons === 2, `expected exactly 2 Download PDF buttons, found ${downloadButtons}`);
  await browser.close();
  server.close();

  if (failures.length) {
    console.error(`FAIL: ${failures.length} problem(s)`);
    for (const failure of failures) console.error(` - ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS: 3 pages, 2 viewports, light/dark, no console errors, no overflow, links ok, ${downloadButtons} PDF buttons, ${externalLinks.size} external links`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
