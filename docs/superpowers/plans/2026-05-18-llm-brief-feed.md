# LLM Brief Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add LLM-backed brief parsing, a single-column discovery home with AI recommendations, a browseable component feed, and a separate component editor view.

**Architecture:** The LLM only parses a user brief into a structured `ParsedBriefIntent`; deterministic ranking remains in `@motion-tool/core`. The web app gets a Vite dev-server API endpoint at `/api/brief/parse`, falls back locally when the endpoint is unavailable, and uses internal React state to switch between `home` and `editor` views without adding a router dependency.

**Tech Stack:** TypeScript, React, Vite dev middleware, Vitest, OpenAI Responses API structured output, existing `MotionComponent`, `Recommendation`, `PreviewFrame`, `ParameterPanel`, and export flow.

---

## File Structure

- Create `packages/core/src/orchestrator/briefIntent.ts`
  - Owns `ParsedBriefIntent`, `BriefParseResult`, fallback parsing, validation, and intent-term extraction.
- Modify `packages/core/src/orchestrator/recommend.ts`
  - Accepts either raw `brief` or parsed `intent`; keeps legacy brief matching.
- Modify `packages/core/src/index.ts`
  - Exports brief intent helpers.
- Modify `packages/core/test/recommend.test.ts`
  - Covers intent ranking, fallback matching, and empty intent behavior.
- Create `apps/web/src/server/briefParser.ts`
  - Calls OpenAI Responses API and validates/parses structured output; returns fallback when no key exists.
- Create `apps/web/src/server/briefParser.test.ts`
  - Tests OpenAI response parsing and missing-key fallback without network calls.
- Create `apps/web/vite.config.ts`
  - Adds React plugin and a `/api/brief/parse` dev middleware.
- Create `apps/web/src/services/briefParserClient.ts`
  - Browser client for `/api/brief/parse` with local fallback on failure.
- Modify `apps/web/src/features/brief/BriefPanel.tsx`
  - Single-column input UI: textarea, large `AI Recommend` button, parse status chips.
- Modify `apps/web/src/features/library/ComponentCandidates.tsx`
  - Recommendation strip for submitted results.
- Create `apps/web/src/features/library/ComponentFeed.tsx`
  - Always-visible browse feed with filters and AI match badges.
- Modify `apps/web/src/App.tsx`
  - Splits home/editor views, async recommendation, selection navigation, and import/editor handling.
- Modify `apps/web/src/styles.css`
  - Implements the confirmed V5 top-to-bottom layout and editor view.

## Task 1: Add Parsed Brief Intent To Core Recommendation

**Files:**
- Create: `packages/core/src/orchestrator/briefIntent.ts`
- Modify: `packages/core/src/orchestrator/recommend.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/recommend.test.ts`

- [ ] **Step 1: Add failing core recommendation tests**

Append these tests to `packages/core/test/recommend.test.ts`:

```ts
import { createFallbackBriefIntent } from "../src/orchestrator/briefIntent";
```

Then add the following tests before the closing `});` of `describe("recommendComponents", () => {`:

```ts
  it("ranks components from parsed brief intent", () => {
    const results = recommendComponents({
      intent: {
        query: "workeasy hover button",
        categories: ["interaction"],
        componentKinds: ["button"],
        motionStyles: ["hover"],
        sources: ["workeasy"],
        keywords: ["save", "cta"],
        confidence: 0.9
      },
      components,
      limit: 3
    });

    expect(results[0]?.componentId).toBe("magnetic-button");
    expect(results[0]?.reason).toContain("parsed brief intent");
  });

  it("creates a fallback intent from raw brief text", () => {
    const intent = createFallbackBriefIntent("WorkEasy hover button with tech style");

    expect(intent.query).toBe("WorkEasy hover button with tech style");
    expect(intent.componentKinds).toContain("button");
    expect(intent.motionStyles).toContain("hover");
    expect(intent.sources).toContain("workeasy");
    expect(intent.keywords).toContain("tech");
  });

  it("handles empty parsed intent without crashing", () => {
    const results = recommendComponents({
      intent: {
        query: "",
        categories: [],
        componentKinds: [],
        motionStyles: [],
        sources: [],
        keywords: [],
        confidence: 0
      },
      components,
      limit: 2
    });

    expect(results).toHaveLength(2);
    expect(results[0]?.reason).toBe("Included as a fallback candidate.");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @motion-tool/core test test/recommend.test.ts
```

