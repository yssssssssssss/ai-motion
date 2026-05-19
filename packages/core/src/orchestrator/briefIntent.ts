export type ParsedBriefIntent = {
  query: string;
  semanticQuery: string;
  categories: string[];
  componentKinds: string[];
  motionStyles: string[];
  sources: string[];
  keywords: string[];
  softPreferences: string[];
  hardConstraints: string[];
  negativePreferences: string[];
  reasoningHints: string[];
  confidence: number;
};

export type BriefParseResult = {
  mode: "llm" | "fallback";
  intent: ParsedBriefIntent;
  message: string;
};

const KIND_TERMS = ["button", "card", "checkbox", "hero", "text"];
const MOTION_TERMS = ["hover", "reveal", "transition", "animation", "micro", "magnetic", "rainbow"];
const SOURCE_TERMS = ["workeasy", "native"];
const CATEGORY_BY_KIND: Record<string, string> = {
  button: "interaction",
  checkbox: "interaction",
  card: "layout",
  hero: "text",
  text: "text"
};

const PREFERENCE_GROUPS = [
  ["按钮", "button", "cta"],
  ["卡片", "card"],
  ["选择控件", "checkbox", "checklist", "表单"],
  ["文字", "text", "hero", "reveal"],
  ["hover", "悬停"],
  ["紫色", "purple", "violet"],
  ["蓝色", "blue"],
  ["渐变", "gradient"],
  ["发光", "glow", "shadow", "霓虹"],
  ["活动页", "campaign", "营销页"],
  ["落地页", "landing-page", "landing"],
  ["科技感", "tech", "saas"]
];

function tokenize(value: string): string[] {
  return value.toLowerCase().split(/\W+/).filter(Boolean);
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function preferenceTerms(value: string): string[] {
  const lower = value.toLowerCase();
  const terms = tokenize(value);

  for (const group of PREFERENCE_GROUPS) {
    if (group.some((term) => lower.includes(term.toLowerCase()))) {
      terms.push(...group);
    }
  }

  return unique(terms);
}

export function createEmptyBriefIntent(query = ""): ParsedBriefIntent {
  return {
    query,
    semanticQuery: query,
    categories: [],
    componentKinds: [],
    motionStyles: [],
    sources: [],
    keywords: [],
    softPreferences: [],
    hardConstraints: [],
    negativePreferences: [],
    reasoningHints: [],
    confidence: 0
  };
}

export function createFallbackBriefIntent(brief: string): ParsedBriefIntent {
  const tokens = tokenize(brief);
  const componentKinds = unique(tokens.filter((token) => KIND_TERMS.includes(token)));
  const motionStyles = unique(tokens.filter((token) => MOTION_TERMS.includes(token)));
  const sources = unique(tokens.filter((token) => SOURCE_TERMS.includes(token)));
  const categories = unique(componentKinds.map((kind) => CATEGORY_BY_KIND[kind] ?? ""));
  const reserved = new Set([...componentKinds, ...motionStyles, ...sources, ...categories]);
  const keywords = unique(tokens.filter((token) => !reserved.has(token)).slice(0, 8));

  return {
    query: brief,
    semanticQuery: brief,
    categories,
    componentKinds,
    motionStyles,
    sources,
    keywords,
    softPreferences: unique([
      ...componentKinds,
      ...motionStyles,
      ...sources,
      ...keywords,
      ...preferenceTerms(brief)
    ]).slice(0, 16),
    hardConstraints: [],
    negativePreferences: [],
    reasoningHints: [],
    confidence: tokens.length > 0 ? 0.35 : 0
  };
}

export function briefIntentTerms(intent: ParsedBriefIntent): string[] {
  const values = [
    intent.query,
    intent.semanticQuery,
    ...intent.categories,
    ...intent.componentKinds,
    ...intent.motionStyles,
    ...intent.sources,
    ...intent.keywords,
    ...intent.softPreferences,
    ...intent.hardConstraints,
    ...intent.negativePreferences,
    ...intent.reasoningHints
  ];

  return unique(values.flatMap((value) => [value, ...tokenize(value)]));
}

export function isParsedBriefIntent(value: unknown): value is ParsedBriefIntent {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ParsedBriefIntent>;
  return (
    typeof item.query === "string" &&
    typeof item.semanticQuery === "string" &&
    Array.isArray(item.categories) &&
    Array.isArray(item.componentKinds) &&
    Array.isArray(item.motionStyles) &&
    Array.isArray(item.sources) &&
    Array.isArray(item.keywords) &&
    Array.isArray(item.softPreferences) &&
    Array.isArray(item.hardConstraints) &&
    Array.isArray(item.negativePreferences) &&
    Array.isArray(item.reasoningHints) &&
    typeof item.confidence === "number"
  );
}
