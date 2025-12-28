import { join } from "node:path";
import { ensureCacheDir, pathExists } from "../utils/cache.js";
import { cp, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { runCommand } from "../utils/exec.js";
import { buildAppleDocsIndex, saveAppleDocsIndex } from "../utils/apple_index.js";
import { buildHigIndex, saveHigIndex } from "../utils/hig_index.js";
import { buildPatternsIndex, savePatternsIndex } from "../utils/patterns_index.js";
import { buildUnifiedIndex, saveUnifiedIndex } from "../utils/hybrid_index.js";

async function gitCloneOrPull(repo: string, destSubdir: string) {
  const base = await ensureCacheDir();
  const dest = join(base, destSubdir);
  const exists = await pathExists(dest);
  if (!exists) {
    const res = await runCommand("git", ["clone", "--depth", "1", repo, dest]);
    if (res.code !== 0) throw new Error(`git clone failed: ${res.stderr || res.stdout}`);
    return { action: "cloned", dest } as const;
  } else {
    const res = await runCommand("git", ["-C", dest, "pull", "--ff-only"]);
    if (res.code !== 0) throw new Error(`git pull failed: ${res.stderr || res.stdout}`);
    return { action: "updated", dest } as const;
  }
}

async function httpSave(url: string, destPath: string) {
  // Use curl if present; Node fetch also works in Node >=18, but curl is simpler here
  const res = await runCommand("curl", ["-fsSL", url, "-o", destPath]);
  if (res.code !== 0) throw new Error(`curl failed: ${res.stderr || res.stdout}`);
}

export async function updateSync(): Promise<string> {
  const steps: string[] = [];

  const evo = await gitCloneOrPull("https://github.com/apple/swift-evolution.git", "swift-evolution");
  steps.push(`swift-evolution ${evo.action}`);

  const book = await gitCloneOrPull("https://github.com/apple/swift-book.git", "swift-book");
  steps.push(`swift-book ${book.action}`);

  const cache = await ensureCacheDir("guidelines");
  const apiGuidelinesHtml = join(cache, "api-design-guidelines.html");
  await httpSave("https://www.swift.org/documentation/api-design-guidelines/", apiGuidelinesHtml);
  steps.push("API Design Guidelines cached");

  // Prepare Apple docs + HIG cache locations
  const appleDocsDir = await ensureCacheDir("apple-docs");
  const higDir = await ensureCacheDir("hig");
  steps.push(`apple-docs dir ready at ${appleDocsDir}`);
  steps.push(`HIG dir ready at ${higDir}`);

  // Seed sample DocC (for CI/local dev)
  try {
    const sample = resolve(process.cwd(), "content", "sample-docc");
    const st = await stat(sample).catch(() => null);
    if (st && st.isDirectory()) {
      await cp(sample, appleDocsDir, { recursive: true });
      steps.push("Seeded sample DocC into apple-docs");
    }
  } catch {
    steps.push("Seeding sample DocC skipped or failed");
  }

  // Try to fetch a small subset of HIG pages (best-effort)
  try {
    const higIndex = join(higDir, "index.html");
    await httpSave("https://developer.apple.com/design/human-interface-guidelines/", higIndex);
    steps.push("HIG index cached");
  } catch (e) {
    steps.push("HIG index fetch skipped or failed");
  }

  // Try a representative HIG page (paths occasionally change). Use current "inputs" section.
  try {
    const inputs = join(higDir, "inputs.html");
    await httpSave("https://developer.apple.com/design/human-interface-guidelines/inputs", inputs);
    steps.push("HIG inputs cached");
  } catch {
    steps.push("HIG inputs fetch skipped or failed");
  }

  // Fetch a small set of additional stable HIG pages (best-effort)
  const higPages: Array<{ slug: string; file: string }> = [
    { slug: "typography", file: "typography.html" },
    { slug: "color", file: "color.html" },
    { slug: "buttons", file: "buttons.html" },
    { slug: "icons", file: "icons.html" },
    { slug: "menus", file: "menus.html" },
    { slug: "windows", file: "windows.html" },
  ];
  for (const p of higPages) {
    try {
      await httpSave(`https://developer.apple.com/design/human-interface-guidelines/${p.slug}`, join(higDir, p.file));
      steps.push(`HIG ${p.slug} cached`);
    } catch {
      steps.push(`HIG ${p.slug} fetch skipped or failed`);
    }
  }

  // Build Apple docs MiniSearch index (best-effort)
  try {
    const built = await buildAppleDocsIndex();
    if (built) {
      const loc = await saveAppleDocsIndex(built.index);
      steps.push(`Apple docs indexed (${built.count} docs) -> ${loc}`);
    } else {
      steps.push("Apple docs index skipped (no docs)");
    }
  } catch (e) {
    steps.push("Apple docs index failed");
  }

  // Build HIG index
  try {
    const built = await buildHigIndex();
    if (built) {
      const loc = await saveHigIndex(built.index);
      steps.push(`HIG indexed (${built.count} docs) -> ${loc}`);
    } else {
      steps.push("HIG index skipped (no docs)");
    }
  } catch {
    steps.push("HIG index failed");
  }

  // Build Patterns index
  try {
    const built = await buildPatternsIndex();
    if (built) {
      const loc = await savePatternsIndex(built.index);
      steps.push(`Patterns indexed (${built.count}) -> ${loc}`);
    } else {
      steps.push("Patterns index skipped (no content)");
    }
  } catch {
    steps.push("Patterns index failed");
  }

  // Build Unified hybrid index
  try {
    const built = await buildUnifiedIndex();
    if (built) {
      const loc = await saveUnifiedIndex(built.index);
      steps.push(`Hybrid index built (${built.count}) -> ${loc}`);
    } else {
      steps.push("Hybrid index skipped (no sources)");
    }
  } catch {
    steps.push("Hybrid index failed");
  }

  return steps.join("; ");
}
