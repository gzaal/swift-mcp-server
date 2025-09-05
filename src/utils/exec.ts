import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { constants } from "node:fs";

export async function which(bin: string): Promise<string | null> {
  const PATH = process.env.PATH || "";
  const exts = process.platform === "win32" ? [".exe", ".cmd", ""] : [""];
  for (const dir of PATH.split(":")) {
    for (const ext of exts) {
      const candidate = `${dir}/${bin}${ext}`;
      try {
        await access(candidate, constants.X_OK);
        return candidate;
      } catch {
        // continue
      }
    }
  }
  return null;
}

export async function runCommand(
  cmd: string,
  args: string[],
  opts: { cwd?: string; input?: string; timeoutMs?: number } = {}
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    let done = false;

    const finish = (code: number | null) => {
      if (done) return;
      done = true;
      resolve({ code: code ?? -1, stdout, stderr });
    };

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) => {
      if (done) return;
      done = true;
      reject(err);
    });
    child.on("close", (code) => finish(code));

    if (opts.input) {
      child.stdin.write(opts.input);
    }
    child.stdin.end();

    if (opts.timeoutMs && opts.timeoutMs > 0) {
      setTimeout(() => {
        try { child.kill("SIGKILL"); } catch {}
        finish(-1);
      }, opts.timeoutMs).unref();
    }
  });
}

export async function ensureBinary(bin: string): Promise<{ ok: boolean; path?: string; reason?: string }>
{
  const found = await which(bin);
  if (!found) return { ok: false, reason: `Missing binary: ${bin}` };
  return { ok: true, path: found };
}

