import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const currentDir = dirname(fileURLToPath(import.meta.url));

function readVariant(id, path) {
  return readFileSync(resolve(currentDir, `../${id}/${path}`), "utf8");
}

describe("jd dynamic island siri video variants", () => {
  it("adds two independently selectable coded variants", () => {
    const variants = [
      {
        id: "jd-dynamic-island-siri-glow-expand",
        name: "灵动岛 Siri 彩色光带",
        duration: 7600,
        className: "glow-expand-demo"
      },
      {
        id: "jd-dynamic-island-siri-control-reveal",
        name: "灵动岛 Siri 控制栏联动",
        duration: 9200,
        className: "control-reveal-demo"
      }
    ];

    for (const variant of variants) {
      const metadata = JSON.parse(readVariant(variant.id, "metadata.json"));
      const manifest = JSON.parse(readVariant(variant.id, "motion.manifest.json"));
      const html = readVariant(variant.id, "source/index.html");
      const style = readVariant(variant.id, "source/style.css");

      expect(metadata.id).toBe(variant.id);
      expect(metadata.name).toBe(variant.name);
      expect(manifest.id).toBe(variant.id);
      expect(manifest.name).toBe(variant.name);
      expect(manifest.params.find((param) => param.id === "motionDuration")?.default).toBe(variant.duration);
      expect(html).not.toContain("<video");
      expect(html).toContain(`<title>${variant.name}</title>`);
      expect(html).toContain(`aria-label="${variant.name}"`);
      expect(html).toContain(variant.className);
      expect(html).toContain("dynamic-island");
      expect(html).toContain("siri-notification");
      expect(style).toContain("--stage-width: 624px;");
      expect(style).toContain("--stage-height: 1120px;");
      expect(style).toContain("--island-collapsed-width");
      expect(style).toContain("--island-expanded-height");
      expect(style).toContain("@keyframes island-shell");
      expect(style).toContain("@keyframes island-glow");
      expect(style).toContain("@keyframes notification-enter");
    }
  });

  it("adds a high fidelity editable replica with coded timeline layers", () => {
    const manifest = JSON.parse(
      readVariant("jd-dynamic-island-siri-reference-replica", "motion.manifest.json")
    );
    const metadata = JSON.parse(readVariant("jd-dynamic-island-siri-reference-replica", "metadata.json"));
    const html = readVariant("jd-dynamic-island-siri-reference-replica", "source/index.html");
    const style = readVariant("jd-dynamic-island-siri-reference-replica", "source/style.css");
    const script = readVariant("jd-dynamic-island-siri-reference-replica", "source/script.js");

    const paramIds = manifest.params.map((param) => param.id);

    expect(metadata.name).toBe("灵动岛 Siri 高保真参考");
    expect(manifest.name).toBe(metadata.name);
    expect(html).not.toContain("<video");
    expect(html).toContain("<title>灵动岛 Siri 高保真参考</title>");
    expect(html).toContain('aria-label="灵动岛 Siri 高保真参考"');
    expect(html).toContain("reference-replica-demo");
    expect(html).toContain("dynamic-island");
    expect(html).toContain("island-light-scan");
    expect(html).toContain("siri-notification");
    expect(html).toContain("bottom-control-dock");
    expect(paramIds).toEqual(
      expect.arrayContaining([
        "motionDuration",
        "startDelay",
        "islandExpandedWidth",
        "islandExpandedHeight",
        "glowOpacity",
        "glowTravel",
        "notificationY",
        "notificationWidth",
        "dockRevealY",
        "motionEasing"
      ])
    );
    expect(style).toContain("--stage-width: 624px;");
    expect(style).toContain("--stage-height: 1120px;");
    expect(style).toContain("@keyframes island-shell-reference");
    expect(style).toContain("@keyframes island-light-scan");
    expect(style).toContain("@keyframes notification-reference-enter");
    expect(style).toContain("@keyframes dock-reference-enter");
    expect(script).toContain("window.motionReplay");
    expect(script).toContain("window.motionSeek");
  });
});
