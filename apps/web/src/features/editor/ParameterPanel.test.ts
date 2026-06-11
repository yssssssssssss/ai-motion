import { describe, expect, it } from "vitest";
import { groupParameters, numericParamValue, paramControlKind } from "./ParameterPanel";

describe("numericParamValue", () => {
  it("reads numeric values from CSS values with units", () => {
    expect(numericParamValue("800ms")).toBe(800);
    expect(numericParamValue("0.35s")).toBe(0.35);
    expect(numericParamValue("12px")).toBe(12);
  });

  it("falls back to zero for invalid values", () => {
    expect(numericParamValue("fast")).toBe(0);
  });
});

describe("paramControlKind", () => {
  it("uses bounded controls only when required constraints exist", () => {
    expect(paramControlKind({ type: "range", constraints: { min: 0, max: 1, step: 0.01 } })).toBe("range");
    expect(paramControlKind({ type: "number", constraints: { min: 0, max: 100, step: 1 } })).toBe("range");
    expect(paramControlKind({ type: "range" })).toBe("unsupported");
  });

  it("uses option and boolean controls for select and toggle", () => {
    expect(
      paramControlKind({ type: "select", constraints: { options: [{ label: "Slow", value: "slow" }] } })
    ).toBe("select");
    expect(paramControlKind({ type: "select", constraints: {} })).toBe("unsupported");
    expect(paramControlKind({ type: "toggle" })).toBe("toggle");
    expect(paramControlKind({ type: "image" })).toBe("image");
  });
});

describe("groupParameters", () => {
  it("keeps image and text layer params out of the ordinary parameter panel", () => {
    const groups = groupParameters({
      version: "1.0",
      id: "layered",
      name: "Layered",
      sourceKind: "builtin-component",
      runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
      params: [
        { id: "heroImage", label: "主图", type: "image", default: "", status: "confirmed", targets: [] },
        { id: "headline", label: "标题", type: "text", default: "新品", status: "confirmed", targets: [] },
        {
          id: "duration",
          label: "时长",
          type: "duration",
          default: 800,
          status: "confirmed",
          targets: []
        }
      ]
    });

    expect(groups.flatMap((group) => group.params.map((param) => param.id))).toEqual(["duration"]);
  });

  it("groups motion recipe params by recipe control category first", () => {
    const groups = groupParameters({
      version: "1.0",
      id: "recipe",
      name: "Recipe",
      sourceKind: "builtin-component",
      runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
      motionRecipes: [
        {
          recipeId: "float-loop",
          recipeName: "漂浮循环",
          category: "loop",
          targetLayerIds: ["backgroundLayer"],
          targetRoles: ["background"],
          paramIds: ["floatDuration", "floatAmplitude"],
          trigger: "loop"
        }
      ],
      params: [
        {
          id: "floatDuration",
          label: "漂浮周期",
          type: "duration",
          default: 3200,
          status: "confirmed",
          targets: [],
          ui: { group: "时间" }
        },
        {
          id: "floatAmplitude",
          label: "漂浮幅度",
          type: "range",
          default: 22,
          status: "confirmed",
          targets: [],
          ui: { group: "轨迹" }
        },
        {
          id: "pageBackgroundColor",
          label: "页面背景色",
          type: "color",
          default: "#ffffff",
          status: "confirmed",
          targets: []
        }
      ]
    });

    expect(groups.map((group) => group.label)).toEqual(["时间", "轨迹", "外观"]);
    expect(groups[0]?.params.map((param) => param.id)).toEqual(["floatDuration"]);
  });
});
