import { describe, expect, it } from "vitest";
import { confirmValidParams } from "../src/analyze/validator";
import type { MotionParam } from "../src/manifest/types";
import type { MotionSource } from "../src/library/componentLibrary";

const source: MotionSource = {
  id: "source",
  origin: "imported",
  kind: "single-html",
  entry: "index.html",
  files: [
    { path: "index.html", kind: "html", content: '<h1 data-motion="headline">Hello</h1><img data-motion="heroImage" alt="Hero image"><svg><path data-motion="logoMark" fill="#ffffff" /></svg>' },
    {
      path: "style.css",
      kind: "css",
      content: ".button { color: #ffffff; opacity: 0.8; }\n.card { color: #111111; }\nbutton { background-color: #000000; }"
    }
  ]
};

describe("confirmValidParams", () => {
  it("confirms params whose targets exist", () => {
    const params: MotionParam[] = [
      {
        id: "headline",
        label: "Headline",
        type: "text",
        default: "Hello",
        status: "suggested",
        targets: [{ kind: "html-text", file: "index.html", selector: "[data-motion=headline]" }]
      }
    ];

    const result = confirmValidParams({ source, params });
    expect(result.confirmed[0]?.status).toBe("confirmed");
    expect(result.rejected).toHaveLength(0);
  });

  it("rejects params whose targets are missing", () => {
    const params: MotionParam[] = [
      {
        id: "missing",
        label: "Missing",
        type: "text",
        default: "Nope",
        status: "suggested",
        targets: [{ kind: "html-text", file: "index.html", selector: "[data-motion=missing]" }]
      }
    ];

    const result = confirmValidParams({ source, params });
    expect(result.confirmed).toHaveLength(0);
    expect(result.rejected[0]?.status).toBe("rejected");
  });

  it("confirms scoped css properties only when the declaration exists", () => {
    const result = confirmValidParams({
      source,
      params: [
        {
          id: "buttonColor",
          label: "Button color",
          type: "color",
          default: "#ffffff",
          status: "detected",
          targets: [{ kind: "css-property", file: "style.css", selector: ".button", property: "color" }]
        },
        {
          id: "buttonRadius",
          label: "Button radius",
          type: "range",
          default: "8px",
          status: "detected",
          targets: [{ kind: "css-property", file: "style.css", selector: ".button", property: "border-radius" }]
        }
      ]
    });

    expect(result.confirmed.map((param) => param.id)).toEqual(["buttonColor"]);
    expect(result.rejected.map((param) => param.id)).toEqual(["buttonRadius"]);
  });

  it("rejects global css selectors", () => {
    const params: MotionParam[] = [
      {
        id: "buttonBackgroundColor",
        label: "Button background",
        type: "color",
        default: "#000000",
        status: "detected",
        targets: [{ kind: "css-property", file: "style.css", selector: "button", property: "background-color" }]
      }
    ];

    const result = confirmValidParams({ source, params });

    expect(result.confirmed).toHaveLength(0);
    expect(result.rejected[0]?.id).toBe("buttonBackgroundColor");
  });

  it("confirms safe html and svg attributes", () => {
    const result = confirmValidParams({
      source,
      params: [
        {
          id: "heroImageAlt",
          label: "Hero image alt",
          type: "text",
          default: "Hero image",
          status: "detected",
          targets: [{ kind: "html-attribute", file: "index.html", selector: "[data-motion=heroImage]", attribute: "alt" }]
        },
        {
          id: "logoMarkFill",
          label: "Logo mark fill",
          type: "color",
          default: "#ffffff",
          status: "detected",
          targets: [{ kind: "svg-attribute", file: "index.html", selector: "[data-motion=logoMark]", attribute: "fill" }]
        }
      ]
    });

    expect(result.confirmed.map((param) => param.id)).toEqual(["heroImageAlt", "logoMarkFill"]);
  });

  it("rejects unsafe html and svg attributes", () => {
    const result = confirmValidParams({
      source,
      params: [
        {
          id: "heroImageSrc",
          label: "Hero image src",
          type: "text",
          default: "https://example.com/image.png",
          status: "detected",
          targets: [{ kind: "html-attribute", file: "index.html", selector: "[data-motion=heroImage]", attribute: "src" }]
        },
        {
          id: "logoMarkPath",
          label: "Logo mark path",
          type: "text",
          default: "M0 0",
          status: "detected",
          targets: [{ kind: "svg-attribute", file: "index.html", selector: "[data-motion=logoMark]", attribute: "d" }]
        }
      ]
    });

    expect(result.confirmed).toHaveLength(0);
    expect(result.rejected.map((param) => param.id)).toEqual(["heroImageSrc", "logoMarkPath"]);
  });

  it("rejects target kinds that the patcher does not implement", () => {
    const result = confirmValidParams({
      source,
      params: [
        {
          id: "componentLabel",
          label: "Component label",
          type: "text",
          default: "Label",
          status: "detected",
          targets: [{ kind: "component-prop", component: "Button", prop: "label" }]
        },
        {
          id: "jsDuration",
          label: "JS duration",
          type: "duration",
          default: 300,
          status: "detected",
          targets: [{ kind: "js-config", file: "index.html", path: "motion.duration" }]
        }
      ]
    });

    expect(result.confirmed).toHaveLength(0);
    expect(result.rejected.map((param) => param.id)).toEqual(["componentLabel", "jsDuration"]);
  });

  it("rejects css params whose declared type does not match the source value", () => {
    const result = confirmValidParams({
      source,
      params: [
        {
          id: "buttonColorAsText",
          label: "Button color as text",
          type: "text",
          default: "#ffffff",
          status: "detected",
          targets: [{ kind: "css-property", file: "style.css", selector: ".button", property: "color" }]
        },
        {
          id: "buttonOpacityAsColor",
          label: "Button opacity as color",
          type: "color",
          default: 0.8,
          status: "detected",
          targets: [{ kind: "css-property", file: "style.css", selector: ".button", property: "opacity" }]
        }
      ]
    });

    expect(result.confirmed).toHaveLength(0);
    expect(result.rejected.map((param) => param.id)).toEqual(["buttonColorAsText", "buttonOpacityAsColor"]);
  });
});
