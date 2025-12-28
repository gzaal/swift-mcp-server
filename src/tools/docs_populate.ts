import { z } from "zod";
import { fetchFrameworkDocs, scanProjectImports } from "../utils/docs_fetcher.js";
import { buildUnifiedIndex, saveUnifiedIndex } from "../utils/hybrid_index.js";
import { buildAppleDocsIndex, saveAppleDocsIndex } from "../utils/apple_index.js";

export const DocsPopulateSchema = z.object({
  frameworks: z.array(z.string()).optional(),
  projectPath: z.string().optional(),
  depth: z.number().min(1).max(3).optional(),
  maxPerFramework: z.number().min(10).max(200).optional(),
  rebuildIndex: z.boolean().optional(),
});

export type DocsPopulateInput = z.infer<typeof DocsPopulateSchema>;

export type DocsPopulateResult = {
  frameworks: Array<{
    name: string;
    symbolsAdded: number;
    success: boolean;
    errors?: string[];
  }>;
  totalSymbols: number;
  indexRebuilt: boolean;
  projectImports?: string[];
};

/**
 * Populate Apple documentation by fetching from developer.apple.com
 *
 * Can either:
 * 1. Fetch specific frameworks by name
 * 2. Auto-detect frameworks from a Swift project
 */
export async function docsPopulate(input: DocsPopulateInput): Promise<DocsPopulateResult> {
  const {
    frameworks: specifiedFrameworks,
    projectPath,
    depth = 2,
    maxPerFramework = 50,
    rebuildIndex = true,
  } = input;

  const result: DocsPopulateResult = {
    frameworks: [],
    totalSymbols: 0,
    indexRebuilt: false,
  };

  // Determine which frameworks to fetch
  let frameworksToFetch: string[] = [];

  if (specifiedFrameworks && specifiedFrameworks.length > 0) {
    frameworksToFetch = specifiedFrameworks;
  } else if (projectPath) {
    // Scan project for imports
    const imports = await scanProjectImports(projectPath);
    result.projectImports = imports;

    // Prioritize frameworks that are likely to have good documentation
    const documentedFrameworks = [
      "SwiftUI", "AppKit", "UIKit", "Foundation", "Combine",
      "AVFoundation", "CoreData", "CoreImage", "CoreGraphics",
      "MapKit", "Photos", "PhotosUI", "StoreKit", "CloudKit",
      "PDFKit", "CoreLocation", "AVKit", "Metal", "SpriteKit",
      "SceneKit", "ARKit", "RealityKit", "HealthKit", "HomeKit",
      "EventKit", "Contacts", "Messages", "Social", "GameKit",
      "WatchKit", "ClockKit", "WidgetKit", "ActivityKit",
      "UniformTypeIdentifiers", "QuickLook", "Vision", "NaturalLanguage",
      "CoreML", "CreateML", "Speech", "SoundAnalysis", "CoreAudio",
      "Security", "CryptoKit", "LocalAuthentication", "AuthenticationServices",
    ];

    frameworksToFetch = imports.filter(fw =>
      documentedFrameworks.some(df => df.toLowerCase() === fw.toLowerCase())
    );

    // Limit to top 10 to avoid excessive fetching
    frameworksToFetch = frameworksToFetch.slice(0, 10);
  } else {
    // Default to common frameworks
    frameworksToFetch = ["SwiftUI", "Foundation", "AppKit"];
  }

  // Fetch each framework
  for (const framework of frameworksToFetch) {
    console.log(`Fetching ${framework} documentation...`);

    const fetchResult = await fetchFrameworkDocs(framework, {
      depth,
      maxSymbols: maxPerFramework,
    });

    result.frameworks.push({
      name: framework,
      symbolsAdded: fetchResult.symbolsAdded,
      success: fetchResult.success,
      errors: fetchResult.errors.length > 0 ? fetchResult.errors : undefined,
    });

    result.totalSymbols += fetchResult.symbolsAdded;
  }

  // Rebuild indexes if requested and we added symbols
  if (rebuildIndex && result.totalSymbols > 0) {
    try {
      // Rebuild Apple docs index
      const appleIndex = await buildAppleDocsIndex();
      if (appleIndex) {
        await saveAppleDocsIndex(appleIndex.index);
      }

      // Rebuild unified/hybrid index
      const hybridIndex = await buildUnifiedIndex();
      if (hybridIndex) {
        await saveUnifiedIndex(hybridIndex.index);
      }

      result.indexRebuilt = true;
    } catch (e) {
      console.error("Failed to rebuild indexes:", e);
    }
  }

  return result;
}

/**
 * Quick scan of a project to see which frameworks are used
 */
export async function projectScan(projectPath: string): Promise<{ frameworks: string[]; count: number }> {
  const imports = await scanProjectImports(projectPath);
  return { frameworks: imports, count: imports.length };
}
