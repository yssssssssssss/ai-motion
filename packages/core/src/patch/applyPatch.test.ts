import { expect, it } from "vitest";
import { applyPatchToFiles } from "./applyPatch";
import type { MotionManifest, MotionTarget } from "../manifest/types";

const cases: [MotionTarget, string, string][] = [
  [
    { kind: "html-text", file: "index.html", selector: "[data-motion=price]" },
    '<span data-motion="price">old</span>',
    '<span data-motion="price">VALUE</span>'
  ],
  [
    { kind: "html-attribute", file: "index.html", selector: "[data-motion=price]", attribute: "title" },
    '<span data-motion="price" title="old">old</span>',
    '<span data-motion="price" title="VALUE">old</span>'
  ],
  [
    { kind: "html-attribute", file: "index.html", selector: "[data-motion=price]", attribute: "title" },
    '<span data-motion="price">old</span>',
    '<span data-motion="price" title="VALUE">old</span>'
  ],
  [
    { kind: "css-variable", file: "index.html", selector: ":root", name: "--price" },
    ":root { --price: old; }",
    ":root { --price: VALUE; }"
  ],
  [
    { kind: "css-property", file: "index.html", selector: ".price", property: "content" },
    ".price { content: old; }",
    ".price { content: VALUE; }"
  ]
];

it.each(cases)("treats dollar sequences literally for %j", (target, content, expected) => {
  const manifest: MotionManifest = {
    version: "1.0",
    id: "price",
    name: "Price",
    sourceKind: "single-html",
    runtime: { engine: "html", entry: "index.html", sandbox: "iframe" },
    params: [
      { id: "price", label: "Price", type: "text", default: "old", status: "confirmed", targets: [target] }
    ]
  };
  for (const value of ["$1 off", "$& off", "$` off"]) {
    const result = applyPatchToFiles({
      files: { "index.html": content },
      manifest,
      patch: { id: "patch", sourceManifestId: "price", values: { price: value } }
    });
    expect(result["index.html"]).toBe(
      expected.replace("VALUE", () =>
        target.kind.startsWith("html-") ? value.replaceAll("&", "&amp;") : value
      )
    );
  }
});
