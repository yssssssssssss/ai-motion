import { describe, expect, it } from "vitest";
import { convertWorkEasyComponent, selectedWorkEasyComponents } from "../src/adapters/workeasy";

describe("convertWorkEasyComponent", () => {
  it("converts a WorkEasy html/css record into a MotionComponent", () => {
    const result = convertWorkEasyComponent({
      category: "buttons",
      record: {
        id: "1-button",
        title: "Save Button",
        type: "html",
        framework: "vanilla",
        tags: ["button", "hover"],
        htmlContent: '<div class="comp-1-button-container"><button data-motion="label">Save</button></div>',
        cssContent: ".comp-1-button-container button { color: #ffffff; transition-duration: 0.3s; }"
      }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.skip.message);

    expect(result.component.id).toBe("workeasy-buttons-1-button");
    expect(result.component.source.entry).toBe("source/index.html");
    expect(result.component.source.files.map((file) => file.path)).toEqual([
      "source/index.html",
      "source/style.css"
    ]);
    expect(result.component.manifest.sourceKind).toBe("builtin-component");
    expect(result.component.manifest.params.some((param) => param.status === "confirmed")).toBe(true);
  });

  it("localizes visible WorkEasy sample copy without changing the component name", () => {
    const result = convertWorkEasyComponent({
      category: "buttons",
      record: {
        id: "1-button",
        title: "1 Button",
        type: "html",
        framework: "vanilla",
        tags: ["button"],
        htmlContent:
          '<div class="comp-1-button-container"><button data-label="Register"><span>Save</span></button></div>',
        cssContent:
          '.comp-1-button-container .button { color: #ffffff; } .comp-1-button-container .button::before { content: "Delete"; }'
      }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.skip.message);

    const html =
      result.component.source.files.find((file) => file.path === "source/index.html")?.content ?? "";
    const css = result.component.source.files.find((file) => file.path === "source/style.css")?.content ?? "";
    expect(result.component.name).toBe("1 Button");
    expect(html).toContain(">保存<");
    expect(html).toContain('data-label="注册"');
    expect(css).toContain('content: "删除"');
    expect(html).not.toContain(">Save<");
    expect(html).not.toContain('data-label="Register"');
    expect(css).not.toContain('"Delete"');
  });

  it("preserves whitespace around localized inline text", () => {
    const result = convertWorkEasyComponent({
      category: "buttons",
      record: {
        id: "ws-1",
        title: "WS Button",
        type: "html",
        framework: "vanilla",
        tags: ["button"],
        htmlContent: "<p>Hello <strong>Save</strong> Edit</p>",
        cssContent: ".x { color: #000; }"
      }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.skip.message);
    const html =
      result.component.source.files.find((file) => file.path === "source/index.html")?.content ?? "";
    // 翻译后周围空白要保留，避免出现 "你好保存编辑" 这种粘连
    expect(html).toContain(">你好 <");
    expect(html).toContain("> 编辑<");
  });

  it("skips unsupported React records in phase 1", () => {
    const result = convertWorkEasyComponent({
      category: "buttons",
      record: {
        id: "10-button",
        title: "React Button",
        type: "react",
        framework: "react",
        tags: ["button"],
        tsxContent: "export function Button() { return <button /> }"
      }
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected skip result");
    expect(result.skip.issue).toBe("unsupported-type");
  });

  it("defines the full WorkEasy source selection", () => {
    expect(selectedWorkEasyComponents.buttons).toHaveLength(50);
    expect(selectedWorkEasyComponents.cards).toHaveLength(20);
    expect(selectedWorkEasyComponents.checkboxes).toHaveLength(50);
  });

  it("keeps previewable components even when no safe editable params are detected", () => {
    const result = convertWorkEasyComponent({
      category: "cards",
      record: {
        id: "8-cards",
        title: "Flip Card",
        type: "html",
        framework: "vanilla",
        tags: ["card"],
        htmlContent: '<div class="flip-card"><div>No editable values</div></div>',
        cssContent: ".flip-card { display: block; }"
      }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.skip.message);
    expect(result.component.manifest.params).toEqual([]);
  });
});
