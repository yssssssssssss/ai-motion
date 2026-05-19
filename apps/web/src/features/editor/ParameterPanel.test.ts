import { describe, expect, it } from "vitest";
import { numericParamValue } from "./ParameterPanel";

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
