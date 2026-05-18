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
    expect(result.component.source.files.map((file) => file.path)).toEqual(["source/index.html", "source/style.css"]);
    expect(result.component.manifest.sourceKind).toBe("builtin-component");
    expect(result.component.manifest.params.some((param) => param.status === "confirmed")).toBe(true);
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

  it("defines a 10/5/5 curated WorkEasy selection", () => {
    expect(selectedWorkEasyComponents.buttons).toHaveLength(10);
    expect(selectedWorkEasyComponents.cards).toHaveLength(5);
    expect(selectedWorkEasyComponents.checkboxes).toHaveLength(5);
  });
});
