export type ParsedBriefIntent = {
  query: string;
  categories: string[];
  componentKinds: string[];
  motionStyles: string[];
  sources: string[];
  keywords: string[];
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

function tokenize(value: string): string[] {
  return value.toLowerCase().split(/\W+/).filter(Boolean);
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function createEmptyBriefIntent(query = ""): ParsedBriefIntent {
  return {
    query,
    categories: [],
    componentKinds: [],
    motionStyles: [],
    sources: [],
    keywords: [],
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
    categories,
    componentKinds,
    motionStyles,
    sources,
    keywords,
    confidence: tokens.length > 0 ? 0.35 : 0
  };
}

export function briefIntentTerms(intent: ParsedBriefIntent): string[] {
  return unique([
    intent.query,
    ...intent.categories,
    ...intent.componentKinds,
    ...intent.motionStyles,
    ...intent.sources,
    ...intent.keywords
  ].flatMap(tokenize));
}

export function isParsedBriefIntent(value: unknown): value is ParsedBriefIntent {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ParsedBriefIntent>;
  return (
    typeof item.query === "string" &&
    Array.isArray(item.categories) &&
    Array.isArray(item.componentKinds) &&
    Array.isArray(item.motionStyles) &&
    Array.isArray(item.sources) &&
    Array.isArray(item.keywords) &&
    typeof item.confidence === "number"
  );
}
