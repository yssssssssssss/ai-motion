import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const currentDir = dirname(fileURLToPath(import.meta.url));
const componentDir = resolve(currentDir, "../dynamic-island-design-demo-apple-fidelity-slim");

function readComponentFile(path) {
  return readFileSync(resolve(componentDir, path), "utf8");
}

describe("dynamic island apple fidelity slim component", () => {
  it("registers the apple fidelity slim demo as a distinct builtin feed item", () => {
    const metadata = JSON.parse(readComponentFile("metadata.json"));
    const manifest = JSON.parse(readComponentFile("motion.manifest.json"));

    expect(metadata.id).toBe("dynamic-island-design-demo-apple-fidelity-slim");
    expect(metadata.name).toBe("灵动岛 Apple 高保真纤薄版");
    expect(metadata.tags).toEqual(
      expect.arrayContaining(["dynamic-island", "apple-fidelity", "liquid-glass"])
    );
    expect(manifest.id).toBe(metadata.id);
    expect(manifest.name).toBe(metadata.name);
    expect(manifest.runtime.entry).toBe("source/index.html");
    expect(manifest.capabilities).toEqual(expect.arrayContaining(["builtin", "editable", "export-html"]));
  });

  it("preserves the uploaded slim animation as self-contained coded layers", () => {
    const html = readComponentFile("source/index.html");
    const style = readComponentFile("source/style.css");
    const script = readComponentFile("source/script.js");

    expect(html).not.toContain("<video");
    expect(html).not.toContain("control-panel");
    expect(html).not.toContain("replayButton");
    expect(html).toContain("data-motion-root");
    expect(html).toContain("dynamic-island-host");
    expect(html).toContain("siriCanvas");
    expect(html).toContain("waveCanvas");
    expect(style).toContain("--stage-width: 1060px;");
    expect(style).toContain("backdrop-filter: blur(30px) saturate(165%)");
    expect(style).toContain(".bottom-wave-wrap");
    expect(script).toContain("createSiriLightRenderer");
    expect(script).toContain("createBottomWaveRenderer");
    expect(script).not.toContain("from 'gsap'");
    expect(script).not.toContain("import ");
  });

  it("exposes focused controls and playback protocol for feeds and editor preview", () => {
    const manifest = JSON.parse(readComponentFile("motion.manifest.json"));
    const script = readComponentFile("source/script.js");
    const paramIds = manifest.params.map((param) => param.id);

    expect(paramIds).toEqual(
      expect.arrayContaining(["phoneMaxWidth", "shellWidth", "shellHeight", "cardWidth", "glowIntensity"])
    );
    expect(manifest.layers.map((layer) => layer.id)).toEqual([
      "phone-shell",
      "dynamic-island",
      "siri-light-canvas",
      "siri-response-card",
      "bottom-wave-canvas",
      "dock",
      "weather-card"
    ]);
    expect(script).toContain("window.motionReplay");
    expect(script).toContain("window.motionPause");
    expect(script).toContain("window.motionSeek");
  });
});
