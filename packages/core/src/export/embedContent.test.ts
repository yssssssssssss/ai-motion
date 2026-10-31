import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { composeEmbedPackageFiles } from "./exportPackage";
import type { MotionManifest } from "../manifest/types";

const manifest: MotionManifest = {
  version: "1.0",
  id: "widget",
  name: "组件",
  sourceKind: "html-package",
  runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
  params: []
};

function embed(html: string, files: Record<string, string> = {}) {
  return composeEmbedPackageFiles({
    sourceFiles: { "source/index.html": html, ...files },
    manifest,
    metadata: { id: "widget", name: "组件" },
    patch: { id: "patch", sourceManifestId: manifest.id, values: {} }
  });
}

describe("embed document content", () => {
  it("preserves linked-only package bytes outside the iframe runtime", () => {
    const files = embed(
      '<html><head><link rel="stylesheet" href="./style.css"></head><body><main data-motion-root>组件</main><script src="./script.js"></script></body></html>',
      {
        "source/style.css": "body { background: #123; } main { color: red; }",
        "source/script.js": "window.motionReplay = () => {};"
      }
    );
    expect(Object.keys(files).length).toBeGreaterThan(10);
    expect(
      createHash("sha256")
        .update(
          JSON.stringify(
            Object.fromEntries(Object.entries(files).filter(([path]) => path !== "dist/iframe.js"))
          )
        )
        .digest("hex")
    ).toMatchInlineSnapshot(`"cf214bb200b23dcb1a9eb4bb5da6d76c8198f00e1ebde8aa0697422e048806d4"`);
  });

  it("collects inline and linked styles from head and body in document order", () => {
    const files = embed(
      '<head><style>body { background: red; } .first { color: red; }</style><link rel="stylesheet" href="./style.css"></head><body><main>组件</main><style>.last { color: blue; }</style></body>',
      { "source/style.css": ".middle { color: green; }" }
    );
    const css = String(files["dist/style.css"]);
    expect(css).toContain("body { background: transparent; }");
    expect(css).toContain(".first { color: red; }");
    expect(css).toContain(".middle { color: green; }");
    expect(css).toContain(".last { color: blue; }");
    expect(css.indexOf(".first")).toBeLessThan(css.indexOf(".middle"));
    expect(css.indexOf(".middle")).toBeLessThan(css.indexOf(".last"));
    expect(files["dist/iframe.css"]).toBe(css);
    expect(files["dist/iframe.html"]).toContain("<main>组件</main>");
    expect(files["dist/iframe.html"]).not.toContain("<style>");
  });

  it("collects classic scripts in order and preserves data scripts without executing them", () => {
    const files = embed(
      '<head><script>window.first = 1;</script><script type="application/json" id="config">{"value":"HEAD_DATA"}</script></head><body><script src="./script.js"></script><main>组件</main><script type="text/javascript">window.last = 3;</script><script type="application/json">{"value":"BODY_DATA"}</script><script type="text/x-template">TEMPLATE_DATA</script></body>',
      { "source/script.js": "window.middle = 2;" }
    );
    const js = String(files["dist/iframe.js"]);
    expect(js).toContain("window.first = 1;");
    expect(js).toContain("window.middle = 2;");
    expect(js).toContain("window.last = 3;");
    expect(js.indexOf("window.first")).toBeLessThan(js.indexOf("window.middle"));
    expect(js.indexOf("window.middle")).toBeLessThan(js.indexOf("window.last"));
    for (const data of ["HEAD_DATA", "BODY_DATA", "TEMPLATE_DATA"]) {
      expect(files["dist/iframe.html"]).toContain(data);
      expect(js).not.toContain(data);
    }
    expect(files["dist/iframe.html"]).not.toContain("window.last");
  });

  it("skips inline and linked modules and reports both losses", () => {
    const files = embed(
      '<body><main>组件</main><script type="module">import "INLINE_MODULE";</script><script type=module src="./module.js"></script><script>window.classic = true;</script></body>',
      { "source/module.js": 'import "LINKED_MODULE";' }
    );
    expect(files["dist/iframe.js"]).toContain("window.classic = true;");
    expect(files["dist/iframe.js"]).not.toContain("INLINE_MODULE");
    expect(files["dist/iframe.js"]).not.toContain("LINKED_MODULE");
    expect(files["dist/iframe.html"]).toContain("<main>组件</main>");
    expect(files["dist/iframe.html"]).not.toContain("type=module");
    const metadata = JSON.parse(String(files["manifest.json"]));
    expect(metadata.warnings).toHaveLength(2);
    expect(metadata.warnings[0]).toMatchObject({ code: "module-script-skipped" });
    expect(files["README.md"]).toContain("type=module");
    expect(files["README.md"]).toContain("./module.js");
  });

  it("leaves style markup inside data scripts untouched and out of the stylesheet", () => {
    const template =
      '<script type="text/x-template"><style>.template-only { color: red; }</style><main>模板</main></script>';
    const files = embed(`<body><style>.actual { color: blue; }</style>${template}<main>组件</main></body>`);
    expect(files["dist/iframe.html"]).toContain(template);
    expect(files["dist/style.css"]).toContain(".actual { color: blue; }");
    expect(files["dist/style.css"]).not.toContain(".template-only");
    expect(files["dist/iframe.js"]).not.toContain(".template-only");
  });
});