Expected: FAIL because `briefIntent` does not exist and `recommendComponents` does not accept `intent`.

- [ ] **Step 3: Create brief intent helpers**

Create `packages/core/src/orchestrator/briefIntent.ts`:

```ts
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
```

- [ ] **Step 4: Update recommendation to accept intent**

Modify `packages/core/src/orchestrator/recommend.ts` to:

```ts
import type { MotionComponent } from "../library/componentLibrary";
import type { MotionPatch } from "../manifest/types";
import { briefIntentTerms, type ParsedBriefIntent } from "./briefIntent";

export type Recommendation = {
  componentId: string;
  score: number;
  reason: string;
  initialPatch: MotionPatch;
};

function tokenize(value: string): string[] {
  return value.toLowerCase().split(/\W+/).filter(Boolean);
}

function componentHaystack(component: MotionComponent): string {
  const source = component.tags.includes("workeasy") ? "workeasy" : "native";
  return [
    component.name,
    component.category,
    source,
    ...component.tags,
    ...component.useCases,
    ...component.moods
  ]
    .join(" ")
    .toLowerCase();
}

export function recommendComponents(input: {
  brief?: string;
  intent?: ParsedBriefIntent;
  components: MotionComponent[];
  limit?: number;
}): Recommendation[] {
  const terms = input.intent ? briefIntentTerms(input.intent) : tokenize(input.brief ?? "");

  return input.components
    .map((component) => {
      const haystack = componentHaystack(component);
      const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
      const reason =
        score > 0
          ? input.intent
            ? "Matches the parsed brief intent."
            : "Matches the brief metadata."
          : "Included as a fallback candidate.";

      return {
        componentId: component.id,
        score,
        reason,
        initialPatch: {
          id: `${component.id}-initial`,
          sourceManifestId: component.manifest.id,
          values: {}
        }
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, input.limit ?? 6);
}
```

- [ ] **Step 5: Export brief intent helpers**

Modify `packages/core/src/index.ts`:

```ts
export * from "./orchestrator/briefIntent";
```

- [ ] **Step 6: Run core recommendation tests**

Run:

```bash
pnpm --filter @motion-tool/core test test/recommend.test.ts
pnpm --filter @motion-tool/core typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add packages/core/src/orchestrator/briefIntent.ts packages/core/src/orchestrator/recommend.ts packages/core/src/index.ts packages/core/test/recommend.test.ts
git commit -m "feat: parse brief intent for recommendations"
```

## Task 2: Add Server-Side Brief Parser Endpoint

**Files:**
- Create: `apps/web/src/server/briefParser.ts`
- Create: `apps/web/src/server/briefParser.test.ts`
- Create: `apps/web/vite.config.ts`

- [ ] **Step 1: Add failing brief parser tests**

Create `apps/web/src/server/briefParser.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseBriefWithOpenAI, parseOpenAIIntentResponse } from "./briefParser";

describe("briefParser", () => {
  it("extracts intent JSON from an OpenAI Responses payload", () => {
    const intent = parseOpenAIIntentResponse({
      output_text: JSON.stringify({
        query: "hover button",
        categories: ["interaction"],
        componentKinds: ["button"],
        motionStyles: ["hover"],
        sources: ["workeasy"],
        keywords: ["cta"],
        confidence: 0.88
      })
    });

    expect(intent?.componentKinds).toEqual(["button"]);
    expect(intent?.sources).toEqual(["workeasy"]);
  });

  it("returns fallback result when api key is missing", async () => {
    const result = await parseBriefWithOpenAI({ brief: "WorkEasy hover button" });

    expect(result.mode).toBe("fallback");
    expect(result.intent.componentKinds).toContain("button");
    expect(result.intent.sources).toContain("workeasy");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @motion-tool/web test src/server/briefParser.test.ts
```

Expected: FAIL because `briefParser` does not exist.

- [ ] **Step 3: Implement server parser**

Create `apps/web/src/server/briefParser.ts`:

