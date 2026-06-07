import { afterEach, describe, expect, it, vi } from "vitest";
import { generateReferenceGuidedComponent } from "./referenceGuidedGenerationClient";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("generateReferenceGuidedComponent", () => {
  it("reports a stable error when the reference-guided endpoint returns an empty failure body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 404,
        text: async () => ""
      }))
    );

    await expect(generateReferenceGuidedComponent({ brief: "红色弹动按钮", components: [] })).rejects.toThrow(
      "参考生成失败: 404"
    );
  });
});
