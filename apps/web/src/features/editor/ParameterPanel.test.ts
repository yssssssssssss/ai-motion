import { describe, expect, it } from "vitest";
import { numericParamValue, paramControlKind } from "./ParameterPanel";

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
    expect(paramControlKind({ type: "select", constraints: { options: [{ label: "Slow", value: "slow" }] } })).toBe("select");
    expect(paramControlKind({ type: "select", constraints: {} })).toBe("unsupported");
    expect(paramControlKind({ type: "toggle" })).toBe("toggle");
  });
});
