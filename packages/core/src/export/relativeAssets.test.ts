import { describe, expect, it } from "vitest";
import { composeEmbedPackageFiles, composeStandaloneHtmlFile } from "./exportPackage";
import type { MotionManifest } from "../manifest/types";

describe("relative export assets", () => {
  it.each([
    ["bundle/index.html", "./style.css", "./script.js", "bundle/style.css", "bundle/script.js"],
    [
      "bundle/index.html",
      "../shared/x.css?v=1#main",
      "../shared/x.js?v=1#main",
      "shared/x.css",
      "shared/x.js"
    ],
    ["source/index.html", "./style.css?cache=1", "./script.js#main", "source/style.css", "source/script.js"],
    ["index.html", "style.css", "script.js", "source/style.css", "source/script.js"]
  ])("inlines %s assets in standalone and embed exports", (entry, cssRef, jsRef, cssPath, jsPath) => {
    const manifest: MotionManifest = {
      version: "1.0",
      id: "nested",
      name: "嵌套组件",
      sourceKind: "html-package",
      runtime: { engine: "html", entry, sandbox: "iframe" },
      params: []
    };
    const input = {
      manifest,
      metadata: {},
      patch: { id: "patch", sourceManifestId: manifest.id, values: {} },
      sourceFiles: {
        [entry]: `<head><link rel="stylesheet" href="${cssRef}"></head><body><main>组件</main><script src="${jsRef}"></script></body>`,
        [cssPath]: ".nested { color: lime; }",
        [jsPath]: "window.nestedAsset = true;"
      }
    };
    const html = composeStandaloneHtmlFile(input);
    const embed = composeEmbedPackageFiles(input);
    expect(html).toContain(".nested { color: lime; }");
    expect(html).toContain("window.nestedAsset = true;");
    expect(embed["dist/style.css"]).toContain(".nested { color: lime; }");
    expect(embed["dist/iframe.js"]).toContain("window.nestedAsset = true;");
  });
});
