export type KnowledgeSourceId = "motion-design-spec" | "human-empathy-research";

export type MotionGoal =
  | "attention"
  | "feedback"
  | "spatial-logic"
  | "efficiency"
  | "trust"
  | "emotion"
  | "conversion"
  | "retention";

export type ElementKind =
  | "button"
  | "card"
  | "modal"
  | "content"
  | "feedback"
  | "navigation"
  | "loading"
  | "icon"
  | "list";

export type KnowledgeRef = {
  sourceId: KnowledgeSourceId;
  sourceTitle: string;
  pageRange: string;
  quote: string;
};

export type KnowledgeBaseItem = {
  id: string;
  title: string;
  sourceRefs: KnowledgeRef[];
  summary: string;
  appliesTo: ElementKind[];
  goals: MotionGoal[];
  pageTypes: string[];
  tags: string[];
};

export type MotionPrinciple = KnowledgeBaseItem & {
  type: "principle";
  rule: string;
  constraints: string[];
};

export type MotionPatternKnowledge = KnowledgeBaseItem & {
  type: "pattern";
  params: {
    durationMs: [number, number];
    easing: string[];
    repeat: "none" | "limited" | "loop";
  };
  avoidWhen: string[];
};

export type MotionCase = KnowledgeBaseItem & {
  type: "case";
  chainStage: "购物前" | "购物中" | "购物后" | "通用";
  touchpoint: string;
  observedMotion: string;
  value: string;
};

export type MotionRiskRule = KnowledgeBaseItem & {
  type: "risk-rule";
  risk: string;
  mitigation: string;
};

export type MotionKnowledgeItem = MotionPrinciple | MotionPatternKnowledge | MotionCase | MotionRiskRule;

export type KnowledgeQuery = {
  query?: string;
  elementKind?: ElementKind;
  pageType?: string;
  goal?: MotionGoal;
  limit?: number;
};

export type KnowledgeSearchHit = {
  item: MotionKnowledgeItem;
  score: number;
  matchedBy: string[];
};
