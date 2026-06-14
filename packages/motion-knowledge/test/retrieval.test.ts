import { describe, expect, it } from "vitest";
import {
  knowledgeSources,
  createKnowledgeProductionManifest,
  motionCases,
  motionPatternKnowledge,
  motionPrinciples,
  motionRiskRules,
  retrieveMotionKnowledge,
  validateMotionKnowledgeBase
} from "../src";

describe("motion knowledge base", () => {
  it("keeps both PDFs as explicit source material", () => {
    expect(knowledgeSources["motion-design-spec"].path).toContain("动效设计规范系统");
    expect(knowledgeSources["human-empathy-research"].path).toContain("人文共情");
  });

  it("separates principles, patterns, cases, and risk rules", () => {
    expect(motionPrinciples.length).toBeGreaterThanOrEqual(6);
    expect(motionPatternKnowledge.length).toBeGreaterThanOrEqual(7);
    expect(motionCases.length).toBeGreaterThanOrEqual(6);
    expect(motionRiskRules.length).toBeGreaterThanOrEqual(4);
  });

  it("retrieves add-to-cart knowledge from scenario and element hints", () => {
    const hits = retrieveMotionKnowledge({
      query: "加购 购物车 商品详情",
      elementKind: "button",
      pageType: "product-detail",
      goal: "feedback",
      limit: 5
    });

    expect(hits.some((hit) => hit.item.id === "pattern-add-to-cart-fly")).toBe(true);
    expect(hits[0]?.score).toBeGreaterThan(0);
  });

  it("retrieves risk rules for looping attention motion", () => {
    const hits = retrieveMotionKnowledge({
      query: "循环 吸睛 CTA",
      elementKind: "button",
      goal: "attention",
      limit: 5
    });

    expect(hits.some((hit) => hit.item.id === "risk-looping-attention")).toBe(true);
  });

  it("validates knowledge assets before they are used by model prompts", () => {
    expect(validateMotionKnowledgeBase()).toEqual([]);
    const manifest = createKnowledgeProductionManifest(new Date("2026-06-13T00:00:00.000Z"));

    expect(manifest.generatedAt).toBe("2026-06-13T00:00:00.000Z");
    expect(manifest.sourceCount).toBe(2);
    expect(manifest.itemCount).toBe(
      motionPrinciples.length + motionPatternKnowledge.length + motionCases.length + motionRiskRules.length
    );
    expect(manifest.countsByType.pattern).toBe(motionPatternKnowledge.length);
    expect(manifest.countsBySource["motion-design-spec"]).toBeGreaterThan(0);
    expect(manifest.countsBySource["human-empathy-research"]).toBeGreaterThan(0);
  });
});
