# Controlled Generation Source Hydration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "自然语义生成" generate from real Top 3 hydrated component sources instead of placeholder source records.

**Architecture:** Keep the API route as the execution boundary and keep source loading in the web client where `onLoadComponentSource` already exists. The web layer first picks a small recommendation pool, hydrates only that pool, recomputes the controlled-generation Top 3, then posts those hydrated candidates to `/api/generation/controlled`.

**Tech Stack:** TypeScript, React, Vite, Vitest, existing `recommendComponents`, `createGenerationPlan`, `hasRenderableSource`, `generateControlledComponent`.

---

## File Structure

- Create `apps/web/src/services/generationCandidates.ts`
  - Owns recommendation-pool selection, source hydration, and final Top 3 candidate preparation.
- Create `apps/web/src/services/generationCandidates.test.ts`
  - Proves placeholder source is loaded before generation and already-renderable source is not loaded again.
- Modify `apps/web/src/routes/HomeRoute.tsx`
  - Replaces direct `components` submission with hydrated Top 3 candidate submission.
- Create `apps/web/src/routes/HomeRoute.test.ts`
  - Locks the route wiring so future edits do not regress to `generateControlledComponent({ brief, components })`.
- No server registry refactor.
- No full-library eager hydration.
- No arbitrary source-code generation.

---

### Task 1: Add Candidate Hydration Service

**Files:**
- Create: `apps/web/src/services/generationCandidates.ts`
- Create: `apps/web/src/services/generationCandidates.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/services/generationCandidates.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import type { MotionComponent } from "@motion-tool/core";
import { loadControlledGenerationCandidates } from "./generationCandidates";

function component(input: {
  id: string;
  name: string;
  tags: string[];
  entryContent: string;
}): MotionComponent {
  return {
    id: input.id,
    name: input.name,
    category: "media",
    tags: input.tags,
    useCases: ["product-detail"],
    moods: ["clean"],
    manifest: {
      version: "1.0",
      id: input.id,
      name: input.name,
      sourceKind: "builtin-component",
      runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
      capabilities: ["builtin", "editable", "export-html"],
      designSpecs: [{ id: "ecommerce-transition-motion-skill", confidence: 0.9 }],
      layers: [
        {
          id: "productImage",
          label: "商品图",
          kind: "image",
          replaceable: true,
          paramId: "productImage",
          targets: [{ kind: "css-variable", file: "source/assets.css", selector: ":root", name: "--product-image" }]
        }
      ],
      params: [
        {
          id: "transitionDuration",
          label: "转场速度",
          type: "duration",
          default: 620,
          constraints: { min: 220, max: 1400, step: 20, unit: "ms" },
          status: "confirmed",
          targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--motion-duration" }]
        }
      ]
    },
    source: {
      id: input.id,
      origin: "builtin",
      kind: "builtin-component",
      entry: "source/index.html",
      files: [
        { path: "source/index.html", kind: "html", content: input.entryContent },
        { path: "source/style.css", kind: "css", content: ":root { --motion-duration: 620ms; }" },
        { path: "source/assets.css", kind: "css", content: ":root { --product-image: none; }" }
      ]
    }
  };
}

describe("loadControlledGenerationCandidates", () => {
  it("hydrates recommended placeholder components before returning generation candidates", async () => {
    const placeholder = component({
      id: "product-transition",
      name: "商品详情转场",
      tags: ["ecommerce", "product", "transition"],
      entryContent: ""
    });
    const hydrated = component({
      id: "product-transition",
      name: "商品详情转场",
      tags: ["ecommerce", "product", "transition"],
      entryContent: "<main data-motion-root></main>"
    });
    const loadComponentSource = vi.fn(async () => hydrated);

    const candidates = await loadControlledGenerationCandidates({
      brief: "商品详情转场快一点",
      components: [placeholder],
      onLoadComponentSource: loadComponentSource
    });

    expect(loadComponentSource).toHaveBeenCalledWith(placeholder);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.id).toBe("product-transition");
    expect(candidates[0]?.source.files[0]?.content).toContain("data-motion-root");
  });

  it("does not reload candidates that already have renderable entry source", async () => {
    const ready = component({
      id: "product-transition",
      name: "商品详情转场",
      tags: ["ecommerce", "product", "transition"],
      entryContent: "<main data-motion-root></main>"
    });
    const loadComponentSource = vi.fn(async () => ready);

    const candidates = await loadControlledGenerationCandidates({
      brief: "商品详情转场快一点",
      components: [ready],
      onLoadComponentSource: loadComponentSource
    });

    expect(loadComponentSource).not.toHaveBeenCalled();
    expect(candidates.map((candidate) => candidate.id)).toEqual(["product-transition"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @motion-tool/web test -- generationCandidates.test.ts
```

