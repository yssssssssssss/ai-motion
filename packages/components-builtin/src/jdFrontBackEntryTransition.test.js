import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const currentDir = dirname(fileURLToPath(import.meta.url));
const componentDir = resolve(currentDir, "../jd-front-back-entry-transition");

function readComponentFile(path) {
  return readFileSync(resolve(componentDir, path), "utf8");
}

describe("jd front back entry transition component", () => {
  it("rebuilds the APNG transition as coded layers", () => {
    const html = readComponentFile("source/index.html");
    const script = readComponentFile("source/script.js");
    const assets = readComponentFile("source/assets.css");

    expect(html).not.toContain("<video");
    expect(html).not.toContain("<img");
    expect(script).not.toContain("HTMLVideoElement");
    expect(html).toContain("data-motion-root");
    expect(html).toContain("screen-window");
    expect(assets).toContain("--shell-frame: url(\"data:image/webp;base64,");
    expect(assets).toContain("--mine-content: url(\"data:image/webp;base64,");
    expect(assets).toContain("--orders-content: url(\"data:image/webp;base64,");
    expect(assets).toContain("shell-frame-source: frame_0001_shell_window_213_222_1118_2417");
    expect(assets).toContain("mine-content-source: frame_0001_crop_213_222_1118_2417");
    expect(assets).toContain("orders-content-source: frame_0066_crop_213_222_1118_2417");
  });

  it("uses the APNG canvas and extracted screen window geometry", () => {
    const style = readComponentFile("source/style.css");

    expect(style).toContain("--stage-width: 1545px;");
    expect(style).toContain("--stage-height: 2868px;");
    expect(style).toContain("aspect-ratio: 1545 / 2868;");
    expect(style).toContain("--window-x: 213px;");
    expect(style).toContain("--window-y: 222px;");
    expect(style).toContain("--window-width: 1118px;");
    expect(style).toContain("--window-height: 2417px;");
    expect(style).toContain("@keyframes orders-enter");
    expect(style).toContain("@keyframes mine-exit");
    expect(style).toContain("39% {");
    expect(style).toContain("53%,");
  });

  it("exposes timing, trajectory, and fade controls", () => {
    const manifest = JSON.parse(readComponentFile("motion.manifest.json"));
    const paramById = Object.fromEntries(manifest.params.map((param) => [param.id, param]));

    expect(paramById.cycleDuration.default).toBe(2640);
    expect(paramById.enterDistance.default).toBe(520);
    expect(paramById.exitDistance.default).toBe(-520);
    expect(paramById.ordersContentImage.type).toBe("image");
    expect(paramById.ordersContentImage.default).toBe(null);
    expect(paramById.ordersContentImage.constraints.allowedFileTypes).toEqual([
      "image/png",
      "image/jpeg",
      "image/webp"
    ]);
    expect(paramById.ordersContentImage.targets[0]).toMatchObject({
      file: "source/assets.css",
      name: "--orders-content"
    });
    expect(paramById.transitionOpacity.default).toBe(0.72);
    expect(paramById.windowRadius.default).toBe(92);
    expect(
      manifest.params.every((param) =>
        param.targets.some((target) => target.kind === "css-variable" && target.name?.startsWith("--"))
      )
    ).toBe(true);
    expect(manifest.layers?.map((layer) => layer.id)).toEqual([
      "shell-frame",
      "screen-window",
      "mine-content",
      "orders-content",
      "screen-wash"
    ]);
    expect(manifest.layers.find((layer) => layer.id === "orders-content")).toMatchObject({
      replaceable: true,
      paramId: "ordersContentImage"
    });
    expect(manifest.motionSkill).toBeUndefined();
  });
});
