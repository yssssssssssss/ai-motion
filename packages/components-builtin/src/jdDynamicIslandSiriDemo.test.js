import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const currentDir = dirname(fileURLToPath(import.meta.url));
const componentDir = resolve(currentDir, "../jd-dynamic-island-siri-demo");

function readComponentFile(path) {
  return readFileSync(resolve(componentDir, path), "utf8");
}

describe("jd dynamic island siri demo component", () => {
  it("registers the combined notification and weather demo as a distinct feed item", () => {
    const metadata = JSON.parse(readComponentFile("metadata.json"));
    const manifest = JSON.parse(readComponentFile("motion.manifest.json"));
    const html = readComponentFile("source/index.html");

    expect(metadata.id).toBe("jd-dynamic-island-siri-demo");
    expect(metadata.name).toBe("灵动岛组合通知与天气");
    expect(manifest.id).toBe(metadata.id);
    expect(manifest.name).toBe(metadata.name);
    expect(html).toContain("<title>灵动岛组合通知与天气</title>");
    expect(html).toContain('aria-label="灵动岛组合通知与天气"');
  });

  it("rebuilds the video as coded layers instead of a video wrapper", () => {
    const html = readComponentFile("source/index.html");
    const script = readComponentFile("source/script.js");

    expect(html).not.toContain("<video");
    expect(script).not.toContain("HTMLVideoElement");
    expect(html).toContain("data-motion-root");
    expect(html).toContain("dynamic-island");
    expect(html).toContain("siri-notification");
    expect(html).toContain("bottom-toolbar");
    expect(html).toContain("weather-card");
    expect(html).toContain("island-avatar");
    expect(html).toContain("dock-label");
  });

  it("exposes editable timing, position, size, opacity, and shape controls", () => {
    const manifest = JSON.parse(readComponentFile("motion.manifest.json"));
    const paramById = Object.fromEntries(manifest.params.map((param) => [param.id, param]));

    expect(paramById.motionDuration.default).toBe(10800);
    expect(paramById.startDelay.default).toBe(180);
    expect(paramById.islandWidth.default).toBe(286);
    expect(paramById.notificationY.default).toBe(168);
    expect(paramById.notificationWidth.default).toBe(584);
    expect(paramById.weatherCardY.default).toBe(236);
    expect(paramById.weatherCardWidth.default).toBe(560);
    expect(paramById.glowOpacity.default).toBe(0.9);
    expect(paramById.windowRadius.default).toBe(54);
    expect(
      manifest.params.every((param) =>
        param.targets.some((target) => target.kind === "css-variable" && target.name?.startsWith("--"))
      )
    ).toBe(true);
  });

  it("uses the source video artboard and declares required coded layers", () => {
    const style = readComponentFile("source/style.css");
    const manifest = JSON.parse(readComponentFile("motion.manifest.json"));

    expect(style).toContain("--stage-width: 720px;");
    expect(style).toContain("--stage-height: 1556px;");
    expect(style).toContain("width: var(--stage-width);");
    expect(style).toContain("height: var(--stage-height);");
    expect(style).toContain("position: relative;");
    expect(style).not.toContain("position: absolute;\n  left: 50%;\n  top: 50%;");
    expect(style).not.toContain("scale(min(calc(100vw / 720px), calc(100vh / 1556px), 1))");
    expect(style).toContain("@keyframes island-glow");
    expect(style).toContain("@keyframes notification-enter");
    expect(style).toContain("@keyframes island-avatar-cycle");
    expect(style).toContain("@keyframes weather-card-enter");
    expect(style).toContain("@keyframes dock-label-cycle");

    expect(manifest.layers?.map((layer) => layer.id)).toEqual([
      "phone-shell",
      "dynamic-island",
      "siri-notification",
      "bottom-toolbar",
      "weather-card",
      "island-avatar"
    ]);
    expect(manifest.layers.every((layer) => layer.replaceable === false)).toBe(true);
    expect(manifest.layers.every((layer) => layer.required === true)).toBe(true);
  });
});