Expected: FAIL because `apps/web/src/services/generationCandidates.ts` does not exist.

- [ ] **Step 3: Implement the minimal service**

Create `apps/web/src/services/generationCandidates.ts`:

```ts
import {
  createGenerationPlan,
  recommendComponents,
  type MotionComponent
} from "@motion-tool/core";
import { hasRenderableSource } from "../features/library/sourceState";

const GENERATION_PREFETCH_LIMIT = 6;
const GENERATION_CANDIDATE_LIMIT = 3;

export type LoadControlledGenerationCandidatesInput = {
  brief: string;
  components: MotionComponent[];
  onLoadComponentSource: (component: MotionComponent) => Promise<MotionComponent>;
};

function componentById(components: MotionComponent[]): Map<string, MotionComponent> {
  return new Map(components.map((component) => [component.id, component]));
}

async function hydrateCandidate(
  component: MotionComponent,
  onLoadComponentSource: (component: MotionComponent) => Promise<MotionComponent>
): Promise<MotionComponent> {
  return hasRenderableSource(component) ? component : onLoadComponentSource(component);
}

export async function loadControlledGenerationCandidates({
  brief,
  components,
  onLoadComponentSource
}: LoadControlledGenerationCandidatesInput): Promise<MotionComponent[]> {
  const byId = componentById(components);
  const recommendationPool = recommendComponents({
    brief,
    components,
    limit: GENERATION_PREFETCH_LIMIT
  })
    .map((recommendation) => byId.get(recommendation.componentId))
    .filter((component): component is MotionComponent => Boolean(component));

  const hydratedPool = await Promise.all(
    recommendationPool.map((component) => hydrateCandidate(component, onLoadComponentSource))
  );
  const hydratedById = componentById(hydratedPool);
  const plan = createGenerationPlan({
    brief,
    components: hydratedPool,
    limit: GENERATION_CANDIDATE_LIMIT
  });

  return plan.candidates
    .map((candidate) => hydratedById.get(candidate.componentId))
    .filter((component): component is MotionComponent => Boolean(component));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @motion-tool/web test -- generationCandidates.test.ts
```

Expected: PASS.

---

### Task 2: Wire Hydrated Candidates Into HomeRoute

**Files:**
- Modify: `apps/web/src/routes/HomeRoute.tsx`
- Create: `apps/web/src/routes/HomeRoute.test.ts`

- [ ] **Step 1: Write the failing route wiring test**

Create `apps/web/src/routes/HomeRoute.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const homeRouteSource = readFileSync(new URL("./HomeRoute.tsx", import.meta.url), "utf8");

describe("HomeRoute controlled generation wiring", () => {
  it("loads hydrated Top 3 candidates before calling the generation API", () => {
    expect(homeRouteSource).toContain("loadControlledGenerationCandidates");
    expect(homeRouteSource).toContain("onLoadComponentSource");
    expect(homeRouteSource).toContain("generateControlledComponent({ brief, components: generationCandidates })");
    expect(homeRouteSource).not.toContain("generateControlledComponent({ brief, components })");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @motion-tool/web test -- HomeRoute.test.ts
```

