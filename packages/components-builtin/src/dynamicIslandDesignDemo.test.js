import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const currentDir = dirname(fileURLToPath(import.meta.url));
const componentDir = resolve(currentDir, "../dynamic-island-design-demo");
const repoRoot = resolve(currentDir, "../../..");

function readComponentFile(path) {
  return readFileSync(resolve(componentDir, path), "utf8");
}

describe("dynamic island design demo component", () => {
  it("registers the zip demo as a builtin feed item", () => {
    const metadata = JSON.parse(readComponentFile("metadata.json"));
    const manifest = JSON.parse(readComponentFile("motion.manifest.json"));

    expect(metadata.id).toBe("dynamic-island-design-demo");
    expect(metadata.name).toBe("灵动岛海浪光矩形展开");
    expect(metadata.tags).toEqual(expect.arrayContaining(["dynamic-island", "siri", "weather"]));
    expect(manifest.id).toBe(metadata.id);
    expect(manifest.runtime.entry).toBe("source/index.html");
    expect(manifest.runtime.dependencies).toEqual(
      expect.arrayContaining([
        { name: "node", version: ">=20" },
        { name: "vite", version: "^5.4.0" }
      ])
    );
    expect(manifest.capabilities).toEqual(expect.arrayContaining(["builtin", "editable", "export-html"]));
  });

  it("preserves the coded timeline and preview playback protocol", () => {
    const html = readComponentFile("source/index.html");
    const style = readComponentFile("source/style.css");
    const script = readComponentFile("source/script.js");

    expect(html).not.toContain("<video");
    expect(html).toContain("data-motion-root");
    expect(html).toContain("dynamic-island");
    expect(html).toContain("siri-dialog");
    expect(html).toContain("weather-card");
    expect(html).toContain("dock");
    expect(style).toContain("--stage-width: 1060px;");
    expect(style).toContain("@keyframes islandActivate");
    expect(style).toContain("@keyframes islandElasticMorph");
    expect(style).toContain("@keyframes islandWaveGlow");
    expect(style).toContain("@keyframes glassWave");
    expect(style).toContain("@keyframes dialogOpen");
    expect(style).toContain("@keyframes weatherCardOpen");
    expect(style).toContain("[data-motion-root].is-playing .dynamic-island");
    expect(script).toContain("window.motionReplay");
    expect(script).toContain("window.motionPause");
    expect(script).toContain("window.motionSeek");
  });

  it("exposes focused visual and layout controls without making coded layers replaceable", () => {
    const manifest = JSON.parse(readComponentFile("motion.manifest.json"));
    const paramIds = manifest.params.map((param) => param.id);

    expect(paramIds).toEqual(
      expect.arrayContaining(["phoneMaxWidth", "accentStart", "accentEnd", "softEasing", "springEasing"])
    );
    expect(
      manifest.params.every((param) =>
        param.targets.some((target) => target.kind === "css-variable" && target.name?.startsWith("--"))
      )
    ).toBe(true);
    expect(manifest.layers.map((layer) => layer.id)).toEqual([
      "phone-shell",
      "dynamic-island",
      "siri-dialog",
      "dock",
      "weather-card"
    ]);
    expect(manifest.layers.every((layer) => layer.replaceable === false)).toBe(true);
  });

  it("renders as a phone-only preview without an internal operation card", () => {
    const html = readComponentFile("source/index.html");
    const style = readComponentFile("source/style.css");

    expect(html).not.toContain("control-panel");
    expect(html).not.toContain("replayButton");
    expect(html).not.toContain("timeline-notes");
    expect(style).not.toContain(".control-panel");
    expect(style).not.toMatch(
      /@media\s*\(max-width:\s*900px\)[\s\S]*?\.app-shell\s*\{[\s\S]*?grid-template-columns:\s*1fr;/
    );
  });

  it("uses liquid glass island states with large rounded rectangle and wave light", () => {
    const style = readComponentFile("source/style.css");

    expect(style).toContain("liquid-glass");
    expect(style).toContain("border-radius: 30px;");
    expect(style).not.toContain("border-radius: 54% 46% 58% 42% / 62% 55% 45% 38%;");
    expect(style).toContain(".island-wave-glow");
    expect(style).not.toContain(".siri-center-glow");
    expect(style).toContain("islandWaveGlow 1.55s");
    expect(style).toContain(".glass-wave");
    expect(style).toContain("animation: glassWave");
    expect(style).toContain("backdrop-filter: blur(22px) saturate(1.7);");
  });

  it("keeps a node/vite restoration check for the original project shape", () => {
    const packageJson = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
    const script = readFileSync(
      resolve(repoRoot, "scripts/verify-dynamic-island-design-demo-node.mjs"),
      "utf8"
    );

    expect(packageJson.scripts["verify:dynamic-island-demo"]).toBe(
      "node scripts/verify-dynamic-island-design-demo-node.mjs"
    );
    expect(script).toContain("apps/web/node_modules/vite/bin/vite.js");
    expect(script).toContain("dynamic-island-design-demo");
    expect(script).toContain("/src/styles.css");
    expect(script).toContain("/src/main.js");
  });
});
