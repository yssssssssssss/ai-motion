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

  it("detects direct WorkEasy css colors and durations", () => {
    const params = scanSourceForParams({
      id: "workeasy-buttons-1-button",
      origin: "builtin",
      kind: "builtin-component",
      entry: "source/index.html",
      files: [
        { path: "source/index.html", kind: "html", content: '<button class="button">Save</button>' },
        {
          path: "source/style.css",
          kind: "css",
          content: ".button { color: #ffffff; background-color: rgb(12,12,12); transition-duration: 0.3s; border-radius: 40px; }"
        }
      ]
    });

    expect(params.map((param) => param.id)).toContain("buttonColor");
    expect(params.map((param) => param.id)).toContain("buttonBackgroundColor");
    expect(params.map((param) => param.id)).toContain("buttonTransitionDuration");
    expect(params.map((param) => param.id)).toContain("buttonBorderRadius");
  });
});
