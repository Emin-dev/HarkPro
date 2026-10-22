import { spawnSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());
const qaDir = join(root, "docs", "qa");
const preferredModel = process.env.VISION_QA_MODEL || "opencode-go/qwen3.8-max";
const candidates = [
  process.env.OPENCODE_BIN,
  join(process.env.HOME || "", ".opencode", "bin", "opencode"),
  "/usr/local/bin/opencode",
  "opencode"
].filter(Boolean);

const pages = ["home", "projects", "about", "contact"];
const labels = {
  home: ["desktop 1440 light", "desktop 1440 dark", "mobile 390 light", "mobile 390 dark"],
  projects: ["desktop 1440 light", "desktop 1440 dark", "mobile 390 light", "mobile 390 dark"],
  about: ["desktop 1440 light", "desktop 1440 dark", "mobile 390 light", "mobile 390 dark"],
  contact: ["desktop 1440 light", "desktop 1440 dark", "mobile 390 light", "mobile 390 dark"]
};

function findOpencode() {
  for (const candidate of candidates) {
    if (candidate === "opencode") return candidate;
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function availableModels(bin) {
  const result = spawnSync(bin, ["models"], { encoding: "utf8", timeout: 30_000 });
  if (result.status !== 0) return [];
  return result.stdout
    .split("\n")
    .map((line) => line.replace(/\x1b\[[0-9;]*m/g, "").trim())
    .filter((line) => /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.:-]+)?$/.test(line));
}

function chooseModels(bin) {
  const available = availableModels(bin);
  const wanted = [
    preferredModel,
    "opencode-go/qwen3.8-max",
    "opencode/qwen3.8-max",
    "qwen3.8-max",
    "opencode-go/qwen3.8-flash",
    "opencode/qwen3.8-flash",
    "qwen3.8-flash"
  ];
  const chosen = [];
  for (const name of wanted) {
    if (available.includes(name)) chosen.push(name);
  }
  for (const name of available) {
    if (/qwen3\.8-max$/i.test(name)) chosen.push(name);
  }
  for (const name of available) {
    if (/qwen3\.8-flash$/i.test(name)) chosen.push(name);
  }
  if (!chosen.length) chosen.push(...wanted.slice(0, 2));
  return [...new Set(chosen)];
}

function parseAnswer(stdout) {
  const texts = [];
  for (const line of stdout.split("\n")) {
    if (!line.startsWith("{")) continue;
    try {
      const event = JSON.parse(line);
      if (event.type === "text" && event.part && typeof event.part.text === "string") texts.push(event.part.text);
    } catch (error) {}
  }
  return texts.length ? texts[texts.length - 1].trim() : "";
}

function callVision(bin, model, images, prompt) {
  const args = ["run", "--pure", "--format", "json", "-m", model];
  for (const image of images) args.push("-f", image);
  args.push("--", prompt);
  const result = spawnSync(bin, args, {
    cwd: tmpdir(),
    encoding: "utf8",
    timeout: model.includes("flash") ? 180_000 : 300_000,
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env }
  });
  if (result.error) return { ok: false, error: result.error.message, model };
  if (result.status !== 0) {
    return { ok: false, error: (result.stderr || result.stdout || `exit ${result.status}`).trim().slice(0, 1200), model };
  }
  const answer = parseAnswer(result.stdout);
  if (/^CLEAN\b/i.test(answer)) return { ok: true, answer, model };
  if (/^ISSUES:/i.test(answer)) return { ok: true, answer, model };
  return { ok: false, error: `unexpected answer: ${answer.slice(0, 1200) || "(empty)"}`, model };
}

function downscale(src, dst, width) {
  const result = spawnSync("python3", [join(root, "scripts", "vision-prep.py"), src, dst, String(width)], {
    encoding: "utf8"
  });
  if (result.status !== 0) throw new Error(`could not downscale ${src}: ${result.stderr || result.stdout}`);
  return dst;
}

