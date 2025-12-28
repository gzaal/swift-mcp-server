import { writeFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { getCacheDir, pathExists } from "./cache.js";

export type AppleDocSymbol = {
  identifier: string;
  title: string;
  kind?: string;
  summary?: string;
  snippet?: string;
  url?: string;
  framework?: string;
  topics?: string[];
};

export type FetchResult = {
  success: boolean;
  framework: string;
  symbolsAdded: number;
  errors: string[];
};

const APPLE_DOCS_BASE = "https://developer.apple.com/tutorials/data/documentation";

/**
 * Fetch framework documentation from Apple's JSON API
 */
export async function fetchFrameworkDocs(
  framework: string,
  options: { depth?: number; maxSymbols?: number } = {}
): Promise<FetchResult> {
  const { depth = 2, maxSymbols = 50 } = options;
  const result: FetchResult = { success: false, framework, symbolsAdded: 0, errors: [] };

  try {
    // Fetch top-level framework documentation
    const frameworkUrl = `${APPLE_DOCS_BASE}/${framework.toLowerCase()}.json`;
    const topLevel = await fetchJson(frameworkUrl);

    if (!topLevel) {
      result.errors.push(`Failed to fetch ${frameworkUrl}`);
      return result;
    }

    const symbols: AppleDocSymbol[] = [];
    const visited = new Set<string>();

    // Extract framework metadata
    const frameworkTitle = topLevel?.metadata?.title || framework;

    // Process topic sections at depth 1
    const topicSections = topLevel?.topicSections || [];
    for (const section of topicSections) {
      const identifiers = section?.identifiers || [];
      for (const id of identifiers) {
        if (symbols.length >= maxSymbols) break;
        if (visited.has(id)) continue;
        visited.add(id);

        // Convert identifier to URL path
        const symbolPath = identifierToPath(id);
        if (!symbolPath) continue;

        try {
          const symbolData = await fetchJson(`${APPLE_DOCS_BASE}/${symbolPath}.json`);
          if (symbolData) {
            const symbol = parseSymbolData(symbolData, framework);
            if (symbol) {
              symbols.push(symbol);

              // Depth 2: fetch nested symbols if configured
              if (depth >= 2 && symbols.length < maxSymbols) {
                const nestedSections = symbolData?.topicSections || [];
                for (const nestedSection of nestedSections.slice(0, 3)) {
                  const nestedIds = nestedSection?.identifiers || [];
                  for (const nestedId of nestedIds.slice(0, 5)) {
                    if (symbols.length >= maxSymbols) break;
                    if (visited.has(nestedId)) continue;
                    visited.add(nestedId);

                    const nestedPath = identifierToPath(nestedId);
                    if (!nestedPath) continue;

                    try {
                      const nestedData = await fetchJson(`${APPLE_DOCS_BASE}/${nestedPath}.json`);
                      if (nestedData) {
                        const nestedSymbol = parseSymbolData(nestedData, framework);
                        if (nestedSymbol) symbols.push(nestedSymbol);
                      }
                    } catch {
                      // Skip failed nested fetches
                    }
                    // Rate limit
                    await sleep(100);
                  }
                }
              }
            }
          }
        } catch (e) {
          result.errors.push(`Failed to fetch ${symbolPath}: ${e}`);
        }
        // Rate limit to be respectful
        await sleep(150);
      }
      if (symbols.length >= maxSymbols) break;
    }

    // Save fetched symbols to cache
    if (symbols.length > 0) {
      await saveSymbolsToCache(framework, symbols);
      result.symbolsAdded = symbols.length;
      result.success = true;
    }

    return result;
  } catch (e) {
    result.errors.push(`Framework fetch failed: ${e}`);
    return result;
  }
}

/**
 * Scan a Swift project for import statements
 */
export async function scanProjectImports(projectPath: string): Promise<string[]> {
  const fg = await import("fast-glob");
  const files = await fg.default(["**/*.swift"], {
    cwd: projectPath,
    absolute: true,
    ignore: ["**/Pods/**", "**/Carthage/**", "**/.build/**", "**/DerivedData/**"],
  });

  const imports = new Set<string>();
  for (const file of files) {
    try {
      const content = await readFile(file, "utf8");
      const matches = content.matchAll(/^import\s+(\w+)/gm);
      for (const match of matches) {
        imports.add(match[1]);
      }
    } catch {
      // Skip unreadable files
    }
  }

  // Sort by likely documentation availability
  const priorityFrameworks = [
    "SwiftUI", "AppKit", "UIKit", "Foundation", "Combine",
    "AVFoundation", "CoreData", "CoreImage", "CoreGraphics",
    "MapKit", "Photos", "StoreKit", "CloudKit", "PDFKit",
  ];

  return Array.from(imports).sort((a, b) => {
    const aIdx = priorityFrameworks.indexOf(a);
    const bIdx = priorityFrameworks.indexOf(b);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.localeCompare(b);
  });
}

// Helper functions

async function fetchJson(url: string): Promise<any | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Swift-MCP-Server/0.1",
      },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function identifierToPath(identifier: string): string | null {
  // doc://com.apple.SwiftUI/documentation/SwiftUI/View
  // → swiftui/view
  const match = identifier.match(/documentation\/(.+)$/i);
  if (!match) return null;
  return match[1].toLowerCase();
}

function parseSymbolData(data: any, framework: string): AppleDocSymbol | null {
  const id = data?.identifier?.url;
  const title = data?.metadata?.title || data?.identifier?.title;
  if (!title) return null;

  const kind = data?.metadata?.symbolKind || data?.metadata?.role;
  const abstractNodes = data?.abstract || [];
  const summary = abstractNodes
    .map((n: any) => n?.text || n?.code || "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);

  // Extract declaration snippet
  let snippet: string | undefined;
  const fragments = data?.declarationFragments;
  if (Array.isArray(fragments)) {
    snippet = fragments.map((f: any) => f?.spelling || f?.text || "").join("").trim();
  }

  // Generate web URL
  const docUrl = data?.identifier?.url;
  let url: string | undefined;
  if (docUrl) {
    const pathMatch = docUrl.match(/documentation\/(.+)$/i);
    if (pathMatch) {
      url = `https://developer.apple.com/documentation/${pathMatch[1]}`;
    }
  }

  // Extract topic section titles
  const topicSections = data?.topicSections || [];
  const topics = topicSections.map((s: any) => s?.title).filter(Boolean);

  return {
    identifier: id || title,
    title,
    kind,
    summary: summary || undefined,
    snippet: snippet || undefined,
    url,
    framework,
    topics: topics.length > 0 ? topics : undefined,
  };
}

async function saveSymbolsToCache(framework: string, symbols: AppleDocSymbol[]): Promise<void> {
  const dir = join(getCacheDir(), "apple-docs", framework);
  await mkdir(dir, { recursive: true });

  for (const symbol of symbols) {
    const fileName = symbol.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 50);

    const filePath = join(dir, `${fileName}.json`);

    // Convert to DocC-like format for consistency
    const docData = {
      title: symbol.title,
      identifier: {
        url: symbol.identifier,
        title: symbol.title,
      },
      metadata: {
        title: symbol.title,
        module: { name: framework },
        role: symbol.kind,
      },
      abstract: symbol.summary ? [{ type: "text", text: symbol.summary }] : [],
      declarationFragments: symbol.snippet
        ? [{ spelling: symbol.snippet }]
        : undefined,
      topicSections: symbol.topics?.map((t) => ({ title: t })),
    };

    await writeFile(filePath, JSON.stringify(docData, null, 2), "utf8");
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