```ts
import {
  createFallbackBriefIntent,
  isParsedBriefIntent,
  type BriefParseResult,
  type ParsedBriefIntent
} from "@motion-tool/core";

type ParseBriefInput = {
  brief: string;
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
};

const intentSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    query: { type: "string" },
    categories: { type: "array", items: { type: "string" } },
    componentKinds: { type: "array", items: { type: "string" } },
    motionStyles: { type: "array", items: { type: "string" } },
    sources: { type: "array", items: { type: "string" } },
    keywords: { type: "array", items: { type: "string" } },
    confidence: { type: "number" }
  },
  required: ["query", "categories", "componentKinds", "motionStyles", "sources", "keywords", "confidence"]
};

function fallback(brief: string, message: string): BriefParseResult {
  return {
    mode: "fallback",
    intent: createFallbackBriefIntent(brief),
    message
  };
}

function outputText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const response = payload as { output_text?: unknown; output?: unknown };
  if (typeof response.output_text === "string") return response.output_text;
  if (!Array.isArray(response.output)) return null;

  for (const item of response.output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") return text;
    }
  }

  return null;
}

export function parseOpenAIIntentResponse(payload: unknown): ParsedBriefIntent | null {
  const text = outputText(payload);
  if (!text) return null;

  try {
    const parsed = JSON.parse(text) as unknown;
    return isParsedBriefIntent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function parseBriefWithOpenAI(input: ParseBriefInput): Promise<BriefParseResult> {
  const brief = input.brief.trim();
  if (!brief) return fallback("", "Empty brief; using browse feed.");
  if (!input.apiKey) return fallback(brief, "OPENAI_API_KEY is not configured; using local matching.");

  const fetcher = input.fetchImpl ?? fetch;
  const response = await fetcher("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: input.model ?? "gpt-5.4-mini",
      input: [
        {
          role: "system",
          content:
            "Extract motion component discovery intent as JSON. Do not choose a final component. Do not generate code."
        },
        {
          role: "user",
          content: brief
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "brief_intent",
          strict: true,
          schema: intentSchema
        }
      }
    })
  });

  if (!response.ok) return fallback(brief, `LLM parse failed with HTTP ${response.status}; using local matching.`);

  const payload = (await response.json()) as unknown;
  const intent = parseOpenAIIntentResponse(payload);
  if (!intent) return fallback(brief, "LLM response was invalid; using local matching.");

  return {
    mode: "llm",
    intent,
    message: "LLM parsed"
  };
}
```

- [ ] **Step 4: Add Vite API middleware**

Create `apps/web/vite.config.ts`:

```ts
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { parseBriefWithOpenAI } from "./src/server/briefParser";

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function briefParserApiPlugin(): Plugin {
  return {
    name: "brief-parser-api",
    configureServer(server) {
      server.middlewares.use("/api/brief/parse", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        try {
          const raw = await readBody(req);
          const parsed = JSON.parse(raw || "{}") as { brief?: unknown };
          const brief = typeof parsed.brief === "string" ? parsed.brief : "";
          const result = await parseBriefWithOpenAI({
            brief,
            apiKey: process.env.OPENAI_API_KEY,
            model: process.env.OPENAI_BRIEF_MODEL
          });

          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result));
        } catch {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Failed to parse brief." }));
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), briefParserApiPlugin()]
});
```

- [ ] **Step 5: Run web parser tests and build**

Run:

```bash
pnpm --filter @motion-tool/web test src/server/briefParser.test.ts
pnpm --filter @motion-tool/web build
```

Expected: PASS. The build may print the known Node `20.18.1` Vite warning; it must exit `0`.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/web/src/server/briefParser.ts apps/web/src/server/briefParser.test.ts apps/web/vite.config.ts
git commit -m "feat: add brief parser api"
```

## Task 3: Add Browser Brief Parser Client And Brief UI

**Files:**
- Create: `apps/web/src/services/briefParserClient.ts`
- Modify: `apps/web/src/features/brief/BriefPanel.tsx`

- [ ] **Step 1: Create client parser service**

Create `apps/web/src/services/briefParserClient.ts`:

```ts
import { createFallbackBriefIntent, type BriefParseResult } from "@motion-tool/core";

