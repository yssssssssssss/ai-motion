import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const currentDir = dirname(fileURLToPath(import.meta.url));
const componentDir = resolve(currentDir, "../jd-popup-feedback-fast");

function readComponentFile(path) {
  return readFileSync(resolve(componentDir, path), "utf8");
}

describe("jd popup feedback fast component", () => {
  it("rebuilds the APNG as coded layers instead of a media wrapper", () => {
    const html = readComponentFile("source/index.html");
    const script = readComponentFile("source/script.js");
    const assets = readComponentFile("source/assets.css");

    expect(html).not.toContain("<video");
    expect(html).not.toContain("<img");
    expect(script).not.toContain("HTMLVideoElement");
    expect(html).toContain("data-motion-root");
    expect(html).toContain("coupon-popup");
    expect(html).toContain("feedback-ripple");
    expect(assets).toContain("--shell-frame: url(\"data:image/webp;base64,");
    expect(assets).toContain("--product-screen: url(\"data:image/webp;base64,");
    expect(assets).toContain("--coupon-popup: url(\"data:image/webp;base64,");
    expect(assets).toContain("product-screen-source: frame_0101_crop_213_222_1118_2417");
    expect(assets).toContain("coupon-popup-source: frame_0001_crop_333_770_874_1134");
  });

  it("uses the APNG canvas, product screen, and quick dismissal timing", () => {
    const style = readComponentFile("source/style.css");

    expect(style).toContain("--stage-width: 1545px;");
    expect(style).toContain("--stage-height: 2868px;");
    expect(style).toContain("aspect-ratio: 1545 / 2868;");
    expect(style).toContain("--window-x: 213px;");
    expect(style).toContain("--window-y: 222px;");
    expect(style).toContain("--window-width: 1118px;");
    expect(style).toContain("--window-height: 2417px;");
    expect(style).toContain("--cycle-duration: 4040ms;");
    expect(style).toContain("--popup-x: 120px;");
    expect(style).toContain("--popup-y: 548px;");
    expect(style).toContain("@keyframes popup-dismiss");
    expect(style).toContain("@keyframes feedback-ripple-pulse");
    expect(style).toContain("40% {");
    expect(style).toContain("43%,");
  });

  it("exposes timing, layout, feedback, and visual controls", () => {
    const manifest = JSON.parse(readComponentFile("motion.manifest.json"));
    const paramById = Object.fromEntries(manifest.params.map((param) => [param.id, param]));

    expect(paramById.cycleDuration.default).toBe(4040);
    expect(paramById.dimOpacity.default).toBe(0.68);
    expect(paramById.dismissScale.default).toBe(0.96);
    expect(paramById.popupWidth.default).toBe(874);
    expect(paramById.popupHeight.default).toBe(1134);
    expect(paramById.couponPopupImage.type).toBe("image");
    expect(paramById.couponPopupImage.default).toBe(null);
    expect(paramById.couponPopupImage.constraints.allowedFileTypes).toEqual([
      "image/png",
      "image/jpeg",
      "image/webp"
    ]);
    expect(paramById.couponPopupImage.targets[0]).toMatchObject({
      file: "source/assets.css",
      name: "--coupon-popup"
    });
    expect(paramById.rippleX.default).toBe(610);
    expect(paramById.rippleY.default).toBe(1829);
    expect(paramById.rippleSize.default).toBe(152);
    expect(paramById.windowRadius.default).toBe(92);
    expect(
      manifest.params.every((param) =>
        param.targets.some((target) => target.kind === "css-variable" && target.name?.startsWith("--"))
      )
    ).toBe(true);
    expect(manifest.layers?.map((layer) => layer.id)).toEqual([
      "shell-frame",
      "screen-window",
      "product-screen",
      "screen-dim",
      "coupon-popup",
      "close-button",
      "feedback-ripple"
    ]);
    expect(manifest.layers.find((layer) => layer.id === "coupon-popup")).toMatchObject({
      replaceable: true,
      paramId: "couponPopupImage"
    });
    expect(manifest.motionSkill).toBeUndefined();
  });
});
