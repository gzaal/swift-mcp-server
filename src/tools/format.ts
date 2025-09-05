import { runCommand, which } from "../utils/exec.js";

export type FormatApplyInput = { code: string; swiftVersion?: string; assumeFilepath?: string };

export async function formatApply({ code, swiftVersion = "6", assumeFilepath = "input.swift" }: FormatApplyInput) {
  // Prefer Apple's swift-format (no swift version flag)
  const swiftFormat = await which("swift-format");
  if (swiftFormat) {
    // Use stdin without explicit '-' to avoid CLI quirk, but include assume-filename
    const res = await runCommand(
      swiftFormat,
      ["format", "--assume-filename", assumeFilepath],
      { input: code, timeoutMs: 20_000 }
    );
    if (res.code === 0) {
      return { ok: true, tool: "swift-format", formatted: res.stdout };
    }
  }

  // Fallback to Nick Lockwood's SwiftFormat
  const swiftformat = await which("swiftformat");
  if (swiftformat) {
    const res = await runCommand(swiftformat, ["--stdin", "--quiet", "--swiftversion", swiftVersion], { input: code, timeoutMs: 20_000 });
    if (res.code === 0) {
      return { ok: true, tool: "SwiftFormat", formatted: res.stdout };
    }
  }

  return { ok: false, message: "No formatter found (swift-format or swiftformat). Install one and try again." };
}
