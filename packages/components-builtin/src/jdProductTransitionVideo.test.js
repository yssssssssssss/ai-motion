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
});
