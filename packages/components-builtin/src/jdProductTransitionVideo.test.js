import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const currentDir = dirname(fileURLToPath(import.meta.url));
const componentDir = resolve(currentDir, "../jd-product-transition-video");

function readComponentFile(path) {
  return readFileSync(resolve(componentDir, path), "utf8");
}

describe("jd product transition code component", () => {
  it("uses coded layers instead of a video element", () => {
    const html = readComponentFile("source/index.html");
    const script = readComponentFile("source/script.js");

    expect(html).not.toContain("<video");
    expect(script).not.toContain("HTMLVideoElement");
    expect(html).toContain("data-motion-root");
    expect(html).toContain("shared-card");
  });

  it("exposes timing, trajectory, and shape parameters", () => {
    const manifest = JSON.parse(readComponentFile("motion.manifest.json"));

    const paramIds = manifest.params.map((param) => param.id);
    expect(paramIds).toEqual(
      expect.arrayContaining([
        "transitionDuration",
        "midX",
        "midY",
        "midScale",
        "endWidth",
        "endHeight",
        "dimOpacity"
      ])
    );

    expect(
      manifest.params.every((param) =>
        param.targets.some((target) => target.kind === "css-variable" && target.name?.startsWith("--"))
      )
    ).toBe(true);
  });

  it("declares generation specs and manageable code layers", () => {
    const manifest = JSON.parse(readComponentFile("motion.manifest.json"));

    expect(manifest.designSpecs?.map((spec) => spec.id)).toEqual(["ecommerce-transition-motion-skill"]);
    expect(manifest.layers?.map((layer) => layer.id)).toEqual([
      "home-frame",
      "detail-frame",
      "screen-dim",
      "shared-card",
      "home-card",
      "detail-card"
    ]);
    expect(manifest.layers.every((layer) => layer.required === true)).toBe(true);
    expect(manifest.layers.filter((layer) => layer.replaceable).map((layer) => layer.id)).toEqual([
      "home-frame",
      "detail-frame",
      "home-card",
      "detail-card"
    ]);
    expect(manifest.layers.find((layer) => layer.id === "home-frame")).toMatchObject({
      paramId: "homeFrameImage"
    });
    expect(manifest.params.map((param) => param.id)).toEqual(
      expect.arrayContaining(["homeFrameImage", "detailFrameImage", "homeCardImage", "detailCardImage"])
    );
    expect(manifest.motionSkill).toBeUndefined();
  });

  it("matches the replacement split-layer artboard and editable geometry", () => {
    const style = readComponentFile("source/style.css");
    const assets = readComponentFile("source/assets.css");
    const manifest = JSON.parse(readComponentFile("motion.manifest.json"));
    const paramById = Object.fromEntries(manifest.params.map((param) => [param.id, param]));

    expect(style).toContain("--stage-width: 750px;");
    expect(style).toContain("--stage-height: 1630px;");
    expect(style).toContain("aspect-ratio: 750 / 1630;");
    expect(style).toContain("--start-x: 16px;");
    expect(style).toContain("--start-y: 854px;");
    expect(style).toContain("--start-width: 352px;");
    expect(style).toContain("--start-height: 510px;");
    expect(style).toContain("--end-x: 20px;");
    expect(style).toContain("--end-y: 88px;");
    expect(style).toContain("--end-width: 708px;");
    expect(style).toContain("--end-height: 1020px;");

    expect(assets).toContain('--home-frame: url("data:image/jpeg;base64,');
    expect(assets).toContain('--home-card: url("data:image/png;base64,');
    expect(assets).toContain('--detail-frame: url("data:image/png;base64,');
    expect(assets).toContain('--detail-card: url("data:image/png;base64,');

    expect(paramById.endWidth.default).toBe(708);
    expect(paramById.endWidth.constraints.max).toBeGreaterThanOrEqual(708);
    expect(paramById.endHeight.default).toBe(1020);
    expect(paramById.endHeight.constraints.max).toBeGreaterThanOrEqual(1020);
    expect(paramById.endY.default).toBe(88);
    expect(paramById.endY.constraints.min).toBeLessThanOrEqual(88);
  });
});
