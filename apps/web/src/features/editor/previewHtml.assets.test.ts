import { describe, expect, it } from "vitest";
import type { MotionManifest, MotionSource } from "@motion-tool/core";
import { renderPreviewHtml } from "./previewHtml";

function preview(entry: string, files: Record<string, string>, origin: MotionSource["origin"] = "generated") {
  const source: MotionSource = {
    id: "nested",
    origin,
    kind: "html-package",
    entry,
    files: Object.entries(files).map(([path, content]) => ({ path, content, kind: "html" }))
  };
  const manifest: MotionManifest = {
    version: "1.0",
    id: "nested",
    name: "嵌套组件",
    sourceKind: source.kind,
    runtime: { engine: "html", entry, sandbox: "iframe" },
    params: []
  };
  return renderPreviewHtml({
    source,
    manifest,
    patch: { id: "patch", sourceManifestId: "nested", values: {} }
  });
}

describe("relative preview assets", () => {
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
  ])("resolves assets relative to %s", (entry, cssRef, jsRef, cssPath, jsPath) => {
    const html = preview(entry, {
      [entry]: `<link rel="stylesheet" href="${cssRef}"><script src="${jsRef}"></script>`,
      [cssPath]: ".nested { color: lime; }",
      [jsPath]: "window.nestedAsset = true;"
    });
    expect(html).toContain("<style>.nested { color: lime; }</style>");
    expect(html).toContain("<script>window.nestedAsset = true;</script>");
  });

  it.each(["generated", "builtin", "imported"] as const)(
    "empties remote and missing assets for %s previews without escaping the package root",
    (origin) => {
      const tags = [
        '<link rel="stylesheet" href="https://example.test/style.css">',
        '<script src="data:text/javascript,window.external=true"></script>',
        '<link rel="stylesheet" href="../../secret.css">',
        '<script src="missing.js"></script>',
        '<script src="https://example.test/script.js"></script>',
        '<link rel="stylesheet" href="missing.css">'
      ];
      const html = preview(
        "bundle/index.html",
        {
          "bundle/index.html": tags.join(""),
          "../../secret.css": "SHOULD_NOT_INLINE"
        },
        origin
      );
      for (const tag of tags) expect(html).not.toContain(tag);
      for (const reference of [
        "https://example.test",
        "data:text/javascript",
        "../../secret.css",
        "missing.js",
        "missing.css"
      ]) {
        expect(html).not.toContain(reference);
      }
      expect(html).toContain("<style></style>");
      expect(html).toContain("<script></script>");
      expect(html).not.toContain("SHOULD_NOT_INLINE");
    }
  );
});
