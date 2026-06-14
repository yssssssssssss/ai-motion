import { describe, expect, it } from "vitest";
import { manualAnnotationOptionFor, manualAnnotationOptions } from "./manualAnnotation";

describe("manual annotation options", () => {
  it("covers common design regions beyond the original five options", () => {
    expect(manualAnnotationOptions.map((option) => option.label)).toEqual([
      "按钮/CTA",
      "卡片组",
      "内容区",
      "弹窗/浮层",
      "反馈/状态",
      "表单/输入",
      "导航/标签",
      "列表/信息流",
      "图片/媒体",
      "其他/AI 判断"
    ]);
  });

  it("maps detailed manual options back to supported element kinds", () => {
    expect(manualAnnotationOptionFor("form").elementKind).toBe("form");
    expect(manualAnnotationOptionFor("nav").elementKind).toBe("nav");
    expect(manualAnnotationOptionFor("list").elementKind).toBe("card");
    expect(manualAnnotationOptionFor("media").elementKind).toBe("content");
    expect(manualAnnotationOptionFor("unknown").elementKind).toBe("unknown");
  });
});
