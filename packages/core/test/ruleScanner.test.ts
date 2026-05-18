import { describe, expect, it } from "vitest";
import { scanSourceForParams } from "../src/analyze/ruleScanner";
import type { MotionSource } from "../src/library/componentLibrary";

const source: MotionSource = {
  id: "import-1",
  origin: "imported",
  kind: "html-package",
  entry: "index.html",
  files: [
    { path: "index.html", kind: "html", content: '<h1 data-motion="headline">Hello</h1>' },
    { path: "style.css", kind: "css", content: ":root { --primary-color: #ff3366; --duration: 800ms; }" }
  ]
};

describe("scanSourceForParams", () => {
  it("detects css variables and data-motion text", () => {
    const params = scanSourceForParams(source);

    expect(params.map((param) => param.id)).toContain("primaryColor");
    expect(params.map((param) => param.id)).toContain("duration");
    expect(params.map((param) => param.id)).toContain("headline");
    expect(params.every((param) => param.status === "detected")).toBe(true);
  });
});
