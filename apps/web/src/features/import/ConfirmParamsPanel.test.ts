import { describe, expect, it } from "vitest";
import { paramTypeLabel } from "./ConfirmParamsPanel";

describe("paramTypeLabel", () => {
  it("localizes visible parameter type labels", () => {
    expect(paramTypeLabel("color")).toBe("颜色");
    expect(paramTypeLabel("duration")).toBe("时长");
    expect(paramTypeLabel("toggle")).toBe("开关");
    expect(paramTypeLabel("transform")).toBe("变换");
  });
});
