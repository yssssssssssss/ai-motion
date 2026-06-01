import { describe, expect, it } from "vitest";
import type { MotionSource } from "../src/library/componentLibrary";
import { scanSourceForLayers } from "../src/analyze/layerScanner";

const source: MotionSource = {
  id: "imported",
  origin: "imported",
  kind: "html-package",
  entry: "index.html",
  files: [
    {
      path: "index.html",
      kind: "html",
      content:
        '<main data-motion-root><img data-motion-layer="heroPoster" alt="Hero"><h1 data-motion-layer="headline">Sale</h1><div class="card-layer"></div></main>'
    },
    {
      path: "style.css",
      kind: "css",
      content:
        ".card-layer { background-image: var(--card-image); animation: reveal 800ms both; } .stage-shell { position: relative; }"
    }
  ]
};

describe("scanSourceForLayers", () => {
  it("detects explicit data-motion-layer and class-based layer candidates", () => {
    const layers = scanSourceForLayers(source);

    expect(layers.map((layer) => layer.id)).toEqual(["heroPoster", "headline", "card-layer"]);
    expect(layers.find((layer) => layer.id === "heroPoster")).toMatchObject({
      kind: "image",
      label: "heroPoster",
      replaceable: true,
      required: false
    });
    expect(layers.find((layer) => layer.id === "headline")).toMatchObject({
      kind: "text",
      replaceable: true
    });
    expect(layers.find((layer) => layer.id === "card-layer")).toMatchObject({
      kind: "image",
      replaceable: false
    });
  });

  it("returns an empty list when no layer-like source exists", () => {
    expect(
      scanSourceForLayers({
        ...source,
        files: [{ path: "index.html", kind: "html", content: "<main><p>Hello</p></main>" }]
      })
    ).toEqual([]);
  });
});