Expected: FAIL because `HomeRoute` still posts raw `components`.

- [ ] **Step 3: Replace raw component submission**

Modify `apps/web/src/routes/HomeRoute.tsx`.

Add import:

```ts
import { loadControlledGenerationCandidates } from "../services/generationCandidates";
```

Replace the current API call inside `runGenerate`:

```ts
const result = await generateControlledComponent({ brief, components });
```

with:

```ts
const generationCandidates = await loadControlledGenerationCandidates({
  brief,
  components,
  onLoadComponentSource
});
if (generationCandidates.length === 0) {
  setGenerationStatus("没有可用于受控生成的候选组件");
  return;
}

const result = await generateControlledComponent({ brief, components: generationCandidates });
```

- [ ] **Step 4: Run route wiring test**

Run:

```bash
pnpm --filter @motion-tool/web test -- HomeRoute.test.ts
```

Expected: PASS.

---

### Task 3: Regression Test The Existing API Boundary

**Files:**
- Existing: `apps/web/src/dev-api/controlledGenerationRoute.test.ts`
- Existing: `apps/web/src/services/controlledGenerationClient.test.ts`
- Existing: `apps/web/vite.config.ts`
- Existing: `apps/web/src/server/productionServer.ts`

- [ ] **Step 1: Re-run API and client tests**

Run:

```bash
pnpm --filter @motion-tool/web test -- controlledGenerationRoute.test.ts controlledGenerationClient.test.ts viteConfig.test.ts productionServer.test.ts
```

Expected: PASS.

- [ ] **Step 2: Re-run core generation tests**

Run:

```bash
pnpm --filter @motion-tool/core test -- generationPlan.test.ts controlledPatch.test.ts generationDiff.test.ts generationSandbox.test.ts generationReadiness.test.ts paramConcepts.test.ts
```

Expected: PASS.

---

### Task 4: Manual Runtime Verification

**Files:**
- No source edits.

- [ ] **Step 1: Confirm dev server**

Run:

```bash
pnpm dev:status
```

Expected:

```text
ai-motion dev server is running: http://127.0.0.1:5173
```

- [ ] **Step 2: Confirm route is mounted**

Run:

```bash
curl -sS -i -X POST http://127.0.0.1:5173/api/generation/controlled \
  -H 'Content-Type: application/json' \
  --data '{"brief":"测试生成","components":[]}'
```

Expected: `422 Unprocessable Entity`, not `404`.

- [ ] **Step 3: Verify browser flow**

Open `http://127.0.0.1:5173/`, switch to `自然语义生成`, enter:

```text
我想要一个商品详情页转场，速度更快一点，滑动距离短一点
```

Expected:
- The app calls `onLoadComponentSource` before the generation API.
- The generation API payload contains only hydrated candidate components.
- The generated component is added and opened in the editor.
- No component preview remains incomplete because generation used empty placeholder source.

---

## Acceptance Criteria

- `/api/generation/controlled` returns business responses, never `404`, in dev and preview/server modes.
- `HomeRoute.runGenerate` never posts raw `components`.
- Only a bounded recommendation pool is hydrated; the whole library is not eagerly loaded.
- Final generation request contains at most 3 candidate components.
- Candidate entry file content is non-empty before posting.
- Existing controlled patch validation still rejects invalid or blocked candidates.
- Targeted web and core tests pass.

---

## Risks And Rejected Alternatives

- Rejected: hydrate the entire component library on startup. It hides the bug by making startup heavier.
- Rejected: move builtin component loading into the API route. That creates a second component registry and splits ownership.
- Rejected: let the API accept placeholder source and guess missing files. That is garbage-in, garbage-out.
- Risk: recommendation Top 6 may exclude a valid but low-score component. Keep this bounded for MVP; raise `GENERATION_PREFETCH_LIMIT` only with evidence from failed examples.
