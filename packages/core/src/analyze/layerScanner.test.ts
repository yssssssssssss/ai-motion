import { expect, it } from "vitest";
import { scanSourceForLayers } from "./layerScanner";
import { importMotionSourceFromFiles } from "../index";
import { applyMotionRecipeToComponent } from "../generation/motionRecipe";
import { createReferenceGuidedComponent } from "../generation/referenceGuidedGeneration";
import { applyPatchToFiles } from "../patch/applyPatch";

it("binds a recipe to an uploaded attribute layer without rewriting its content", () => {
  const html = '<main data-motion-root><section data-motion-layer="heroCard">Keep me</section></main>';
  const target = createReferenceGuidedComponent({ brief: "页面", now: 2 }).component;
  target.source = importMotionSourceFromFiles({ "index.html": html }).source;
  target.manifest.params = [];
  target.manifest.layers = scanSourceForLayers(target.source);
  expect(target.manifest.layers).toHaveLength(1);
  expect(target.manifest.layers[0]?.targets).toEqual([
    {
      kind: "html-attribute",
      file: "index.html",
      selector: '[data-motion-layer="heroCard"]',
      attribute: "class"
    }
  ]);
  const source = createReferenceGuidedComponent({ brief: "红色按钮弹动", now: 1 }).component;
  const result = applyMotionRecipeToComponent({
    sourceComponent: source,
    targetComponent: target,
    targetLayerId: "heroCard"
  });
  expect(result.manifest.motionRecipes).toHaveLength(1);
  expect(result.manifest.motionRecipes?.[0]?.targetSelectors).toContain('[data-motion-layer="heroCard"]');
  const text = result.source.files.map((file) => file.content).join("\n");
  expect(text).toContain('[data-motion-layer="heroCard"]');
  expect(text).toContain("animation:");
  expect(text).toContain("Keep me");
  expect(
    applyPatchToFiles({
      files: { "index.html": html },
      manifest: target.manifest,
      patch: { id: "patch", sourceManifestId: target.manifest.id, values: {} }
    })["index.html"]
  ).toBe(html);
});

it("provides selectors and paths for HTML classes and CSS-only layers", () => {
  const layers = scanSourceForLayers({
    id: "upload",
    origin: "imported",
    kind: "html-package",
    entry: "index.html",
    files: [
      { path: "index.html", kind: "html", content: '<div class="hero-card"></div>' },
      { path: "style.css", kind: "css", content: ".poster-layer { background: var(--poster); }" }
    ]
  });
  expect(layers).toHaveLength(2);
  expect(layers[0]?.targets).toEqual([
    { kind: "html-attribute", file: "index.html", selector: ".hero-card", attribute: "class" }
  ]);
  expect(layers[1]?.targets).toEqual([
    { kind: "css-property", file: "style.css", selector: ".poster-layer", property: "background" }
  ]);
});
