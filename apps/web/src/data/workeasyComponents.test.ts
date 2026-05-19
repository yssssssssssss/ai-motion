import { describe, expect, it } from "vitest";
import { workEasyComponentCount, workEasyComponents } from "./workeasyComponents";

describe("workEasyComponents", () => {
  it("keeps the curated component set from collapsing", () => {
    expect(workEasyComponentCount).toBeGreaterThanOrEqual(18);
    expect(workEasyComponents.every((component) => component.manifest.params.length > 0)).toBe(true);
  });

  it("does not expose global css-property targets as confirmed params", () => {
    const cssTargets = workEasyComponents.flatMap((component) =>
      component.manifest.params.flatMap((param) => param.targets.filter((target) => target.kind === "css-property"))
    );

    expect(cssTargets.length).toBeGreaterThan(0);
    expect(cssTargets.every((target) => /^[.#\[]/.test(target.selector))).toBe(true);
    expect(cssTargets.every((target) => !target.selector.includes(":") && !target.selector.includes(","))).toBe(true);
  });
});