async function main() {
  const bin = findOpencode();
  const results = [];
  let unavailable = false;

  const models = bin ? chooseModels(bin) : [];

  if (!bin) {
    unavailable = true;
    results.push({ page: "all", ok: false, unavailable: true, error: "opencode CLI not found" });
  } else {
    console.log(`Models: ${models.join(", ")}`);
    const tmp = await mkdtemp(join(tmpdir(), "vision-qa-"));
    for (const page of pages) {
      const sources = labels[page].map((label, index) => {
        const theme = index % 2 === 0 ? "light" : "dark";
        const viewport = index < 2 ? "1440" : "390";
        return join(qaDir, `site-${page}-${viewport}-${theme}.png`);
      });
      const pdfIndex = pages.indexOf(page) + 1;
      sources.push(join(qaDir, `pdf-page-${pdfIndex}.png`));

      const missing = sources.filter((image) => !existsSync(image));
      if (missing.length) {
        results.push({ page, ok: false, error: `missing images: ${missing.map((image) => image.replace(root + "/", "")).join(", ")}` });
        continue;
      }

      const images = sources.map((source, index) => {
        const width = index === 4 ? 900 : index < 2 ? 900 : 320;
        return downscale(source, join(tmp, `${page}-${index}.png`), width);
      });

      const prompt = [
        "You are a strict visual QA reviewer for a portfolio website. The attached images are, in order:",
        ...sources.map((source, index) => `${index + 1}. ${source.includes("/pdf-page-") ? "PDF page" : labels[page][index]} — ${source.split("/").pop()}`),
        "",
        "Check for: overlapping or clipped text, cut-off tiles, content beyond the viewport, blank or nearly blank pages, broken or missing images, low-contrast or unreadable text, inconsistent spacing, horizontal scrolling, dark/light inconsistency, and the PDF not matching the website's fonts, colors, tile layout or content.",
        "Judge only visible pixels. Be strict, but do not invent issues. Text may reflow differently in the PDF because A4 is narrower; only flag it if text overlaps or is clipped. The PDF nav includes the brand logo and a static theme icon. Treat generous whitespace on a short Contact page as intentional unless the page is blank or content is clipped. Do not use tools.",
        "Reply with exactly one line: CLEAN",
        "or: ISSUES: <short semicolon-separated list, each item starting with the image number>",
        "Do not add any other text."
      ].join("\n");

      let response = null;
      for (const model of models) {
        response = callVision(bin, model, images, prompt);
        if (response.ok) break;
        console.log(`${page}: ${model} unavailable (${response.error})`);
      }
      results.push({ page, sources: sources.map((image) => image.replace(root + "/", "")), ...response });
      console.log(`${page}: ${response.ok ? `${response.answer} [${response.model}]` : `ERROR ${response.error}`}`);
    }
  }

  const answered = results.some((result) => result.ok);
  if (!answered) unavailable = true;
  const clean = results.length === pages.length && results.every((result) => result.ok && /^CLEAN\b/i.test(result.answer));
  const report = {
    preferredModel,
    models,
    clean,
    unavailable,
    results
  };

  if (unavailable) {
    await writeFile(join(qaDir, "vision-qa-unavailable.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log("VISION-QA-NEEDED");
    console.log("PNGs are in docs/qa/. No qwen3.8 vision model could review them here.");
    return;
  }

  await writeFile(join(qaDir, "vision-qa.json"), `${JSON.stringify(report, null, 2)}\n`);

  const lines = [
    "# Vision QA",
    "",
    `Model: \`${preferredModel}\` (fallback: \`opencode-go/qwen3.8-flash\`)`,
    "",
    clean ? "Result: **CLEAN**" : "Result: **NOT CLEAN**",
    ""
  ];
  for (const result of results) {
    lines.push(`## ${result.page}`);
    lines.push("");
    lines.push(result.ok ? result.answer : `ERROR: ${result.error}`);
    lines.push("");
  }
  await writeFile(join(qaDir, "VISION-QA.md"), `${lines.join("\n")}\n`);
  if (!clean) {
    console.error("FAIL: vision QA found issues");
    process.exitCode = 1;
    return;
  }
  console.log(`PASS: vision QA clean for ${pages.length} site pages and 4 PDF pages`);
}

main().catch(async (error) => {
  console.error(error);
  try {
    await writeFile(
      join(qaDir, "vision-qa.json"),
      `${JSON.stringify({ preferredModel, clean: false, unavailable: true, error: error.message }, null, 2)}\n`
    );
  } catch (writeError) {}
  console.log("VISION-QA-NEEDED");
  process.exitCode = 1;
});
