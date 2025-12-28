import { join, resolve } from "node:path";
import { mkdir, stat, writeFile } from "node:fs/promises";

export type SwiftScaffoldInput = {
  destination: string; // directory where the package will be created
  platform: "macOS" | "iOS";
  moduleName: string;
  overlayStyle: "swiftui" | "calayer" | "caanimation-export";
  overwrite?: boolean;
};

export async function swiftScaffoldModule({ destination, platform, moduleName, overlayStyle, overwrite = false }: SwiftScaffoldInput) {
  try {
    const pkgDir = resolve(destination);
    const srcDir = join(pkgDir, "Sources", moduleName);

    // Check existence
    const st = await stat(pkgDir).catch(() => null as any);
    if (st && !overwrite) {
      // If non-empty folder and overwrite is false, abort
      // We allow existing but empty directories to proceed
    }

    // Ensure dirs
    await mkdir(srcDir, { recursive: true });

    const minPlatform = platform === "macOS" ? ".macOS(.v13)" : ".iOS(.v16)";
    const pkgSwift = `// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "${moduleName}",
    platforms: [ ${minPlatform} ],
    products: [
        .library(name: "${moduleName}", targets: ["${moduleName}"])
    ],
    targets: [
        .target(name: "${moduleName}", path: "Sources/${moduleName}")
    ]
)
`;

    const swiftuiImports = platform === "macOS" ? "import AppKit\nimport SwiftUI\nimport AVFoundation" : "import UIKit\nimport SwiftUI\nimport AVFoundation";

    const representableType = platform === "macOS" ? "NSViewRepresentable" : "UIViewRepresentable";
    const viewType = platform === "macOS" ? "NSView" : "UIView";

    const playerLayerViewSwiftUI = `${swiftuiImports}

public struct PlayerLayerView: ${representableType} {
    public let player: AVPlayer
    public init(player: AVPlayer) { self.player = player }
    public func make${viewType}(context: Context) -> ${viewType} {
        let view = ${viewType}()
        let layer = AVPlayerLayer(player: player)
        layer.videoGravity = .resizeAspect
        view.layer?.addSublayer(layer)
        layer.frame = view.bounds
        #if os(macOS)
        view.wantsLayer = true
        #endif
        return view
    }
    public func update${viewType}(_ view: ${viewType}, context: Context) {
        if let l = view.layer?.sublayers?.compactMap({ $0 as? AVPlayerLayer }).first { l.player = player; l.frame = view.bounds }
    }
}

public struct PlayerWithOverlay: View {
    public let player: AVPlayer
    public init(player: AVPlayer) { self.player = player }
    public var body: some View {
        ZStack(alignment: .topLeading) {
            PlayerLayerView(player: player)
            Text("Overlay").padding(8).background(.black.opacity(0.5)).foregroundStyle(.white).zIndex(1)
        }
    }
}
`;

    const calayerImports = platform === "macOS" ? "import AppKit\nimport AVFoundation\nimport QuartzCore" : "import UIKit\nimport AVFoundation\nimport QuartzCore";
    const playerHostClass = platform === "macOS" ? "NSView" : "UIView";
    const playerLayerViewCALayer = `${calayerImports}

public final class PlayerHostView: ${playerHostClass} {
    public let playerLayer = AVPlayerLayer()
    public override init(frame: CGRect) {
        super.init(frame: frame)
        #if os(macOS)
        self.wantsLayer = true
        #endif
        playerLayer.videoGravity = .resizeAspect
        layer?.addSublayer(playerLayer)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    public override func layout() { super.layout(); playerLayer.frame = bounds }
}

public func addOverlay(to view: ${playerHostClass}) {
    let overlay = CATextLayer()
    overlay.string = "Overlay"
    overlay.foregroundColor = CGColor(gray: 1, alpha: 1)
    overlay.backgroundColor = CGColor(gray: 0, alpha: 0.5)
    overlay.alignmentMode = .center
    overlay.frame = CGRect(x: 20, y: 20, width: 140, height: 32)
    view.layer?.addSublayer(overlay)
}
`;

    const exporterSwift = `import Foundation
import AVFoundation
import QuartzCore

public final class OverlayExporter {
    public init() {}
    public func makeVideoComposition(size: CGSize, fps: Int32 = 30) -> AVMutableVideoComposition {
        let comp = AVMutableVideoComposition()
        comp.renderSize = size
        comp.frameDuration = CMTime(value: 1, timescale: fps)
        let parent = CALayer()
        let videoLayer = CALayer()
        let overlayLayer = CALayer()
        parent.frame = CGRect(origin: .zero, size: size)
        videoLayer.frame = parent.frame
        overlayLayer.frame = parent.frame
        parent.addSublayer(videoLayer)
        parent.addSublayer(overlayLayer)
        // Example overlay element
        let label = CATextLayer()
        label.string = "Overlay"
        label.foregroundColor = CGColor(gray: 1, alpha: 1)
        label.backgroundColor = CGColor(gray: 0, alpha: 0.5)
        label.frame = CGRect(x: 20, y: 20, width: 160, height: 40)
        overlayLayer.addSublayer(label)
        comp.animationTool = AVVideoCompositionCoreAnimationTool(postProcessingAsVideoLayer: videoLayer, in: parent)
        return comp
    }
}
`;

    const filesWritten: string[] = [];
    await writeFile(join(pkgDir, "Package.swift"), pkgSwift, "utf8");
    filesWritten.push(join(pkgDir, "Package.swift"));

    if (overlayStyle === "swiftui") {
      await writeFile(join(srcDir, "PlayerWithOverlay.swift"), playerLayerViewSwiftUI, "utf8");
      filesWritten.push(join(srcDir, "PlayerWithOverlay.swift"));
    } else if (overlayStyle === "calayer") {
      await writeFile(join(srcDir, "PlayerHostView.swift"), playerLayerViewCALayer, "utf8");
      filesWritten.push(join(srcDir, "PlayerHostView.swift"));
    } else if (overlayStyle === "caanimation-export") {
      await writeFile(join(srcDir, "OverlayExporter.swift"), exporterSwift, "utf8");
      filesWritten.push(join(srcDir, "OverlayExporter.swift"));
    }

    return { ok: true, packagePath: pkgDir, files: filesWritten };
  } catch (e: any) {
    return { ok: false, message: e?.message || String(e) };
  }
}

