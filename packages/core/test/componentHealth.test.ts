import { describe, expect, it } from "vitest";
import type { MotionComponent } from "../src/library/componentLibrary";
import { analyzeComponentHealth } from "../src/library/componentHealth";

function makeComponent(entryContent: string, script = ""): MotionComponent {
  return {
    id: "component",
    name: "Component",
    category: "interaction",
    tags: [],
    useCases: [],
    moods: [],
    manifest: {
      version: "1.0",
      id: "component",
      name: "Component",
      sourceKind: "builtin-component",
      runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
      params: [
        {
          id: "duration",
          label: "Duration",
          type: "duration",
          default: 300,
          status: "confirmed",
          targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--duration" }]
        }
      ],
      capabilities: ["export-html"]
    },
    source: {
      id: "component",
      origin: "builtin",
      kind: "builtin-component",
      entry: "source/index.html",
      files: [
        { path: "source/index.html", kind: "html", content: entryContent },
        {
          path: "source/style.css",
          kind: "css",
          content: ":root { --duration: 300ms; } .box { animation: fade var(--duration) both; }"
        },
        { path: "source/script.js", kind: "js", content: script }
      ]
    }
  };
}

describe("analyzeComponentHealth", () => {
  it("flags placeholder source as not previewable", () => {
    const report = analyzeComponentHealth(makeComponent(""));

    expect(report.checks.find((check) => check.id === "renderable-source")?.status).toBe("fail");
    expect(report.score).toBeLessThan(100);
  });

  it("detects explicit playback protocol support", () => {
    const report = analyzeComponentHealth(
      makeComponent("<main data-motion-root></main>", "window.motionReplay = function motionReplay() {};")
    );

    expect(report.checks.find((check) => check.id === "playback-protocol")?.status).toBe("pass");
    expect(report.checks.find((check) => check.id === "motion-detected")?.status).toBe("pass");
  });
});
