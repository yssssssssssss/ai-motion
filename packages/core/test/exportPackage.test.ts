import { describe, expect, it } from "vitest";
import { composeEditablePackageFiles } from "../src/export/exportPackage";
import type { MotionManifest, MotionPatch } from "../src/manifest/types";

describe("composeEditablePackageFiles", () => {
  it("includes source, manifest, metadata, and patch", () => {
    const manifest: MotionManifest = {
      version: "1.0",
      id: "hero",
      name: "Hero",
      sourceKind: "builtin-component",
      runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
      params: []
    };
    const patch: MotionPatch = { id: "patch", sourceManifestId: "hero", values: {} };

    const files = composeEditablePackageFiles({
      sourceFiles: { "source/index.html": "<h1>Hello</h1>" },
      manifest,
      metadata: { id: "hero", name: "Hero" },
      patch
    });

    expect(files["motion.manifest.json"]).toContain('"id": "hero"');
    expect(files["motion.patch.json"]).toContain('"sourceManifestId": "hero"');
    expect(files["source/index.html"]).toBe("<h1>Hello</h1>");
  });
});
