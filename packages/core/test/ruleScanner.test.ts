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

  it("detects low-risk css properties with bounded constraints", () => {
    const params = scanSourceForParams({
      id: "workeasy-card",
      origin: "builtin",
      kind: "builtin-component",
      entry: "source/index.html",
      files: [
        { path: "source/index.html", kind: "html", content: '<div class="card">Card</div>' },
        { path: "source/style.css", kind: "css", content: ".card { opacity: 0.7; font-size: 18px; gap: 12px; width: 200px; height: 120px; }" }
      ]
    });

    expect(params.find((param) => param.id === "cardOpacity")).toMatchObject({
      type: "range",
      constraints: { min: 0, max: 1, step: 0.01 }
    });
    expect(params.find((param) => param.id === "cardFontSize")).toMatchObject({
      type: "range",
      constraints: { unit: "px", min: 0, max: 200, step: 1 }
    });
    expect(params.find((param) => param.id === "cardGap")).toMatchObject({
      type: "range",
      constraints: { unit: "px", min: 0, max: 200, step: 1 }
    });
    expect(params.map((param) => param.id)).not.toContain("cardWidth");
    expect(params.map((param) => param.id)).not.toContain("cardHeight");
  });

  it("does not detect global css property selectors", () => {
    const params = scanSourceForParams({
      id: "workeasy-global",
      origin: "builtin",
      kind: "builtin-component",
      entry: "source/index.html",
      files: [
        { path: "source/index.html", kind: "html", content: "<button>Save</button>" },
        { path: "source/style.css", kind: "css", content: "button { color: #ffffff; }\n.button { color: #111111; }" }
      ]
    });

    const colorTargets = params
      .filter((param) => param.id === "buttonColor")
      .flatMap((param) => param.targets.filter((target) => target.kind === "css-property"));

    expect(colorTargets).toEqual([{ kind: "css-property", file: "source/style.css", selector: ".button", property: "color" }]);
  });

  it("detects safe html and svg attributes on data-motion elements", () => {
    const params = scanSourceForParams({
      id: "import-attributes",
      origin: "imported",
      kind: "single-html",
      entry: "index.html",
      files: [
        {
          path: "index.html",
          kind: "html",
          content: '<img data-motion="heroImage" alt="Hero"><button data-motion="cta" aria-label="Buy now">Buy</button><svg><path data-motion="logoMark" fill="#ffffff" stroke="rgb(0,0,0)" /></svg>'
        }
      ]
    });

    expect(params.find((param) => param.id === "heroImageAlt")).toMatchObject({
      type: "text",
      targets: [{ kind: "html-attribute", file: "index.html", selector: "[data-motion=heroImage]", attribute: "alt" }]
    });
    expect(params.find((param) => param.id === "ctaAriaLabel")).toMatchObject({
      type: "text",
      targets: [{ kind: "html-attribute", file: "index.html", selector: "[data-motion=cta]", attribute: "aria-label" }]
    });
    expect(params.find((param) => param.id === "logoMarkFill")).toMatchObject({
      type: "color",
      targets: [{ kind: "svg-attribute", file: "index.html", selector: "[data-motion=logoMark]", attribute: "fill" }]
    });
    expect(params.find((param) => param.id === "logoMarkStroke")).toMatchObject({
      type: "color",
      targets: [{ kind: "svg-attribute", file: "index.html", selector: "[data-motion=logoMark]", attribute: "stroke" }]
    });
  });
});
