import { join, basename } from "node:path";
import { ensureCacheDir, getCacheDir, pathExists } from "../utils/cache.js";
import { runCommand } from "../utils/exec.js";
import { cp, mkdtemp, readdir, stat } from "node:fs/promises";
import os from "node:os";
import fg from "fast-glob";
import { buildAppleDocsIndex, saveAppleDocsIndex } from "../utils/apple_index.js";
import { buildUnifiedIndex, saveUnifiedIndex } from "../utils/hybrid_index.js";
import { readFile } from "node:fs/promises";

export type DocsetsImportInput = {
  sourcePathOrUrl: string;
  framework?: string;
  reindex?: boolean;
};

type ImportResult = {
  ok: true;
  cacheDir: string;
  imported: { totalFiles: number; frameworks: Record<string, { files: number; dest: string }> };
  indexes?: { apple?: { count: number; path: string }; hybrid?: { count: number; path: string } };
} | {
  ok: false;
  message: string;
};

function isUrl(s: string) {
  return /^https?:\/\//i.test(s);
}

function lowerExt(p: string) {
  const i = p.lastIndexOf(".");
  return i >= 0 ? p.slice(i).toLowerCase() : "";
}

async function extractArchive(archivePath: string, outDir: string): Promise<string> {
  const ext = archivePath.toLowerCase();
  await ensureCacheDir();
  const extractRoot = outDir; // we'll extract into provided outDir
  if (ext.endsWith(".zip")) {
    const res = await runCommand("unzip", ["-q", "-o", archivePath, "-d", extractRoot]);
    if (res.code !== 0) throw new Error(res.stderr || res.stdout || "unzip failed");
  } else if (ext.endsWith(".tar.gz") || ext.endsWith(".tgz")) {
    const res = await runCommand("tar", ["-xzf", archivePath, "-C", extractRoot]);
    if (res.code !== 0) throw new Error(res.stderr || res.stdout || "tar -xzf failed");
  } else if (ext.endsWith(".tar")) {
    const res = await runCommand("tar", ["-xf", archivePath, "-C", extractRoot]);
    if (res.code !== 0) throw new Error(res.stderr || res.stdout || "tar -xf failed");
  } else {
    throw new Error("Unsupported archive format. Use .zip, .tar.gz, .tgz, or .tar");
  }
  return extractRoot;
}

async function detectFrameworkFromJson(jsonPath: string): Promise<string | undefined> {
  try {
    const txt = await readFile(jsonPath, "utf8");
    const js = JSON.parse(txt);
    return js?.metadata?.module?.name || js?.module?.name || undefined;
  } catch {
    return undefined;
  }
}

export async function importDocsets({ sourcePathOrUrl, framework, reindex = true }: DocsetsImportInput): Promise<ImportResult> {
  try {
    const appleDocsDir = await ensureCacheDir("apple-docs");
    const tmpBase = await ensureCacheDir("tmp");
    const tmp = await mkdtemp(join(tmpBase, `import-`));

    // Resolve source to a local directory we can copy from
    let localPath = sourcePathOrUrl;
    let workDir = tmp;
    let docRoot: string | null = null;

    if (isUrl(sourcePathOrUrl)) {
      const fileName = basename(sourcePathOrUrl.split("?")[0]);
      const dlPath = join(tmp, fileName);
      const res = await runCommand("curl", ["-fsSL", sourcePathOrUrl, "-o", dlPath]);
      if (res.code !== 0) throw new Error(res.stderr || res.stdout || "curl failed");
      docRoot = await extractArchive(dlPath, join(tmp, "extract"));
    } else {
      const st = await stat(localPath).catch(() => null);
      if (!st) throw new Error("Source path not found");
      if (st.isDirectory()) {
        docRoot = localPath;
      } else if (st.isFile()) {
        docRoot = await extractArchive(localPath, join(tmp, "extract"));
      } else {
        throw new Error("Unsupported source path type");
      }
    }

    if (!docRoot) throw new Error("Unable to resolve document root");

    // Determine copy strategy
    const entries = await readdir(docRoot, { withFileTypes: true });
    const hasTopLevelJson = entries.some((e) => e.isFile() && e.name.toLowerCase().endsWith(".json"));

    const frameworksMap: Record<string, { files: number; dest: string }> = {};
    let totalFiles = 0;

    if (hasTopLevelJson) {
      // Determine framework name
      let fw = framework;
      if (!fw) {
        // Try to peek at the first JSON file to infer module
        const jsonFiles = entries.filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".json"));
        if (jsonFiles.length > 0) {
          const inferred = await detectFrameworkFromJson(join(docRoot, jsonFiles[0].name));
          fw = inferred || fw;
        }
      }
      if (!fw) fw = "Unknown";
      const dest = join(appleDocsDir, fw);
      await cp(docRoot, dest, { recursive: true });
      const count = (await fg(["**/*.json"], { cwd: dest })).length;
      frameworksMap[fw] = { files: count, dest };
      totalFiles += count;
    } else {
      // Copy each first-level directory as its own framework folder
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        const name = e.name;
        const src = join(docRoot, name);
        const dest = join(appleDocsDir, name);
        await cp(src, dest, { recursive: true });
        const count = (await fg(["**/*.json"], { cwd: dest })).length;
        frameworksMap[name] = { files: count, dest };
        totalFiles += count;
      }
    }

    // Optionally reindex
    const indexes: ImportResult extends { indexes: infer T } ? any : any = {};
    if (reindex) {
      try {
        const builtA = await buildAppleDocsIndex();
        if (builtA) {
          const locA = await saveAppleDocsIndex(builtA.index);
          indexes.apple = { count: builtA.count, path: locA };
        }
      } catch {
        // ignore
      }
      try {
        const builtU = await buildUnifiedIndex();
        if (builtU) {
          const locU = await saveUnifiedIndex(builtU.index);
          indexes.hybrid = { count: builtU.count, path: locU };
        }
      } catch {
        // ignore
      }
    }

    return { ok: true, cacheDir: getCacheDir(), imported: { totalFiles, frameworks: frameworksMap }, indexes } as ImportResult;
  } catch (e: any) {
    return { ok: false, message: e?.message || String(e) } as ImportResult;
  }
}

