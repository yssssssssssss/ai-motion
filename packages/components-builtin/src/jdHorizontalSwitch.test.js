import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const currentDir = dirname(fileURLToPath(import.meta.url));
const componentDir = resolve(currentDir, "../jd-horizontal-switch");

function readComponentFile(path) {
  return readFileSync(resolve(componentDir, path), "utf8");
}

describe("jd horizontal switch component", () => {
  it("rebuilds the APNG as coded layers instead of a video wrapper", () => {
    const html = readComponentFile("source/index.html");
    const script = readComponentFile("source/script.js");
    const assets = readComponentFile("source/assets.css");

    expect(html).not.toContain("<video");
    expect(html).not.toContain("<img");
    expect(script).not.toContain("HTMLVideoElement");
    expect(html).toContain("data-motion-root");
    expect(html).toContain("screen-window");
    expect(html).toContain("tap-ripple");
    expect(assets).toContain("--shell-frame: url(\"data:image/webp;base64,");
    expect(assets).toContain("--start-screen: url(\"data:image/webp;base64,");
    expect(assets).toContain("--end-screen: url(\"data:image/webp;base64,");
    expect(assets).toContain("--end-nav: url(\"data:image/webp;base64,");
    expect(assets).toContain("start-screen-source: frame_0001_crop_213_222_1118_2417");
    expect(assets).toContain("end-screen-source: frame_0087_crop_213_222_1118_2417");
  });

  it("uses the APNG canvas, screen window, and horizontal slide timing", () => {
    const style = readComponentFile("source/style.css");

    expect(style).toContain("--stage-width: 1545px;");
    expect(style).toContain("--stage-height: 2868px;");
    expect(style).toContain("aspect-ratio: 1545 / 2868;");
    expect(style).toContain("--window-x: 213px;");
    expect(style).toContain("--window-y: 222px;");
    expect(style).toContain("--window-width: 1118px;");
    expect(style).toContain("--window-height: 2417px;");
    expect(style).toContain("--cycle-duration: 3480ms;");
    expect(style).toContain("--slide-distance: 1118px;");
    expect(style).toContain("@keyframes start-screen-slide");
    expect(style).toContain("@keyframes end-screen-slide");
    expect(style).toContain("47% {");
    expect(style).toContain("56%,");
  });

  it("exposes speed, trajectory, tap, and visual controls", () => {
    const manifest = JSON.parse(readComponentFile("motion.manifest.json"));
    const paramById = Object.fromEntries(manifest.params.map((param) => [param.id, param]));

    expect(paramById.cycleDuration.default).toBe(3480);
    expect(paramById.slideDistance.default).toBe(1118);
    expect(paramById.tapX.default).toBe(362);
    expect(paramById.tapY.default).toBe(190);
    expect(paramById.tapSize.default).toBe(112);
    expect(paramById.navOverlayOpacity.default).toBe(1);
    expect(paramById.windowRadius.default).toBe(92);
    expect(
      manifest.params.every((param) =>
        param.targets.some((target) => target.kind === "css-variable" && target.name?.startsWith("--"))
      )
    ).toBe(true);
  });
});
