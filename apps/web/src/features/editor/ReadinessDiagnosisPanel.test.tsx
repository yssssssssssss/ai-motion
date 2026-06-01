import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MotionComponent } from "@motion-tool/core";
import { ReadinessDiagnosisPanel } from "./ReadinessDiagnosisPanel";

const partial: MotionComponent = {
  id: "partial",
  name: "Partial",
  category: "layout",
  tags: [],
  useCases: [],
  moods: [],
  manifest: {
    version: "1.0",
    id: "partial",
    name: "Partial",
    sourceKind: "builtin-component",
    runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
    params: [
      {
        id: "duration",
        label: "时长",
        type: "duration",
        default: 800,
        status: "confirmed",
        targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--duration" }]
      }
    ]
  },
  source: {
    id: "partial",
    origin: "builtin",
    kind: "builtin-component",
    entry: "source/index.html",
    files: [
      { path: "source/index.html", kind: "html", content: '<main><div class="hero-layer"></div></main>' },
      { path: "source/style.css", kind: "css", content: ".hero-layer { animation: reveal 800ms both; }" }
    ]
  }
};

describe("ReadinessDiagnosisPanel", () => {
  it("explains readiness gaps and exposes completion entries for partial components", () => {
    const html = renderToStaticMarkup(<ReadinessDiagnosisPanel component={partial} />);

    expect(html).toContain("生成诊断");
    expect(html).toContain("规范 Skill");
    expect(html).toContain("补规范");
    expect(html).toContain("声明图层");
    expect(html).toContain("确认参数");
  });
});