export async function parseBrief(brief: string): Promise<BriefParseResult> {
  const trimmed = brief.trim();
  if (!trimmed) {
    return {
      mode: "fallback",
      intent: createFallbackBriefIntent(""),
      message: "Enter a brief to get AI recommendations."
    };
  }

  try {
    const response = await fetch("/api/brief/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brief: trimmed })
    });

    if (!response.ok) throw new Error(`Brief parser failed: ${response.status}`);
    return (await response.json()) as BriefParseResult;
  } catch {
    return {
      mode: "fallback",
      intent: createFallbackBriefIntent(trimmed),
      message: "Using local matching."
    };
  }
}
```

- [ ] **Step 2: Replace brief panel UI**

Modify `apps/web/src/features/brief/BriefPanel.tsx`:

```tsx
import type { BriefParseResult } from "@motion-tool/core";

type Props = {
  brief: string;
  parseResult: BriefParseResult | null;
  isLoading: boolean;
  onBriefChange: (brief: string) => void;
  onRecommend: () => void;
};

function parsedChips(parseResult: BriefParseResult | null): string[] {
  if (!parseResult) return [];
  return [
    ...parseResult.intent.componentKinds,
    ...parseResult.intent.motionStyles,
    ...parseResult.intent.sources,
    ...parseResult.intent.keywords
  ].slice(0, 8);
}

