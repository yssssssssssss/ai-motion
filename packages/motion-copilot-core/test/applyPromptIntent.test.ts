import { describe, expect, it } from "vitest";
import { applyPromptIntent, createDefaultDocument, primaryElement, type MotionDocument } from "../src";

function userDocument(): MotionDocument {
  const document = createDefaultDocument("background");
  document.layers = [
    { id: "user-text", name: "我的文字", kind: "text", editable: true, content: { text: "不能丢失" } },
    {
      id: "user-image",
      name: "我的图片",
      kind: "image",
      editable: true,
      content: { src: "data:image/png;base64,AA" }
    }
  ];
  document.stage.background = "#123456";
  document.stage.backgroundImage = "data:image/png;base64,BB";
  return document;
}

describe("applyPromptIntent", () => {
  it.each(["让这段文字淡入", "做一个弹窗", "按钮点击反馈"])("preserves user content for %s", (prompt) => {
    const document = userDocument();
    const before = structuredClone(document);
    const result = applyPromptIntent(document, prompt);
    expect(result.layers).toEqual(before.layers);
    expect(result.stage).toEqual(before.stage);
    expect(primaryElement(result)).toEqual(primaryElement(before));
    expect(document).toEqual(before);
  });

  it("allows a role swap for an empty document with no stage content", () => {
    const document = createDefaultDocument("background");
    document.layers = [];
    expect(primaryElement(applyPromptIntent(document, "按钮点击反馈")).role).toBe("button");
  });

  it("allows a role swap for an unmodified default", () => {
    expect(primaryElement(applyPromptIntent(createDefaultDocument("toast"), "做一个弹窗")).role).toBe(
      "modal"
    );
  });

  it("preserves a background even without layers", () => {
    const document = userDocument();
    document.layers = [];
    const result = applyPromptIntent(document, "做一个弹窗");
    expect(primaryElement(result).role).toBe("background");
    expect(result.stage).toEqual(document.stage);
  });

  it.each([
    { background: "#abcdef" },
    { backgroundImage: "data:image/png;base64,CC" },
    { width: 1440, height: 900 }
  ])("preserves stage edits without layers: %j", (stage) => {
    const document = createDefaultDocument("background");
    document.layers = [];
    document.stage = { ...document.stage, ...stage };
    const result = applyPromptIntent(document, "按钮点击反馈");
    expect(primaryElement(result).role).toBe("background");
    expect(result.stage).toEqual(document.stage);
  });

  it("keeps edited default layers while still applying compatible intent fields", () => {
    const document = createDefaultDocument("toast");
    document.layers[0]!.content = { text: "我的文案" };
    const result = applyPromptIntent(document, "做一个大弹窗，慢慢出现");
    expect(primaryElement(result).role).toBe("toast");
    expect(primaryElement(result).size).toBe("large");
    expect(result.timeline.durationMs).toBe(380);
    expect(result.layers).toEqual(document.layers);
  });

  it("preserves a visual source even without layers", () => {
    const document = createDefaultDocument("background");
    document.layers = [];
    const snapshot = {
      schemaVersion: "motion-copilot.zero-visual-snapshot.v1" as const,
      frameId: "frame",
      nodeId: "frame",
      name: "我的画面",
      width: 100,
      height: 100,
      screenshotUrl: "",
      html: "<div>我的画面</div>",
      css: "",
      assets: [],
      nodes: []
    };
    document.visualSource = {
      kind: "zero-visual-morph",
      from: snapshot,
      to: snapshot,
      bindingResult: { bindings: [], enter: [], exit: [] }
    };
    const result = applyPromptIntent(document, "做一个弹窗");
    expect(primaryElement(result).role).toBe("background");
    expect(result.visualSource).toEqual(document.visualSource);
  });
});
