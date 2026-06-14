import { describe, expect, it } from "vitest";
import { detailTabs } from "./detailTabs";

describe("detail tabs", () => {
  it("keeps the opportunity detail panel split into four review tabs", () => {
    expect(detailTabs).toEqual([
      { id: "recommendation", label: "推荐内容" },
      { id: "evidence", label: "评审依据" },
      { id: "preview", label: "预览参数" },
      { id: "analysis", label: "分析维度" }
    ]);
  });
});
