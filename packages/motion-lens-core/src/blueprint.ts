import { fixtureById, fixtureDrafts } from "./fixtures";
import { motionPatterns } from "./patterns";
import type {
  BusinessGoal,
  DecisionFriction,
  DecisionStage,
  DesignSource,
  DesignElement,
  FixtureDraft,
  MotionBlueprint,
  NoMotionSuggestion,
  MotionOpportunity,
  MotionPattern,
  MotionPreviewSpec,
  RecommendationSource,
  MotionStrategy,
  OpportunityPriority
} from "./schema";

export type BlueprintInput = {
  fixtureId?: string;
  goalText?: string;
  pageType?: string;
};

export type FallbackBlueprintInput = {
  source: DesignSource;
  goalText: string;
  pageType: string;
};

export type ElementBlueprintInput = FallbackBlueprintInput & {
  elements: DesignElement[];
  analysisMode?: "fixture" | "fallback" | "hybrid";
  recommendationSource?: RecommendationSource;
  warnings?: string[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function area(bounds: DesignElement["bounds"]): number {
  return bounds.width * bounds.height;
}

function overlapRatio(left: DesignElement["bounds"], right: DesignElement["bounds"]): number {
  const x1 = Math.max(left.x, right.x);
  const y1 = Math.max(left.y, right.y);
  const x2 = Math.min(left.x + left.width, right.x + right.width);
  const y2 = Math.min(left.y + left.height, right.y + right.height);
  const overlap = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const smallerArea = Math.min(area(left), area(right));
  return smallerArea > 0 ? overlap / smallerArea : 0;
}

function isDecorativeElement(element: DesignElement): boolean {
  const text = `${element.id} ${element.label} ${element.text ?? ""}`.toLowerCase();
  return (
    element.isDecorative === true ||
    /(decorative|ornament|illustration|hero image|background|banner|装饰|插画|背景)/i.test(text)
  );
}

export function classifyGoal(goalText: string, pageType = ""): BusinessGoal {
  const text = `${goalText} ${pageType}`.toLowerCase();

  if (/(点击|click|ctr|cta)/i.test(text)) return "ctr";
  if (/(购买|下单|支付|转化|checkout|buy|cvr|conversion)/i.test(text)) return "cvr";
  if (/(理解|阅读|结果|解释|clarity|understand|ai)/i.test(text)) return "clarity";
  if (/(信任|订阅|删除|确认|trust|subscribe|permission)/i.test(text)) return "trust";
  if (/(反馈|提交|上传|保存|成功|feedback|submit|upload|save)/i.test(text)) return "feedback";
  if (/(留存|签到|成就|retention|habit|reward)/i.test(text)) return "retention";

  if (/(form|表单)/i.test(pageType)) return "feedback";
  if (/(dashboard|ai|content|marketing|内容)/i.test(pageType)) return "clarity";
  return "ctr";
}

function stageFor(element: DesignElement, friction: DecisionFriction): DecisionStage {
  if (friction === "attention") return element.kind === "button" ? "decide" : "discover";
  if (friction === "understanding") return "understand";
  if (friction === "trust") return "evaluate";
  if (friction === "confidence") return element.kind === "feedback" ? "feedback" : "act";
  return "feedback";
}

export function classifyFriction(element: DesignElement, goal: BusinessGoal): DecisionFriction {
  if (goal === "trust" || element.kind === "modal") return "trust";
  if (goal === "feedback" || element.kind === "feedback") return "confidence";
  if (
    element.kind === "card" &&
    (goal === "ctr" || goal === "cvr") &&
    (element.visualWeight >= 0.72 || element.interactiveLikelihood >= 0.58)
  ) {
    return "attention";
  }
  if (
    goal === "clarity" ||
    element.kind === "card" ||
    element.kind === "content" ||
    element.kind === "form"
  ) {
    return "understanding";
  }
  if (goal === "retention") return "motivation";
  if (element.kind === "button" && element.visualWeight < 0.66) return "attention";
  return "attention";
}

function strategyFor(friction: DecisionFriction): MotionStrategy {
  if (friction === "attention") return "attention";
  if (friction === "understanding") return "guidance";
  if (friction === "trust") return "trust";
  if (friction === "confidence") return "feedback";
  return "reward";
}

function fallbackPattern(strategy: MotionStrategy): MotionPattern {
  const pattern = motionPatterns.find((item) => item.strategy === strategy);
  if (!pattern) throw new Error(`Missing fallback pattern for ${strategy}.`);
  return pattern;
}

const semanticPatternIds = new Set([
  "add-to-cart-fly",
  "favorite-heartbeat",
  "payment-success-ceremony",
  "logistics-progress-motion",
  "empty-state-scene-motion",
  "rating-emotion-feedback",
  "feed-interest-badge"
]);

export function recommendPattern(
  element: DesignElement,
  friction: DecisionFriction,
  goal?: BusinessGoal,
  pageType = ""
): MotionPattern {
  const text = `${element.id} ${element.label} ${element.text ?? ""} ${pageType}`.toLowerCase();

  if (
    /(加购|购物车|add.?to.?cart|cart)/i.test(text) &&
    (element.kind === "button" || element.kind === "card")
  ) {
    return motionPatterns.find((pattern) => pattern.id === "add-to-cart-fly") ?? fallbackPattern("feedback");
  }
  if (/(收藏|关注|心愿|favorite|wishlist|heart)/i.test(text) && element.kind === "button") {
    return motionPatterns.find((pattern) => pattern.id === "favorite-heartbeat") ?? fallbackPattern("reward");
  }
  if (
    /(支付成功|下单成功|order.?success|success)/i.test(text) &&
    (element.kind === "feedback" || element.kind === "modal")
  ) {
    return (
      motionPatterns.find((pattern) => pattern.id === "payment-success-ceremony") ?? fallbackPattern("reward")
    );
  }
  if (
    /(物流|配送|履约|logistics|delivery|shipment)/i.test(text) &&
    (element.kind === "content" || element.kind === "feedback")
  ) {
    return (
      motionPatterns.find((pattern) => pattern.id === "logistics-progress-motion") ??
      fallbackPattern("guidance")
    );
  }
  if (
    /(缺省|空状态|无结果|empty|no result|search)/i.test(text) &&
    (element.kind === "content" || element.kind === "feedback")
  ) {
    return (
      motionPatterns.find((pattern) => pattern.id === "empty-state-scene-motion") ??
      fallbackPattern("guidance")
    );
  }
  if (
    /(评分|评价|星级|rating|review)/i.test(text) &&
    (element.kind === "feedback" || element.kind === "button")
  ) {
    return (
      motionPatterns.find((pattern) => pattern.id === "rating-emotion-feedback") ?? fallbackPattern("reward")
    );
  }
  if (
    (goal === "ctr" || goal === "cvr") &&
    /(优惠|补贴|利益|券|badge|promotion)/i.test(text) &&
    (element.kind === "card" || element.kind === "content")
  ) {
    return (
      motionPatterns.find((pattern) => pattern.id === "feed-interest-badge") ?? fallbackPattern("attention")
    );
  }

  if (element.kind === "card" && friction === "attention") {
    return (
      motionPatterns.find((pattern) => pattern.id === "card-focus-spotlight") ?? fallbackPattern("attention")
    );
  }
  if (element.kind === "content" && friction === "understanding") {
    return (
      motionPatterns.find((pattern) => pattern.id === "progressive-reveal") ?? fallbackPattern("guidance")
    );
  }

  const exact = motionPatterns.find(
    (pattern) =>
      !semanticPatternIds.has(pattern.id) &&
      pattern.supportedKinds.includes(element.kind) &&
      pattern.frictions.includes(friction)
  );
  if (exact) return exact;

  if (element.kind === "button" && friction === "attention") {
    return (
      motionPatterns.find((pattern) => pattern.id === "cta-one-shot-highlight") ??
      fallbackPattern("attention")
    );
  }
  if (element.kind === "button" && friction === "confidence") {
    return (
      motionPatterns.find((pattern) => pattern.id === "button-press-success") ?? fallbackPattern("feedback")
    );
  }
  if (element.kind === "modal") {
    return (
      motionPatterns.find((pattern) => pattern.id === "stable-modal-transition") ?? fallbackPattern("trust")
    );
  }
  if (element.kind === "feedback") {
    return (
      motionPatterns.find((pattern) => pattern.id === "toast-success-feedback") ?? fallbackPattern("feedback")
    );
  }

  return fallbackPattern(strategyFor(friction));
}

function scoreElement(element: DesignElement, goal: BusinessGoal, friction: DecisionFriction): number {
  const roleImportance =
    element.kind === "button" ? 25 : element.kind === "modal" ? 23 : element.kind === "feedback" ? 20 : 15;
  const goalRelevance =
    (goal === "ctr" || goal === "cvr") && element.kind === "button"
      ? 30
      : goal === "clarity" && (element.kind === "card" || element.kind === "content")
        ? 28
        : goal === "trust" && (element.kind === "modal" || element.kind === "button")
          ? 28
          : goal === "feedback" && (element.kind === "feedback" || element.kind === "button")
            ? 28
            : 14;
  const frictionSeverity =
    friction === "attention" && element.visualWeight < 0.66
      ? 20
      : friction === "understanding"
        ? 17
        : friction === "trust"
          ? 18
          : 16;
  const confidence = Math.round(element.confidence * 15);
  const decorativePenalty = isDecorativeElement(element) ? 28 : 0;
  const lowInteractionPenalty =
    element.kind === "content" && element.interactiveLikelihood < 0.12 && goal !== "clarity" ? 12 : 0;
  const riskPenalty = element.kind === "content" && goal !== "clarity" ? 8 : 0;

  return clamp(
    goalRelevance +
      roleImportance +
      frictionSeverity +
      confidence -
      riskPenalty -
      decorativePenalty -
      lowInteractionPenalty,
    0,
    100
  );
}

function priorityFor(score: number): OpportunityPriority {
  if (score >= 65) return "P0";
  if (score >= 45) return "P1";
  return "P2";
}

function reasonFor(element: DesignElement, friction: DecisionFriction, pattern: MotionPattern): string {
  if (friction === "attention") {
    return `${element.label} 是关键操作，但当前视觉权重不足。建议使用 ${pattern.name} 提升首轮注意，同时避免循环干扰。`;
  }
  if (friction === "understanding") {
    return `${element.label} 信息密度较高。建议使用 ${pattern.name} 建立阅读顺序，降低理解成本。`;
  }
  if (friction === "trust") {
    return `${element.label} 属于高决策成本区域。建议使用 ${pattern.name} 保持稳定、可预测的状态变化。`;
  }
  if (friction === "confidence") {
    return `${element.label} 需要更清晰的操作确认。建议使用 ${pattern.name} 让用户知道动作已被接收。`;
  }
  return `${element.label} 可用克制的奖励动效强化完成感，但不应抢占主流程注意力。`;
}

function noMotionSuggestionFor(element: DesignElement): NoMotionSuggestion | undefined {
  if (element.kind === "nav") {
    return {
      elementId: element.id,
      label: element.label,
      recommendation: "no-motion",
      reason: `${element.label} 是导航或稳定定位区域，常驻动效会削弱方向感。`,
      risks: ["不要给导航做循环闪烁。", "只在状态切换时保留极短反馈。"]
    };
  }

  if (element.kind === "unknown") {
    return {
      elementId: element.id,
      label: element.label,
      recommendation: "no-motion",
      reason: `${element.label} 的语义不明确，缺少动效触发条件。`,
      risks: ["先确认元素角色，再决定是否加动效。"]
    };
  }

  if (isDecorativeElement(element)) {
    return {
      elementId: element.id,
      label: element.label,
      recommendation: "no-motion",
      reason: `${element.label} 更像装饰或静态视觉资产，不应抢占任务注意力。`,
      risks: ["装饰性循环动效会提高噪音。", "除非它承载状态变化，否则保持静态。"]
    };
  }

  if (element.kind === "content" && element.interactiveLikelihood < 0.12) {
    return {
      elementId: element.id,
      label: element.label,
      recommendation: "no-motion",
      reason: `${element.label} 主要承担阅读，不建议做持续或复杂动效。`,
      risks: ["避免逐字播放长文本。", "如需入场，只使用一次性淡入。"]
    };
  }

  return undefined;
}

function opportunityFor(
  element: DesignElement,
  goal: BusinessGoal,
  pageType: string,
  recommendationSource: RecommendationSource
): MotionOpportunity {
  const friction = classifyFriction(element, goal);
  const pattern = recommendPattern(element, friction, goal, pageType);
  const score = scoreElement(element, goal, friction);

  return {
    id: `${element.id}-${pattern.id}`,
    elementId: element.id,
    recommendationSource,
    priority: priorityFor(score),
    score,
    confidence: clamp((element.confidence + element.interactiveLikelihood) / 2, 0, 1),
    businessGoal: goal,
    decisionStage: stageFor(element, friction),
    friction,
    strategy: pattern.strategy,
    patternId: pattern.id,
    patternName: pattern.name,
    reason: reasonFor(element, friction, pattern),
    risks: pattern.risks,
    recommendedParams: pattern.params
  };
}

function dedupeOpportunities(
  opportunities: MotionOpportunity[],
  elementsById: Map<string, DesignElement>
): MotionOpportunity[] {
  const selected: MotionOpportunity[] = [];

  for (const opportunity of opportunities) {
    const element = elementsById.get(opportunity.elementId);
    if (!element) continue;
    const duplicate = selected.some((existing) => {
      const existingElement = elementsById.get(existing.elementId);
      return (
        existingElement &&
        existingElement.kind === element.kind &&
        overlapRatio(existingElement.bounds, element.bounds) > 0.72
      );
    });
    if (!duplicate) selected.push(opportunity);
  }

  return selected;
}

function defaultFixture(): FixtureDraft {
  const fixture = fixtureDrafts[0];
  if (!fixture) throw new Error("MotionLens requires at least one fixture draft.");
  return fixture;
}

function selectedFixture(fixtureId?: string): FixtureDraft {
  return fixtureId ? (fixtureById(fixtureId) ?? defaultFixture()) : defaultFixture();
}

export function createMotionBlueprint(input: BlueprintInput = {}): MotionBlueprint {
  const fixture = selectedFixture(input.fixtureId);
  const goalText = input.goalText ?? fixture.defaultGoalText;
  const pageType = input.pageType ?? fixture.pageType;

  return createBlueprintFromElements({
    source: fixture.source,
    goalText,
    pageType,
    elements: fixture.elements,
    analysisMode: "fixture",
    recommendationSource: "local-fallback",
    warnings: ["P0 使用 fixture-backed 分析；真实视觉模型尚未接入。"]
  });
}

export function createFallbackBlueprint(input: FallbackBlueprintInput): MotionBlueprint {
  return createBlueprintFromElements({
    ...input,
    elements: [],
    analysisMode: "fallback",
    warnings: ["已载入真实图片；点击 AI 分析稿件自动识别机会点，或先使用手动标注。"]
  });
}

export function createBlueprintFromElements(input: ElementBlueprintInput): MotionBlueprint {
  const inferredGoal = classifyGoal(input.goalText, input.pageType);
  const recommendationSource = input.recommendationSource ?? "local-fallback";
  const noMotionSuggestions = input.elements
    .map((element) => noMotionSuggestionFor(element))
    .filter((suggestion): suggestion is NoMotionSuggestion => Boolean(suggestion));
  const suppressedIds = new Set(noMotionSuggestions.map((suggestion) => suggestion.elementId));
  const elementsById = new Map(input.elements.map((element) => [element.id, element]));
  const opportunities = dedupeOpportunities(
    input.elements
      .filter((element) => !suppressedIds.has(element.id))
      .map((element) => opportunityFor(element, inferredGoal, input.pageType, recommendationSource))
      .sort((left, right) => right.score - left.score),
    elementsById
  ).slice(0, 5);

  return {
    version: "0.1",
    source: input.source,
    context: {
      pageType: input.pageType,
      goalText: input.goalText,
      inferredGoal
    },
    elements: input.elements,
    opportunities,
    diagnostics: {
      warnings: input.warnings ?? [],
      noMotionSuggestions,
      analysisMode: input.analysisMode ?? "hybrid"
    }
  };
}

export function createMotionPreviewSpec(
  blueprint: MotionBlueprint,
  opportunityId: string
): MotionPreviewSpec | undefined {
  const opportunity = blueprint.opportunities.find((item) => item.id === opportunityId);
  const element = opportunity
    ? blueprint.elements.find((item) => item.id === opportunity.elementId)
    : undefined;
  if (!opportunity || !element) return undefined;

  const role =
    element.kind === "button"
      ? "button"
      : element.kind === "modal"
        ? "modal"
        : element.kind === "feedback"
          ? "toast"
          : "sequence";

  return {
    opportunityId,
    role,
    patternId: opportunity.patternId,
    title: opportunity.patternName,
    params: opportunity.recommendedParams
  };
}
