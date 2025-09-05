import { runCommand, which } from "../utils/exec.js";

export type LintRunInput = { path?: string; configPath?: string; strict?: boolean };

export async function lintRun({ path = ".", configPath, strict = false }: LintRunInput) {
  const swiftlint = await which("swiftlint");
  if (!swiftlint) {
    return {
      ok: false,
      message: "SwiftLint not found. Install via `brew install swiftlint` or ensure it's on PATH.",
    };
  }

  const args = ["lint", "--quiet", "--reporter", "json"];
  if (configPath) args.push("--config", configPath);
  // SwiftLint expects paths as positional args at the end (can be file or directory)
  if (path) args.push(path);
  const res = await runCommand(swiftlint, args, { timeoutMs: strict ? 60_000 : 30_000 });
  const ok = res.code === 0 || res.code === 2; // SwiftLint uses 2 when violations found
  return { ok, code: res.code, stdout: res.stdout, stderr: res.stderr };
}
