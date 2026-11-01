import { describe, expect, it } from "vitest";
import { createMotionBlueprint } from "./blueprint";
import { createMotionDocument, parseMotionDocument } from "./document";

describe("parseMotionDocument", () => {
  it.each(["motionlens-review", "legacy-wrapper", "legacy-blueprint"])(
    "only restores data image URLs from %s documents",
    (kind) => {
      const blueprint = structuredClone(createMotionBlueprint({ fixtureId: "commerce-product" }));
      const raw =
        kind === "motionlens-review"
          ? createMotionDocument({ blueprint })
          : kind === "legacy-wrapper"
            ? { blueprint }
            : blueprint;
      expect(
        parseMotionDocument({ ...raw, assets: { imageDataUrl: 'x" onerror="alert(1)' } }).assets
      ).toBeUndefined();
      expect(
        parseMotionDocument({ ...raw, assets: { imageDataUrl: "data:image/png;base64,abc" } }).assets
          ?.imageDataUrl
      ).toBe("data:image/png;base64,abc");
    }
  );

  it.each([null, 1, "invalid", [], {}, { id: "incomplete" }].map((opportunity) => ({ opportunity })))(
    "rejects a malformed opportunity: $opportunity",
    ({ opportunity }) => {
      const blueprint = structuredClone(createMotionBlueprint({ fixtureId: "commerce-product" }));
      expect(() => parseMotionDocument({ ...blueprint, opportunities: [opportunity] })).toThrow(
        "Blueprint 机会点无效。"
      );
    }
  );

  it.each([
    "id",
    "elementId",
    "priority",
    "score",
    "confidence",
    "businessGoal",
    "decisionStage",
    "friction",
    "strategy",
    "patternId",
    "patternName",
    "reason",
    "risks",
    "recommendedParams"
  ])("rejects an opportunity missing %s", (field) => {
    const blueprint = structuredClone(createMotionBlueprint({ fixtureId: "commerce-product" }));
    const opportunity = { ...blueprint.opportunities[0] };
    Reflect.deleteProperty(opportunity, field);
    expect(() => parseMotionDocument({ ...blueprint, opportunities: [opportunity] })).toThrow(
      "Blueprint 机会点无效。"
    );
  });

  it.each(["durationMs", "easing", "repeat"])("rejects recommendedParams missing %s", (field) => {
    const blueprint = structuredClone(createMotionBlueprint({ fixtureId: "commerce-product" }));
    Reflect.deleteProperty(blueprint.opportunities[0]!.recommendedParams, field);
    expect(() => parseMotionDocument(blueprint)).toThrow("Blueprint 机会点无效。");
  });

  it("keeps legacy opportunities without recommendationSource or optional fields", () => {
    const blueprint = structuredClone(createMotionBlueprint({ fixtureId: "commerce-product" }));
    for (const opportunity of blueprint.opportunities) {
      for (const field of [
        "recommendationSource",
        "reviewEvidence",
        "alternativeRecommendations",
        "knowledgeRefs"
      ]) {
        Reflect.deleteProperty(opportunity, field);
      }
      Reflect.deleteProperty(opportunity.recommendedParams, "delayMs");
      Reflect.deleteProperty(opportunity.recommendedParams, "transform");
    }
    const parsed = parseMotionDocument(blueprint);
    expect(parsed.blueprint.opportunities).toHaveLength(blueprint.opportunities.length);
    expect(parsed.blueprint.opportunities[0]?.recommendationSource).toBe("local-fallback");
    expect(parsed.blueprint.opportunities[0]?.patternName).toBe(blueprint.opportunities[0]?.patternName);
  });
});
