import { describe, expect, it } from "vitest";
import { validateGenerationDiff } from "../src/orchestrator/generationDiff";

const allowed = {
  paramIds: ["duration"],
  layerIds: ["heroImage"],
  sourceFiles: ["source/style.css"],
  sourceTargetKinds: ["css-variable"]
} as const;

describe("validateGenerationDiff", () => {
  it("accepts patches, layer replacements, and source edits inside the candidate whitelist", () => {
    const result = validateGenerationDiff({
      allowed,
      patchValues: { duration: 720 },
      layerReplacements: { heroImage: "data:image/png;base64,AAAA" },
      beforeFiles: { "source/style.css": ":root { --duration: 600ms; }" },
      afterFiles: { "source/style.css": ":root { --duration: 720ms; }" }
    });

    expect(result.valid).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("rejects any generated change outside params, layers, or source files", () => {
    const result = validateGenerationDiff({
      allowed,
      patchValues: { duration: 720, unsafeOpacity: 0.5 },
      layerReplacements: { heroImage: "ok", secretLayer: "bad" },
      beforeFiles: {
        "source/style.css": ":root { --duration: 600ms; }",
        "source/script.js": "window.ok = true;"
      },
      afterFiles: {
        "source/style.css": ":root { --duration: 720ms; }",
        "source/script.js": "window.evil = true;"
      }
    });

    expect(result.valid).toBe(false);
    expect(result.violations.map((item) => item.code)).toEqual([
      "param-not-whitelisted",
      "layer-not-whitelisted",
      "source-file-not-whitelisted"
    ]);
  });
});
