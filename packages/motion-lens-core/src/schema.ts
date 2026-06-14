export type DesignSourceKind = "fixture" | "image" | "figma" | "url";

export type DesignSource = {
  kind: DesignSourceKind;
  id: string;
  name: string;
  width: number;
  height: number;
};

export type DesignElementKind =
  | "button"
  | "card"
  | "modal"
  | "form"
  | "nav"
  | "content"
  | "feedback"
  | "unknown";

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DesignElement = {
  id: string;
  kind: DesignElementKind;
  label: string;
  bounds: Rect;
  confidence: number;
  visualWeight: number;
  interactiveLikelihood: number;
  text?: string;
  isDecorative?: boolean;
};

export type BusinessGoal = "ctr" | "cvr" | "clarity" | "trust" | "feedback" | "retention";
export type DecisionStage = "discover" | "understand" | "evaluate" | "decide" | "act" | "feedback";
export type DecisionFriction = "attention" | "understanding" | "trust" | "confidence" | "motivation";
export type MotionStrategy = "attention" | "guidance" | "trust" | "feedback" | "reward";
export type OpportunityPriority = "P0" | "P1" | "P2";
export type RecommendationSource =
  | "llm-opportunity"
  | "llm-candidate-rule-recommendation"
  | "local-fallback"
  | "manual-pending";

export type RecommendedParams = {
  durationMs: number;
  delayMs?: number;
  easing: "standard" | "decelerate" | "accelerate" | "sharp" | "spring";
  transform?: string;
  repeat: "none" | "limited" | "loop";
};

export type MotionPattern = {
  id: string;
  name: string;
  strategy: MotionStrategy;
  supportedKinds: DesignElementKind[];
  frictions: DecisionFriction[];
  params: RecommendedParams;
  risks: string[];
};

export type MotionKnowledgeRef = {
  id: string;
  title: string;
  source: string;
  pageRange: string;
};

export type MotionReviewEvidence = {
  whyThisMotion: string;
  whyNotAlternatives: string;
  noMotionAssessment: string;
  differentiation: string;
  trigger: string;
};

export type MotionAlternativeRecommendation = {
  patternId: string;
  patternName: string;
  reason: string;
  recommendedParams: RecommendedParams;
  risks: string[];
};

export type MotionOpportunity = {
  id: string;
  elementId: string;
  recommendationSource: RecommendationSource;
  priority: OpportunityPriority;
  score: number;
  confidence: number;
  businessGoal: BusinessGoal;
  decisionStage: DecisionStage;
  friction: DecisionFriction;
  strategy: MotionStrategy;
  patternId: string;
  patternName: string;
  reason: string;
  reviewEvidence?: MotionReviewEvidence;
  alternativeRecommendations?: MotionAlternativeRecommendation[];
  risks: string[];
  recommendedParams: RecommendedParams;
  knowledgeRefs?: MotionKnowledgeRef[];
};

export type NoMotionSuggestion = {
  elementId: string;
  label: string;
  reason: string;
  recommendation: "no-motion";
  risks: string[];
};

export type MotionBlueprint = {
  version: "0.1";
  source: DesignSource;
  context: {
    pageType: string;
    goalText: string;
    inferredGoal: BusinessGoal;
  };
  elements: DesignElement[];
  opportunities: MotionOpportunity[];
  diagnostics: {
    warnings: string[];
    noMotionSuggestions: NoMotionSuggestion[];
    analysisMode: "fixture" | "fallback" | "hybrid";
  };
};

export type MotionDocument = {
  version: "0.1";
  kind: "motionlens-review";
  generatedAt: string;
  blueprint: MotionBlueprint;
  assets?: {
    imageDataUrl?: string;
  };
};

export type MotionPreviewSpec = {
  opportunityId: string;
  role: "button" | "modal" | "toast" | "sequence";
  patternId: string;
  title: string;
  params: RecommendedParams;
};

export type FixtureDraft = {
  id: string;
  name: string;
  pageType: string;
  defaultGoalText: string;
  source: DesignSource;
  elements: DesignElement[];
};
