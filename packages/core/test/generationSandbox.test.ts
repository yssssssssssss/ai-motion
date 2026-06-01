import { describe, expect, it } from "vitest";
import type { MotionComponent } from "../src/library/componentLibrary";
import {
  evaluateGeneratedComponent,
  generationFailureFallback,
  validateGeneratedComponent
} from "../src/generation/sandbox";
import { conversionProtocols } from "../src/generation/conversionProtocols";

const component: MotionComponent = {
  id: "generated",
  name: "Generated",
  category: "layout",
  tags: ["campaign"],
  useCases: ["landing-page"],
  moods: ["clean"],
  manifest: {
    version: "1.0",
    id: "generated",
    name: "Generated",
    sourceKind: "html-package",
    runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
    capabilities: ["editable", "export-html"],
    designSpecs: [{ id: "campaign-motion-skill", confidence: 0.9, required: true }],
    layers: [
      {
        id: "heroImage",
        label: "主图",
        kind: "image",
        replaceable: true,
        paramId: "heroImage",
        targets: [
          { kind: "css-variable", file: "source/assets.css", selector: ":root", name: "--hero-image" }
        ]
      }
    ],
    params: [
      {
        id: "heroImage",
        label: "主图",
        type: "image",
        default: "",
        status: "confirmed",
        targets: [
          { kind: "css-variable", file: "source/assets.css", selector: ":root", name: "--hero-image" }
        ]
      },
      {
        id: "duration",
        label: "时长",
        type: "duration",
        default: 800,
        constraints: { min: 200, max: 2000, step: 50, unit: "ms" },
        status: "confirmed",
        targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--duration" }]
      }
    ]
  },
  source: {
    id: "generated",
    origin: "generated",
    kind: "html-package",
    entry: "source/index.html",
    files: [
      {
        path: "source/index.html",
        kind: "html",
        content:
          '<main data-motion-root><section class="hero"></section><script>window.motionReplay=function(){}</script></main>'
      },
      {
        path: "source/style.css",
        kind: "css",
        content: ".hero { animation: reveal var(--duration) infinite; }"
      },
      { path: "source/assets.css", kind: "css", content: ":root { --hero-image: none; }" }
    ]
  }
};

describe("generated component sandbox", () => {
  it("accepts schema-valid, whitelisted, playable generated components", () => {
    const result = validateGeneratedComponent({
      component,
      allowed: {
        paramIds: ["duration", "heroImage"],
        layerIds: ["heroImage"],
        sourceFiles: ["source/style.css", "source/assets.css"],
        sourceTargetKinds: ["css-variable"]
      },
      beforeFiles: {
        "source/style.css": ".hero { animation: reveal 800ms infinite; }",
        "source/assets.css": ":root { --hero-image: none; }"
      },
      afterFiles: {
        "source/style.css": ".hero { animation: reveal 900ms infinite; }",
        "source/assets.css": ":root { --hero-image: none; }"
      },
      patchValues: { duration: 900 }
    });

    expect(result.valid).toBe(true);
    expect(result.checks.map((check) => [check.id, check.status])).toEqual(
      expect.arrayContaining([
        ["schema-valid", "pass"],
        ["source-whitelist", "pass"],
        ["preview-playable", "pass"]
      ])
    );
  });

  it("blocks unsafe generated source and returns to candidate editing", () => {
    const unsafe = {
      ...component,
      source: {
        ...component.source,
        files: [
          ...component.source.files,
          { path: "source/script.js", kind: "js" as const, content: "fetch('https://example.com')" }
        ]
      }
    };
    const result = validateGeneratedComponent({
      component: unsafe,
      allowed: { paramIds: ["duration"], layerIds: [], sourceFiles: ["source/style.css"] },
      beforeFiles: { "source/style.css": "" },
      afterFiles: { "source/script.js": "fetch('https://example.com')" }
    });

    expect(result.valid).toBe(false);
    expect(result.checks.some((check) => check.id === "source-whitelist" && check.status === "fail")).toBe(
      true
    );
    expect(generationFailureFallback(result).action).toBe("edit-candidates");
  });

  it("defines minimal conversion protocols for supported upload types", () => {
    expect(conversionProtocols.map((item) => item.sourceKind)).toEqual([
      "video",
      "html-css",
      "react",
      "nextjs"
    ]);
    expect(conversionProtocols.every((item) => item.requiredOutputs.includes("motion.manifest.json"))).toBe(
      true
    );
  });

  it("evaluates generated outputs against the controlled generation rubric", () => {
    const evaluation = evaluateGeneratedComponent(component);

    expect(evaluation.items.map((item) => item.id)).toEqual([
      "spec-compliance",
      "loopable-motion",
      "replaceable-layers",
      "export-runnable"
    ]);
    expect(evaluation.passed).toBe(true);
  });
});