export function BriefPanel({ brief, parseResult, isLoading, onBriefChange, onRecommend }: Props) {
  const chips = parsedChips(parseResult);

  return (
    <section className="discovery-panel" aria-label="Brief recommendation">
      <div className="brief-stack">
        <div>
          <p className="eyebrow">Brief input</p>
          <h1>Describe what you need</h1>
          <p className="muted">Use natural language to get AI-ranked motion components, or browse the feed below.</p>
        </div>
        <textarea value={brief} onChange={(event) => onBriefChange(event.target.value)} rows={5} />
        <button className="ai-recommend-button" type="button" onClick={onRecommend} disabled={isLoading}>
          {isLoading ? "Recommending..." : "AI Recommend"}
        </button>
        {parseResult ? (
          <div className="status-grid" aria-label="Brief parse status">
            <span className="status-pill">{parseResult.mode === "llm" ? "LLM parsed" : "local fallback ready"}</span>
            <span className="status-pill muted">{parseResult.message}</span>
            {chips.map((chip) => (
              <span className="brief-chip" key={chip}>
                {chip}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Run web typecheck**

Run:

```bash
pnpm --filter @motion-tool/web typecheck
```

Expected: FAIL because `App.tsx` still passes the old `BriefPanel` props.

- [ ] **Step 4: Stop after the expected failure**

Do not commit this task yet if only `BriefPanel` changed and typecheck fails. Continue to Task 4, which wires the new props from `App.tsx`.

## Task 4: Split App Into Home And Editor Views

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/features/library/ComponentCandidates.tsx`

- [ ] **Step 1: Replace candidate component with recommendation strip**

Modify `apps/web/src/features/library/ComponentCandidates.tsx`:

```tsx
import type { MotionComponent, Recommendation } from "@motion-tool/core";

type Props = {
  recommendations: Recommendation[];
  components: MotionComponent[];
  onSelect: (componentId: string) => void;
};

export function ComponentCandidates({ recommendations, components, onSelect }: Props) {
  const componentById = new Map(components.map((component) => [component.id, component]));
  if (recommendations.length === 0) return null;

  return (
    <section className="recommendation-strip" aria-label="AI recommended components">
      <div>
        <p className="eyebrow">AI Recommended</p>
        <h2>Matched components</h2>
        <p className="muted">These results appear after submitting a brief.</p>
      </div>
      <div className="recommendation-list">
        {recommendations.map((item, index) => {
          const component = componentById.get(item.componentId);
          const source = component?.tags.includes("workeasy") ? "WorkEasy" : "Native";
          return (
            <button
              className={index === 0 ? "recommendation-card is-top" : "recommendation-card"}
              key={item.componentId}
              type="button"
              onClick={() => onSelect(item.componentId)}
            >
              <strong>{component?.name ?? item.componentId}</strong>
              <span>{item.reason}</span>
              <div className="score-bar">
                <span style={{ width: `${Math.min(100, item.score * 24)}%` }} />
              </div>
              <small>
                {source} · {component?.category ?? "component"} · {component?.manifest.params.length ?? 0} params
              </small>
              <em>Open editor page -></em>
            </button>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Replace App with home/editor state**

Modify `apps/web/src/App.tsx` by keeping the existing imports and `heroComponent`, then update imports to include:

```ts
import { useMemo, useState } from "react";
import {
  confirmValidParams,
  importMotionSourceFromFiles,
  recommendComponents,
  scanSourceForParams,
  suggestParams,
  type BriefParseResult,
  type MotionComponent,
  type MotionManifest,
  type MotionParam,
  type MotionSource,
  type Recommendation
} from "@motion-tool/core";
import { parseBrief } from "./services/briefParserClient";
```

Replace the `App` component body with:

```tsx
type View = "home" | "editor";

export function App() {
  const [view, setView] = useState<View>("home");
  const [brief, setBrief] = useState("subtle saas hero text");
  const [parseResult, setParseResult] = useState<BriefParseResult | null>(null);
  const [isRecommending, setIsRecommending] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [project, setProject] = useState<MotionProject | null>(null);
  const [pendingImport, setPendingImport] = useState<MotionSource | null>(null);
  const [suggestedParams, setSuggestedParams] = useState<MotionParam[]>([]);
  const [selectedParamIds, setSelectedParamIds] = useState<Set<string>>(new Set());

  const aiMatchIds = useMemo(() => new Set(recommendations.map((item) => item.componentId)), [recommendations]);

  function updateParam(paramId: string, value: unknown) {
    setProject((current) => {
      if (!current) return current;

      return {
        ...current,
        patch: {
          ...current.patch,
          values: { ...current.patch.values, [paramId]: value }
        }
      };
    });
  }

  async function runRecommend() {
    setIsRecommending(true);
    const result = await parseBrief(brief);
    setParseResult(result);
    setRecommendations(recommendComponents({ intent: result.intent, components }));
    setIsRecommending(false);
  }

  function selectComponent(componentId: string) {
    const component = components.find((item) => item.id === componentId);
    if (!component) return;

    setProject(createProject(component.source, component.manifest));
    setView("editor");
  }

  function importFiles(files: Record<string, string>) {
    const result = importMotionSourceFromFiles(files);
    const suggested = suggestParams(scanSourceForParams(result.source));
    setPendingImport(result.source);
    setSuggestedParams(suggested);
    setSelectedParamIds(new Set(suggested.map((param) => param.id)));
  }

  function toggleParam(id: string) {
    setSelectedParamIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function confirmImport() {
    if (!pendingImport) return;

    const selected = suggestedParams.filter((param) => selectedParamIds.has(param.id));
    const validation = confirmValidParams({ source: pendingImport, params: selected });
    const manifest: MotionManifest = {
      version: "1.0",
      id: `${pendingImport.id}-manifest`,
      name: "Imported Motion",
      sourceKind: pendingImport.kind,
      runtime: { engine: "html", entry: pendingImport.entry, sandbox: "iframe" },
      params: validation.confirmed,
      capabilities: ["imported", "editable", "export-html"]
    };

    setProject(createProject(pendingImport, manifest));
    setView("editor");
  }

  if (view === "editor") {
    return (
      <main className="editor-shell">
        <header className="editor-header">
          <button type="button" onClick={() => setView("home")}>
            Back to feed
          </button>
          <div>
            <p className="eyebrow">Editor</p>
            <h1>{project?.manifest.name ?? "Component Editor"}</h1>
          </div>
        </header>
        <section className="editor-preview" aria-label="Motion preview">
          <PreviewFrame source={project?.source ?? null} manifest={project?.manifest ?? null} patch={project?.patch ?? null} />
        </section>
        <aside className="editor-inspector" aria-label="Parameters">
          <div className="panel-header">
            <p className="eyebrow">Inspector</p>
            <h2>Parameters</h2>
          </div>
          <ParameterPanel manifest={project?.manifest ?? null} patch={project?.patch ?? null} onChange={updateParam} />
        </aside>
        <footer className="transport" aria-label="Playback and export controls">
          <button type="button" onClick={() => setProject((current) => (current ? { ...current } : current))}>
            Replay
          </button>
          <button type="button">Pause</button>
          <button type="button">Viewport</button>
          <ExportPanel project={project} />
        </footer>
      </main>
    );
  }

  return (
    <main className="home-shell">
      <div className="home-header">
        <p className="eyebrow">AI Motion Tool</p>
        <h1>Find editable motion components</h1>
      </div>
      <BriefPanel
        brief={brief}
        parseResult={parseResult}
        isLoading={isRecommending}
        onBriefChange={setBrief}
        onRecommend={runRecommend}
      />
      <ComponentCandidates recommendations={recommendations} components={components} onSelect={selectComponent} />
      <ImportPanel onImport={importFiles} />
      <ConfirmParamsPanel params={suggestedParams} selected={selectedParamIds} onToggle={toggleParam} onConfirm={confirmImport} />
      <ComponentFeed components={components} aiMatchIds={aiMatchIds} onSelect={selectComponent} />
    </main>
  );
}
```

Add this import to `App.tsx`; `ComponentFeed` is created in Task 5:

```ts
import { ComponentFeed } from "./features/library/ComponentFeed";
```

- [ ] **Step 3: Run web typecheck to verify expected failure**

Run:

```bash
pnpm --filter @motion-tool/web typecheck
```

Expected: FAIL because `ComponentFeed` does not exist yet.

- [ ] **Step 4: Continue to Task 5 before committing**

Do not commit until `ComponentFeed` exists and web typecheck passes.

## Task 5: Add Component Feed

**Files:**
- Create: `apps/web/src/features/library/ComponentFeed.tsx`

- [ ] **Step 1: Create feed component**

Create `apps/web/src/features/library/ComponentFeed.tsx`:

```tsx
import { useMemo, useState } from "react";
import type { MotionComponent } from "@motion-tool/core";

type Filter = "all" | "workeasy" | "native" | "buttons" | "cards" | "checkboxes";

type Props = {
  components: MotionComponent[];
  aiMatchIds: Set<string>;
  onSelect: (componentId: string) => void;
};

const filters: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "workeasy", label: "WorkEasy" },
  { id: "native", label: "Native" },
  { id: "buttons", label: "Buttons" },
  { id: "cards", label: "Cards" },
  { id: "checkboxes", label: "Checkboxes" }
];

function sourceLabel(component: MotionComponent): "WorkEasy" | "Native" {
  return component.tags.includes("workeasy") ? "WorkEasy" : "Native";
}

function componentKind(component: MotionComponent): string {
  if (component.tags.includes("buttons")) return "button";
  if (component.tags.includes("cards")) return "card";
  if (component.tags.includes("checkboxes")) return "checkbox";
  return component.category;
}

function matchesFilter(component: MotionComponent, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "workeasy") return sourceLabel(component) === "WorkEasy";
  if (filter === "native") return sourceLabel(component) === "Native";
  return component.tags.includes(filter);
}

export function ComponentFeed({ components, aiMatchIds, onSelect }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const visible = useMemo(() => components.filter((component) => matchesFilter(component, filter)), [components, filter]);

  return (
    <section className="feed-panel" aria-label="Browse component feed">
      <div className="feed-header">
        <div>
          <p className="eyebrow">Browse component feed</p>
          <h2>Explore all components</h2>
          <p className="muted">Browse directly or use the brief above to highlight AI matches.</p>
        </div>
        <div className="feed-filters" aria-label="Component filters">
          {filters.map((item) => (
            <button
              className={item.id === filter ? "filter-pill is-on" : "filter-pill"}
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="feed-grid">
        {visible.map((component) => {
          const isAiMatch = aiMatchIds.has(component.id);
          return (
            <button
              className={isAiMatch ? "feed-card is-ai-match" : "feed-card"}
              key={component.id}
              type="button"
              onClick={() => onSelect(component.id)}
            >
              <span className={`feed-thumb ${componentKind(component)}`} aria-hidden="true">
                {componentKind(component)}
              </span>
              <span className="feed-body">
                <strong>{component.name}</strong>
                <small>
                  {sourceLabel(component)} · {component.category} · {component.manifest.params.length} params
                </small>
                {isAiMatch ? <em>AI match</em> : null}
                <span>Open editor page -&gt;</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Run web typecheck**

Run:

```bash
pnpm --filter @motion-tool/web typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit Tasks 3-5 together**

Run:

```bash
git add apps/web/src/services/briefParserClient.ts apps/web/src/features/brief/BriefPanel.tsx apps/web/src/features/library/ComponentCandidates.tsx apps/web/src/features/library/ComponentFeed.tsx apps/web/src/App.tsx
git commit -m "feat: add discovery home and editor view"
```

## Task 6: Apply V5 Single-Column Styling

**Files:**
- Modify: `apps/web/src/styles.css`

- [ ] **Step 1: Replace layout styles**

Modify `apps/web/src/styles.css` by replacing the old `.app-shell`, `.sidebar`, `.preview`, `.parameters`, `.candidate-*`, and `.transport` layout blocks with this V5-compatible styling. Keep the existing root variables, button/input base styles, `.field-list`, `.field`, `.check-field`, `.muted`, and media query reset rules.

```css
.home-shell {
  display: grid;
  gap: 18px;
  min-height: 100vh;
  padding: 24px;
}

.home-header,
.discovery-panel,
.recommendation-strip,
.feed-panel,
.tool-section {
  width: min(1180px, 100%);
  margin-inline: auto;
}

.home-header {
  display: grid;
  gap: 4px;
}

.discovery-panel,
.recommendation-strip,
.feed-panel,
.tool-section {
  display: grid;
  gap: 16px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel);
  padding: 22px;
}

.brief-stack {
  display: grid;
  gap: 14px;
  max-width: 980px;
}

.brief-stack textarea {
  min-height: 124px;
  border-radius: 10px;
}

.ai-recommend-button {
  width: min(440px, 100%);
  min-height: 72px;
  border: 0;
  border-radius: 12px;
  background: var(--accent);
  color: #ffffff;
  font-size: 20px;
  font-weight: 800;
}

.ai-recommend-button:hover {
  background: var(--accent-strong);
}

.status-grid,
.feed-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.status-pill,
.brief-chip {
  border-radius: 999px;
  font-size: 15px;
  font-weight: 800;
  padding: 12px 17px;
}

.status-pill,
.brief-chip {
  background: #eef6f5;
  color: var(--accent);
}

.status-pill.muted {
  background: #f1f5f9;
  color: var(--muted);
}

.recommendation-list {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.recommendation-card {
  display: grid;
  height: auto;
  gap: 8px;
  justify-items: start;
  border-radius: 8px;
  padding: 12px;
  text-align: left;
}

.recommendation-card.is-top {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(15, 118, 110, 0.1);
}

.recommendation-card span,
.recommendation-card small {
  color: var(--muted);
  font-size: 12px;
}

.recommendation-card em,
.feed-card em,
.feed-card span:last-child {
  color: var(--accent);
  font-size: 11px;
  font-style: normal;
  font-weight: 800;
}

.score-bar {
  width: 100%;
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: #e5e7eb;
}

.score-bar span {
  display: block;
  height: 100%;
  background: var(--accent);
}

.feed-header {
  display: grid;
  gap: 12px;
}

.filter-pill {
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
}

.filter-pill.is-on {
  border-color: var(--accent);
  color: var(--accent);
}

.feed-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}

.feed-card {
  display: grid;
  height: auto;
  overflow: hidden;
  padding: 0;
  text-align: left;
}

.feed-card.is-ai-match {
  border-color: var(--accent);
}

.feed-thumb {
  display: grid;
  place-items: center;
  min-height: 128px;
  background: #111827;
  color: #ffffff;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
}

.feed-thumb.card {
  background: #eef2f7;
  color: var(--text);
}

.feed-thumb.checkbox {
  background: #eef6f5;
  color: var(--accent);
}

.feed-body {
  display: grid;
  gap: 6px;
  padding: 10px;
}

.feed-body small {
  color: var(--muted);
  font-size: 12px;
}

.editor-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  grid-template-rows: auto minmax(0, 1fr) 56px;
  min-height: 100vh;
}

.editor-header {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 14px;
  border-bottom: 1px solid var(--line);
  background: var(--panel);
  padding: 14px 18px;
}

.editor-preview {
  display: grid;
  min-width: 0;
  padding: 24px;
}

.editor-inspector {
  border-left: 1px solid var(--line);
  background: var(--panel);
  padding: 18px;
}

.transport {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 8px;
  border-top: 1px solid var(--line);
  background: var(--panel);
  padding: 10px 14px;
}
```

Append this media query:

```css
@media (max-width: 900px) {
  .home-shell {
    padding: 16px;
  }

  .recommendation-list {
    grid-template-columns: 1fr;
  }

  .editor-shell {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(360px, 1fr) auto auto;
  }

  .editor-inspector {
    border-left: 0;
    border-top: 1px solid var(--line);
  }

  .transport {
    flex-wrap: wrap;
  }
}
```

- [ ] **Step 2: Run web typecheck and build**

Run:

```bash
pnpm --filter @motion-tool/web typecheck
pnpm --filter @motion-tool/web build
```

Expected: PASS. The build may print the known Node `20.18.1` Vite warning; it must exit `0`.

- [ ] **Step 3: Commit**

Run:

```bash
git add apps/web/src/styles.css
git commit -m "feat: style discovery feed layout"
```

## Task 7: Final Verification And Browser Smoke Test

**Files:**
- Modify only files required by verification failures.

- [ ] **Step 1: Run full core test suite**

Run:

```bash
pnpm --filter @motion-tool/core test
```

Expected: all tests PASS.

- [ ] **Step 2: Run workspace typecheck**

Run:

```bash
pnpm -r typecheck
```

Expected: PASS.

- [ ] **Step 3: Run web test suite**

Run:

```bash
pnpm --filter @motion-tool/web test
```

Expected: PASS.

- [ ] **Step 4: Run web build**

Run:

```bash
pnpm --filter @motion-tool/web build
```

Expected: PASS. The known Node `20.18.1` Vite warning is acceptable only if the command exits `0`.

- [ ] **Step 5: Start dev server**

Run:

```bash
pnpm --filter @motion-tool/web dev
```

Expected: Vite prints a local URL, usually `http://127.0.0.1:5177/` if earlier ports are occupied.

- [ ] **Step 6: Smoke test in browser**

Open the local URL and verify:

- Home page uses top-to-bottom layout; no left/right discovery split.
- `AI Recommend` button is directly below the brief textarea.
- With no `OPENAI_API_KEY`, submitting `button hover workeasy` shows fallback status chips and recommended WorkEasy buttons.
- Recommendation cards appear below the button/status area.
- Component feed is visible below recommendations.
- Feed filters work for `WorkEasy`, `Buttons`, `Cards`, and `Checkboxes`.
- Clicking a recommendation opens the editor view.
- Clicking a feed card opens the editor view.
- Editor view shows iframe preview and parameter inspector.
- Export still downloads an editable package JSON.

- [ ] **Step 7: Commit verification fixes if needed**

If fixes were required, commit the exact changed files:

```bash
git add packages/core/src/orchestrator/briefIntent.ts packages/core/src/orchestrator/recommend.ts packages/core/src/index.ts packages/core/test/recommend.test.ts apps/web/src/server/briefParser.ts apps/web/src/server/briefParser.test.ts apps/web/vite.config.ts apps/web/src/services/briefParserClient.ts apps/web/src/features/brief/BriefPanel.tsx apps/web/src/features/library/ComponentCandidates.tsx apps/web/src/features/library/ComponentFeed.tsx apps/web/src/App.tsx apps/web/src/styles.css
git commit -m "fix: verify llm brief feed flow"
```

If no fixes were required, do not create an empty commit.

## Self-Review Notes

- Spec coverage: LLM backend proxy, structured intent, local fallback, top-to-bottom home, post-submit recommendations, always-visible feed, feed filters, AI match badges, editor view, and export preservation are each covered by tasks.
- Scope boundary: URL routing, accounts, saved sessions, multi-turn chat, LLM-generated code, direct source mutation by LLM, and new WorkEasy categories remain excluded.
- OpenAI implementation note: use Responses API with `text.format` JSON Schema structured output. Default model is `gpt-5.4-mini`, overrideable through `OPENAI_BRIEF_MODEL`; `OPENAI_API_KEY` stays server-side.
