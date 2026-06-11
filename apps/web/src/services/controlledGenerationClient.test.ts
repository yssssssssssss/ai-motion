import { afterEach, describe, expect, it, vi } from "vitest";
import { generateControlledComponent } from "./controlledGenerationClient";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("generateControlledComponent", () => {
  it("reports a stable error when the generation endpoint returns an empty failure body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 404,
        text: async () => ""
      }))
    );

    await expect(generateControlledComponent({ brief: "商品详情转场", components: [] })).rejects.toThrow(
      "受控生成失败: 404"
    );
  });
});
