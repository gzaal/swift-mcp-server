import fg from "fast-glob";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { getCacheDir, pathExists } from "./cache.js";

export type TSPLRecord = {
  _id: string;
  source: "tspl";
  title: string;
  chapter: string;
  section?: string;
  summary: string;
  snippet?: string;
  path: string;
  url?: string;
};

/**
 * Parse TSPL markdown files into searchable records.
 * Extracts chapters, sections, code examples, and key content.
 */
export async function parseTSPLFiles(): Promise<TSPLRecord[]> {
  const base = join(getCacheDir(), "swift-book", "TSPL.docc");
  if (!(await pathExists(base))) return [];

  const files = await fg(["**/*.md"], { cwd: base, absolute: true });
  const records: TSPLRecord[] = [];
  const seen = new Set<string>();

  for (const f of files) {
    try {
      const content = await readFile(f, "utf8");
      const parsed = parseMarkdownFile(f, content);
      for (const rec of parsed) {
        if (seen.has(rec._id)) continue;
        seen.add(rec._id);
        records.push(rec);
      }
    } catch {
      // Skip unreadable files
    }
  }

  return records;
}

function parseMarkdownFile(filePath: string, content: string): TSPLRecord[] {
  const records: TSPLRecord[] = [];
  const fileName = filePath.split("/").pop()?.replace(".md", "") || "unknown";

  // Determine chapter from path
  const pathParts = filePath.split("/");
  const doccIdx = pathParts.indexOf("TSPL.docc");
  const chapter = doccIdx !== -1 && pathParts[doccIdx + 1]
    ? pathParts[doccIdx + 1]
    : "General";

  // Extract title from first # heading
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const mainTitle = titleMatch ? titleMatch[1].trim() : fileName;

  // Generate swift.org URL
  const urlSlug = fileName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const chapterSlug = chapter.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const url = `https://docs.swift.org/swift-book/documentation/the-swift-programming-language/${urlSlug}`;

  // Extract introduction/overview (first paragraph after title)
  const introMatch = content.match(/^#\s+.+\n\n([\s\S]*?)(?=\n##|\n```|$)/);
  const intro = introMatch
    ? introMatch[1].replace(/\s+/g, " ").trim().slice(0, 500)
    : "";

  // Extract first code example
  const codeMatch = content.match(/```swift\n([\s\S]*?)```/);
  const snippet = codeMatch ? codeMatch[1].trim().slice(0, 500) : undefined;

  // Create main chapter record
  records.push({
    _id: `tspl|${chapter}|${fileName}`,
    source: "tspl",
    title: mainTitle,
    chapter,
    summary: intro || `Swift Programming Language: ${mainTitle}`,
    snippet,
    path: filePath,
    url,
  });

  // Extract H2 sections for more granular search
  const sectionRegex = /^##\s+(.+)$/gm;
  let match;
  while ((match = sectionRegex.exec(content)) !== null) {
    const sectionTitle = match[1].trim();
    const sectionStart = match.index;

    // Find content until next heading
    const nextHeading = content.slice(sectionStart).search(/\n##?\s/);
    const sectionEnd = nextHeading !== -1
      ? sectionStart + nextHeading
      : content.length;
    const sectionContent = content.slice(sectionStart, sectionEnd);

    // Extract section summary (first paragraph)
    const summaryMatch = sectionContent.match(/^##\s+.+\n\n([\s\S]*?)(?=\n###|\n```|\n\n|$)/);
    const sectionSummary = summaryMatch
      ? summaryMatch[1].replace(/\s+/g, " ").trim().slice(0, 300)
      : "";

    // Extract code from section
    const sectionCodeMatch = sectionContent.match(/```swift\n([\s\S]*?)```/);
    const sectionSnippet = sectionCodeMatch
      ? sectionCodeMatch[1].trim().slice(0, 400)
      : undefined;

    if (sectionSummary || sectionSnippet) {
      const sectionId = sectionTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      records.push({
        _id: `tspl|${chapter}|${fileName}|${sectionId}`,
        source: "tspl",
        title: sectionTitle,
        chapter,
        section: mainTitle,
        summary: sectionSummary || `${mainTitle}: ${sectionTitle}`,
        snippet: sectionSnippet,
        path: filePath,
        url: `${url}#${sectionId}`,
      });
    }
  }

  return records;
}

/**
 * Get count of parseable TSPL files
 */
export async function getTSPLStats(): Promise<{ fileCount: number; estimatedRecords: number }> {
  const base = join(getCacheDir(), "swift-book", "TSPL.docc");
  if (!(await pathExists(base))) return { fileCount: 0, estimatedRecords: 0 };

  const files = await fg(["**/*.md"], { cwd: base, absolute: true });
  // Estimate ~3 records per file (main + 2 sections avg)
  return { fileCount: files.length, estimatedRecords: files.length * 3 };
}
