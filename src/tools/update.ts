import { join } from "node:path";
import { ensureCacheDir, pathExists } from "../utils/cache.js";
import { runCommand } from "../utils/exec.js";

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

  return steps.join("; ");
}

