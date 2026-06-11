import { describe, expect, it } from "vitest";
import { designSpecSkills, findDesignSpecSkill } from "../src/library/designSpecs";

describe("designSpecSkills", () => {
  it("exposes schema-checked readable rules for controlled generation", () => {
    const ecommerce = findDesignSpecSkill("ecommerce-transition-motion-skill");

    expect(ecommerce).toMatchObject({
      id: "ecommerce-transition-motion-skill",
      version: "1.0",
      label: "电商转场动效规范"
    });
    expect(ecommerce?.terms).toContain("商品");
    expect(ecommerce?.rules).toContain("转场必须保持商品主体连续，不允许突然闪断或跳帧。");
    expect(ecommerce?.forbidden).toContain("禁止生成与商品转场无关的装饰性漂浮元素。");
    expect(ecommerce?.preferredParamConcepts).toEqual(expect.arrayContaining(["trajectory", "rhythm"]));
    expect(ecommerce?.acceptanceChecks).toContain("主图层必须可替换。");
  });

  it("keeps every skill useful without reading arbitrary executable files", () => {
    expect(designSpecSkills.length).toBeGreaterThanOrEqual(5);
    for (const skill of designSpecSkills) {
      expect(skill.id).toMatch(/^[a-z0-9-]+$/);
      expect(skill.version).toMatch(/^\d+\.\d+$/);
      expect(skill.terms.length).toBeGreaterThan(0);
      expect(skill.appliesTo.length).toBeGreaterThan(0);
      expect(skill.rules.length).toBeGreaterThan(0);
      expect(skill.forbidden.length).toBeGreaterThan(0);
      expect(skill.motionPrinciples.length).toBeGreaterThan(0);
      expect(skill.preferredParamConcepts.length).toBeGreaterThan(0);
      expect(skill.acceptanceChecks.length).toBeGreaterThan(0);
    }
  });
});
