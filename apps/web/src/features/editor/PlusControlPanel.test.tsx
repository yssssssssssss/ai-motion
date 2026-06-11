import type { PlusControl } from "@motion-tool/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PlusControlPanel } from "./PlusControlPanel";

const controls: PlusControl[] = [
  {
    id: "speed",
    label: "速度",
    options: [
      { id: "slow", label: "慢", value: "slow" },
      { id: "normal", label: "标准", value: "normal" },
      { id: "fast", label: "快", value: "fast" }
    ],
    defaultOption: "normal",
    sliderLabel: "速度感",
    defaultAmount: 50,
    confidence: 0.85,
    mappedParamIds: ["transitionDuration"]
  }
];

describe("PlusControlPanel", () => {
  it("renders option and slider controls for plus mode", () => {
    const html = renderToStaticMarkup(
      <PlusControlPanel controls={controls} values={{}} affectedParamIds={["transitionDuration"]} onChange={vi.fn()} />
    );

    expect(html).toContain("速度");
    expect(html).toContain("标准");
    expect(html).toContain("速度感");
    expect(html).toContain("已影响");
    expect(html).toContain("transitionDuration");
  });

  it("renders reset action when available", () => {
    const html = renderToStaticMarkup(
      <PlusControlPanel
        controls={controls}
        values={{}}
        affectedParamIds={[]}
        onChange={vi.fn()}
        onReset={vi.fn()}
      />
    );

    expect(html).toContain("重置默认值");
  });

  it("renders an empty state when no simplified controls are available", () => {
    const html = renderToStaticMarkup(
      <PlusControlPanel controls={[]} values={{}} affectedParamIds={[]} onChange={vi.fn()} />
    );

    expect(html).toContain("该组件暂无简化控制");
  });
});
