import { describe, expect, it } from "vitest";
import type { MotionParam } from "../src/manifest/types";
import { describeParamConcepts, paramConceptIds } from "../src/orchestrator/paramConcepts";

function param(input: Partial<MotionParam> & Pick<MotionParam, "id" | "type">): MotionParam {
  return {
    label: input.id,
    default: 0,
    status: "confirmed",
    targets: [],
    ...input
  };
}

describe("paramConcepts", () => {
  it("normalizes trajectory-like implementation params into one stable concept", () => {
    expect(paramConceptIds(param({ id: "midX", type: "range", label: "中段 X" }))).toContain("trajectory");
    expect(paramConceptIds(param({ id: "endY", type: "number", label: "结束 Y" }))).toContain("trajectory");
    expect(paramConceptIds(param({ id: "slideDistance", type: "range", label: "滑动距离" }))).toContain(
      "trajectory"
    );
  });

  it("keeps layout dimensions out of trajectory controls", () => {
    expect(paramConceptIds(param({ id: "popupWidth", type: "range", label: "弹层宽度" }))).not.toContain(
      "trajectory"
    );
    expect(paramConceptIds(param({ id: "cardHeight", type: "number", label: "卡片高度" }))).not.toContain(
      "trajectory"
    );
  });

  it("detects rhythm params without mixing them into plain speed", () => {
    expect(paramConceptIds(param({ id: "startDelay", type: "duration", label: "开始延迟" }))).toContain(
      "rhythm"
    );
    expect(paramConceptIds(param({ id: "loopInterval", type: "duration", label: "循环间隔" }))).toContain(
      "rhythm"
    );
  });

  it("returns readable concept descriptions for generation plans", () => {
    expect(
      describeParamConcepts(param({ id: "transitionDuration", type: "duration", label: "转场速度" }))
    ).toEqual([{ id: "speed", label: "速度" }]);
  });
});
