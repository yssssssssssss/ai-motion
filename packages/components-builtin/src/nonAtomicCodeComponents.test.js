import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const currentDir = dirname(fileURLToPath(import.meta.url));

const componentIds = [
  "jd-front-back-entry-transition",
  "jd-horizontal-switch",
  "jd-popup-feedback-eased",
  "jd-popup-feedback-fast",
  "jd-product-transition-video"
];

function readManifest(componentId) {
  return JSON.parse(
    readFileSync(resolve(currentDir, `../${componentId}/motion.manifest.json`), "utf8")
  );
}

describe("non-atomic code motion components", () => {
  it("keep their own params and layer bindings without atomic motion identity", () => {
    for (const componentId of componentIds) {
      const manifest = readManifest(componentId);
      const paramIds = new Set(manifest.params.map((param) => param.id));
      const replaceableLayers = manifest.layers.filter((layer) => layer.replaceable);

      expect(manifest.motionSkill, componentId).toBeUndefined();
      expect(manifest.tags ?? [], componentId).not.toContain("atomic-motion");
      expect(manifest.useCases ?? [], componentId).not.toContain("atomic-motion");
      expect(manifest.params.length, componentId).toBeGreaterThan(0);
      expect(manifest.layers.length, componentId).toBeGreaterThan(0);
      expect(replaceableLayers.length, componentId).toBeGreaterThan(0);

      for (const layer of replaceableLayers) {
        expect(layer.paramId, `${componentId}:${layer.id}`).toBeTruthy();
        expect(paramIds.has(layer.paramId), `${componentId}:${layer.id}`).toBe(true);
      }
    }
  });
});
