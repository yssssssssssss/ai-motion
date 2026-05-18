# WorkEasy Fusion Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate a curated set of 20 `jdc-WorkEasy` HTML/CSS components into `ai-motion-tool` as editable built-in motion assets.

**Architecture:** Add a focused WorkEasy adapter in `packages/core` that converts WorkEasy component records into `MotionComponent` objects with generated `MotionSource` and `MotionManifest`. Keep `jdc-WorkEasy` read-only; generated assets and UI integration live inside `ai-motion-tool`. The web app consumes WorkEasy components through the same recommendation, preview, parameter, and export flow as native components.

**Tech Stack:** TypeScript, Vitest, React, Vite, existing `MotionManifest`, `MotionComponent`, `scanSourceForParams`, `confirmValidParams`, `recommendComponents`, iframe preview.

---

## File Structure

- Create `packages/core/src/adapters/workeasy/types.ts`
  - WorkEasy input record types, adapter result types, skip issue types.
- Create `packages/core/src/adapters/workeasy/selectedComponents.ts`
  - Explicit 10/5/5 allowlist.
- Create `packages/core/src/adapters/workeasy/convert.ts`
  - Pure conversion from WorkEasy record to `MotionComponent`.
- Create `packages/core/src/adapters/workeasy/index.ts`
  - Public adapter exports.
- Create `packages/core/test/workeasyAdapter.test.ts`
  - Adapter conversion and skip behavior tests.
- Modify `packages/core/src/index.ts`
  - Export WorkEasy adapter API.
- Modify `packages/core/src/analyze/ruleScanner.ts`
  - Add safe detection for direct CSS colors/durations/radius when no CSS variables exist.
- Modify `packages/core/test/ruleScanner.test.ts`
  - Cover WorkEasy-style CSS without variables.
- Create `apps/web/src/data/workeasyComponents.ts`
  - Local curated WorkEasy demo records and converted components for browser bundle.
- Modify `apps/web/src/App.tsx`
  - Include WorkEasy components in recommendation source and category filter.
- Modify `apps/web/src/features/library/ComponentCandidates.tsx`
  - Show source, category, tags, and parameter count.
- Modify `apps/web/src/styles.css`
  - Add compact candidate metadata styling.

## Task 1: Add WorkEasy Adapter Types

**Files:**
- Create: `packages/core/src/adapters/workeasy/types.ts`
- Create: `packages/core/src/adapters/workeasy/index.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Create adapter types**

Create `packages/core/src/adapters/workeasy/types.ts`:

```ts
export type WorkEasyCategory = "buttons" | "cards" | "checkboxes";

export type WorkEasyComponentRecord = {
  id: string;
  title: string;
  author?: string;
  type: "html" | "react" | "vue" | "tsx" | "jsx" | "nextjs" | "lottie";
  framework?: "vanilla" | "react" | "vue" | "nextjs";
  tags: string[];
  description?: string;
  version?: string;
  htmlContent?: string;
  cssContent?: string;
  jsContent?: string;
  tsxContent?: string;
  jsxContent?: string;
  vueContent?: string;
};

export type WorkEasyImportIssue =
  | "missing-html"
  | "missing-css"
  | "unsupported-type"
  | "invalid-manifest"
  | "no-confirmed-params";

export type WorkEasySkip = {
  id: string;
  category: WorkEasyCategory;
  issue: WorkEasyImportIssue;
  message: string;
};

export type WorkEasyConversionInput = {
  category: WorkEasyCategory;
  record: WorkEasyComponentRecord;
};
```

- [ ] **Step 2: Export adapter types**

Create `packages/core/src/adapters/workeasy/index.ts`:

```ts
export * from "./types";
```

Modify `packages/core/src/index.ts`:

```ts
export * from "./adapters/workeasy";
```

- [ ] **Step 3: Run typecheck**

Run:

```bash
pnpm --filter @motion-tool/core typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

Run:

```bash
git add packages/core/src/adapters/workeasy packages/core/src/index.ts
git commit -m "feat: add workeasy adapter types"
```

## Task 2: Convert WorkEasy Records To Motion Components

**Files:**
- Create: `packages/core/src/adapters/workeasy/convert.ts`
- Modify: `packages/core/src/adapters/workeasy/index.ts`
- Create: `packages/core/test/workeasyAdapter.test.ts`

- [ ] **Step 1: Write failing conversion tests**

Create `packages/core/test/workeasyAdapter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { convertWorkEasyComponent } from "../src/adapters/workeasy";

describe("convertWorkEasyComponent", () => {
  it("converts a WorkEasy html/css record into a MotionComponent", () => {
    const result = convertWorkEasyComponent({
      category: "buttons",
      record: {
        id: "1-button",
        title: "Save Button",
        type: "html",
        framework: "vanilla",
        tags: ["button", "hover"],
        htmlContent: '<div class="comp-1-button-container"><button>Save</button></div>',
        cssContent: ".comp-1-button-container button { color: #ffffff; transition-duration: 0.3s; }"
      }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.skip.message);

    expect(result.component.id).toBe("workeasy-buttons-1-button");
    expect(result.component.source.entry).toBe("source/index.html");
    expect(result.component.source.files.map((file) => file.path)).toEqual(["source/index.html", "source/style.css"]);
    expect(result.component.manifest.sourceKind).toBe("builtin-component");
    expect(result.component.manifest.params.some((param) => param.status === "confirmed")).toBe(true);
  });

  it("skips unsupported React records in phase 1", () => {
    const result = convertWorkEasyComponent({
      category: "buttons",
      record: {
        id: "10-button",
        title: "React Button",
        type: "react",
        framework: "react",
        tags: ["button"],
        tsxContent: "export function Button() { return <button /> }"
      }
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected skip result");
    expect(result.skip.issue).toBe("unsupported-type");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @motion-tool/core test test/workeasyAdapter.test.ts
```

Expected: FAIL because `convertWorkEasyComponent` is not exported.

- [ ] **Step 3: Implement conversion**

Create `packages/core/src/adapters/workeasy/convert.ts`:

```ts
import { confirmValidParams } from "../../analyze/validator";
import { scanSourceForParams } from "../../analyze/ruleScanner";
import type { MotionComponent, MotionComponentMetadata, MotionSource } from "../../library/componentLibrary";
import type { MotionManifest } from "../../manifest/types";
import type { WorkEasyConversionInput, WorkEasySkip } from "./types";

type ConvertResult =
  | { ok: true; component: MotionComponent }
  | { ok: false; skip: WorkEasySkip };

function skip(input: WorkEasyConversionInput, issue: WorkEasySkip["issue"], message: string): ConvertResult {
  return {
    ok: false,
    skip: { id: input.record.id, category: input.category, issue, message }
  };
}

function categoryToMotionCategory(category: WorkEasyConversionInput["category"]): MotionComponentMetadata["category"] {
  if (category === "cards") return "layout";
  if (category === "checkboxes") return "interaction";
  return "interaction";
}

function buildHtml(title: string, htmlContent: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    ${htmlContent}
  </body>
</html>`;
}

export function convertWorkEasyComponent(input: WorkEasyConversionInput): ConvertResult {
  const { category, record } = input;

  if (record.type !== "html" || (record.framework && record.framework !== "vanilla")) {
    return skip(input, "unsupported-type", `Only vanilla HTML/CSS components are supported in phase 1.`);
  }

  if (!record.htmlContent?.trim()) {
    return skip(input, "missing-html", "WorkEasy component is missing htmlContent.");
  }

  if (!record.cssContent?.trim()) {
    return skip(input, "missing-css", "WorkEasy component is missing cssContent.");
  }

  const id = `workeasy-${category}-${record.id}`;
  const source: MotionSource = {
    id,
    origin: "builtin",
    kind: "builtin-component",
    entry: "source/index.html",
    files: [
      { path: "source/index.html", kind: "html", content: buildHtml(record.title, record.htmlContent) },
      { path: "source/style.css", kind: "css", content: record.cssContent }
    ]
  };

  const detected = scanSourceForParams(source);
  const validation = confirmValidParams({ source, params: detected });
  if (validation.confirmed.length === 0) {
    return skip(input, "no-confirmed-params", "No safe editable parameters were detected.");
  }

  const manifest: MotionManifest = {
    version: "1.0",
    id,
    name: record.title,
    sourceKind: "builtin-component",
    runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
    params: validation.confirmed,
    capabilities: ["builtin", "editable", "export-html"]
  };

  return {
    ok: true,
    component: {
      id,
      name: record.title,
      category: categoryToMotionCategory(category),
      tags: [...new Set([...record.tags, category, "workeasy"])],
      useCases: [category],
      moods: ["interactive"],
      source,
      manifest
    }
  };
}
```

Modify `packages/core/src/adapters/workeasy/index.ts`:

```ts
export * from "./types";
export * from "./convert";
```

- [ ] **Step 4: Run adapter tests**

Run:

```bash
pnpm --filter @motion-tool/core test test/workeasyAdapter.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add packages/core/src/adapters/workeasy packages/core/test/workeasyAdapter.test.ts
git commit -m "feat: convert workeasy html components"
```

## Task 3: Improve Scanner For WorkEasy CSS

**Files:**
- Modify: `packages/core/src/analyze/ruleScanner.ts`
- Modify: `packages/core/test/ruleScanner.test.ts`

- [ ] **Step 1: Add failing WorkEasy-style scanner test**

Append to `packages/core/test/ruleScanner.test.ts`:

```ts
it("detects direct WorkEasy css colors and durations", () => {
  const params = scanSourceForParams({
    id: "workeasy-buttons-1-button",
    origin: "builtin",
    kind: "builtin-component",
    entry: "source/index.html",
    files: [
      { path: "source/index.html", kind: "html", content: '<button class="button">Save</button>' },
      {
        path: "source/style.css",
        kind: "css",
        content: ".button { color: #ffffff; background-color: rgb(12,12,12); transition-duration: 0.3s; border-radius: 40px; }"
      }
    ]
  });

  expect(params.map((param) => param.id)).toContain("buttonColor");
  expect(params.map((param) => param.id)).toContain("buttonBackgroundColor");
  expect(params.map((param) => param.id)).toContain("buttonTransitionDuration");
  expect(params.map((param) => param.id)).toContain("buttonBorderRadius");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @motion-tool/core test test/ruleScanner.test.ts
```

Expected: FAIL because direct CSS property parameters are not detected yet.

- [ ] **Step 3: Implement minimal CSS property detection**

Add helper functions to `packages/core/src/analyze/ruleScanner.ts`:

```ts
function selectorToIdPrefix(selector: string): string {
  const cleaned = selector
    .replace(/^\./, "")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return toParamId(cleaned || "component");
}

function propertyToParamType(property: string, value: string): MotionParam["type"] | null {
  if (["color", "background-color"].includes(property) && /^(#|rgb|hsl)/.test(value.trim())) return "color";
  if (["transition-duration", "animation-duration"].includes(property)) return "duration";
  if (property === "border-radius") return "range";
  return null;
}

function propertyConstraints(property: string, value: string): MotionParam["constraints"] {
  if (property === "border-radius") return { unit: "px", min: 0, max: 100, step: 1 };
  if (/(ms|s)$/.test(value.trim())) return { unit: value.trim().endsWith("ms") ? "ms" : "s" };
  return undefined;
}

function scanCssProperties(filePath: string, content: string): MotionParam[] {
  const params: MotionParam[] = [];
  const rulePattern = /([^{}]+)\{([^{}]+)\}/g;

  for (const rule of content.matchAll(rulePattern)) {
    const selector = rule[1]?.trim();
    const body = rule[2];
    if (!selector || !body || selector.includes(":")) continue;

    const declarationPattern = /(color|background-color|transition-duration|animation-duration|border-radius)\s*:\s*([^;]+);/g;
    for (const declaration of body.matchAll(declarationPattern)) {
      const property = declaration[1];
      const value = declaration[2]?.trim();
      if (!property || !value) continue;

      const type = propertyToParamType(property, value);
      if (!type) continue;

      const id = `${selectorToIdPrefix(selector)}${property.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase()).replace(/^./, (char) => char.toUpperCase())}`;
      const param: MotionParam = {
        id,
        label: id,
        type,
        default: value,
        status: "detected",
        confidence: 0.65,
        targets: [{ kind: "css-property", file: filePath, selector, property }]
      };
      const constraints = propertyConstraints(property, value);
      if (constraints) param.constraints = constraints;
      params.push(param);
    }
  }

  return params;
}
```

Inside the existing `if (file.kind === "css")` block, after CSS variable scanning, add:

```ts
params.push(...scanCssProperties(file.path, file.content));
```

- [ ] **Step 4: Run scanner and adapter tests**

Run:

```bash
pnpm --filter @motion-tool/core test test/ruleScanner.test.ts test/workeasyAdapter.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add packages/core/src/analyze/ruleScanner.ts packages/core/test/ruleScanner.test.ts
git commit -m "feat: detect workeasy css parameters"
```

## Task 4: Patch CSS Property Targets

**Files:**
- Modify: `packages/core/src/patch/applyPatch.ts`
- Modify: `packages/core/test/applyPatch.test.ts`

- [ ] **Step 1: Add failing patch test for CSS properties**

Append to `packages/core/test/applyPatch.test.ts`:

```ts
it("updates css property targets", () => {
  const files = applyPatchToFiles({
    files: {
      "source/index.html": '<button class="button">Save</button>',
      "source/style.css": ".button { color: #ffffff; transition-duration: 0.3s; border-radius: 40px; }"
    },
    manifest: {
      version: "1.0",
      id: "workeasy",
      name: "WorkEasy",
      sourceKind: "builtin-component",
      runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
      params: [
        {
          id: "buttonColor",
          label: "Button color",
          type: "color",
          default: "#ffffff",
          status: "confirmed",
          targets: [{ kind: "css-property", file: "source/style.css", selector: ".button", property: "color" }]
        }
      ]
    },
    patch: { id: "patch", sourceManifestId: "workeasy", values: { buttonColor: "#ff3366" } }
  });

  expect(files["source/style.css"]).toContain("color: #ff3366");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @motion-tool/core test test/applyPatch.test.ts
```

Expected: FAIL because `css-property` targets are ignored.

- [ ] **Step 3: Implement CSS property patching**

Add this helper to `packages/core/src/patch/applyPatch.ts`:

```ts
function applyCssProperty(content: string, selector: string, property: string, value: string): string {
  const selectorPattern = escapeRegExp(selector);
  const propertyPattern = escapeRegExp(property);
  const rulePattern = new RegExp(`(${selectorPattern}\\s*\\{[^}]*?${propertyPattern}\\s*:\\s*)[^;]+`, "m");
  return content.replace(rulePattern, `$1${value}`);
}
```

Update `applyTarget`:

```ts
if (target.kind === "css-property") {
  return applyCssProperty(content, target.selector, target.property, formatCssValue(param, value));
}
```

- [ ] **Step 4: Run patch tests**

Run:

```bash
pnpm --filter @motion-tool/core test test/applyPatch.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add packages/core/src/patch/applyPatch.ts packages/core/test/applyPatch.test.ts
git commit -m "feat: patch css property targets"
```

## Task 5: Add Curated WorkEasy Selection

**Files:**
- Create: `packages/core/src/adapters/workeasy/selectedComponents.ts`
- Modify: `packages/core/src/adapters/workeasy/index.ts`
- Modify: `packages/core/test/workeasyAdapter.test.ts`

- [ ] **Step 1: Add allowlist test**

Append to `packages/core/test/workeasyAdapter.test.ts`:

```ts
import { selectedWorkEasyComponents } from "../src/adapters/workeasy";

it("defines a 10/5/5 curated WorkEasy selection", () => {
  expect(selectedWorkEasyComponents.buttons).toHaveLength(10);
  expect(selectedWorkEasyComponents.cards).toHaveLength(5);
  expect(selectedWorkEasyComponents.checkboxes).toHaveLength(5);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @motion-tool/core test test/workeasyAdapter.test.ts
```

Expected: FAIL because `selectedWorkEasyComponents` is not defined.

- [ ] **Step 3: Add explicit selection**

Create `packages/core/src/adapters/workeasy/selectedComponents.ts`:

```ts
import type { WorkEasyCategory } from "./types";

export type WorkEasySelection = Record<WorkEasyCategory, string[]>;

export const selectedWorkEasyComponents: WorkEasySelection = {
  buttons: ["1-button", "2-button", "3-button", "11-button", "12-button", "13-button", "14-button", "15-button", "20-button", "21-button"],
  cards: ["1-cards", "2-cards", "3-cards", "4-cards", "5-cards"],
  checkboxes: ["1-checkbox", "2-checkbox", "3-checkbox", "4-checkbox", "5-checkbox"]
};
```

Modify `packages/core/src/adapters/workeasy/index.ts`:

```ts
export * from "./types";
export * from "./convert";
export * from "./selectedComponents";
```

- [ ] **Step 4: Run adapter tests**

Run:

```bash
pnpm --filter @motion-tool/core test test/workeasyAdapter.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add packages/core/src/adapters/workeasy packages/core/test/workeasyAdapter.test.ts
git commit -m "feat: select curated workeasy components"
```

## Task 6: Add Browser-Bundled WorkEasy Components

**Files:**
- Create: `apps/web/src/data/workeasyComponents.ts`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Create bundled WorkEasy data**

Create `apps/web/src/data/workeasyComponents.ts` with three representative records first:

```ts
import { convertWorkEasyComponent, type MotionComponent, type WorkEasyComponentRecord } from "@motion-tool/core";

const records: Array<{ category: "buttons" | "cards" | "checkboxes"; record: WorkEasyComponentRecord }> = [
  {
    category: "buttons",
    record: {
      id: "1-button",
      title: "Save Button",
      type: "html",
      framework: "vanilla",
      tags: ["button", "hover", "workeasy"],
      htmlContent: '<div class="comp-1-button-container"><button class="bookmarkBtn"><span class="text">Save</span></button></div>',
      cssContent: ".comp-1-button-container .bookmarkBtn { color: #ffffff; background-color: rgb(12,12,12); transition-duration: 0.3s; border-radius: 40px; }"
    }
  },
  {
    category: "cards",
    record: {
      id: "1-cards",
      title: "Hover Card",
      type: "html",
      framework: "vanilla",
      tags: ["card", "hover", "workeasy"],
      htmlContent: '<div class="workeasy-card"><h3>Motion Card</h3><p>Hover to inspect.</p></div>',
      cssContent: ".workeasy-card { color: #111827; background-color: #ffffff; transition-duration: 0.25s; border-radius: 18px; } .workeasy-card:hover { transform: translateY(-6px); }"
    }
  },
  {
    category: "checkboxes",
    record: {
      id: "1-checkbox",
      title: "Animated Checkbox",
      type: "html",
      framework: "vanilla",
      tags: ["checkbox", "form", "workeasy"],
      htmlContent: '<label class="workeasy-checkbox"><input type="checkbox" /><span>Enable motion</span></label>',
      cssContent: ".workeasy-checkbox { color: #0f172a; transition-duration: 0.2s; } .workeasy-checkbox span { border-radius: 8px; background-color: #e2e8f0; }"
    }
  }
];

export const workEasyComponents: MotionComponent[] = records.flatMap((input) => {
  const result = convertWorkEasyComponent(input);
  return result.ok ? [result.component] : [];
});
```

- [ ] **Step 2: Wire WorkEasy components into App**

Modify `apps/web/src/App.tsx`:

```ts
import { workEasyComponents } from "./data/workeasyComponents";
```

Replace:

```ts
const components = [heroComponent];
```

with:

```ts
const components = [heroComponent, ...workEasyComponents];
```

- [ ] **Step 3: Run web typecheck**

Run:

```bash
pnpm --filter @motion-tool/web typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

Run:

```bash
git add apps/web/src/data/workeasyComponents.ts apps/web/src/App.tsx
git commit -m "feat: add workeasy components to web library"
```

## Task 7: Improve Candidate UI Metadata

**Files:**
- Modify: `apps/web/src/features/library/ComponentCandidates.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/styles.css`

- [ ] **Step 1: Update candidate props**

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

  return (
    <section className="tool-section">
      <h2>Candidates</h2>
      {recommendations.length === 0 ? <p className="muted">Run recommendation to see built-in components.</p> : null}
      <div className="candidate-list">
        {recommendations.map((item) => {
          const component = componentById.get(item.componentId);
          return (
            <button className="candidate" key={item.componentId} type="button" onClick={() => onSelect(item.componentId)}>
              <strong>{component?.name ?? item.componentId}</strong>
              <span>{item.reason}</span>
              <small>
                {component?.tags.includes("workeasy") ? "WorkEasy" : "Native"} · {component?.category ?? "component"} · {component?.manifest.params.length ?? 0} params
              </small>
            </button>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Pass component list from App**

Modify the `ComponentCandidates` usage in `apps/web/src/App.tsx`:

```tsx
<ComponentCandidates recommendations={recommendations} components={components} onSelect={selectComponent} />
```

- [ ] **Step 3: Add metadata styling**

Append to `apps/web/src/styles.css`:

```css
.candidate small {
  color: var(--accent);
  font-size: 11px;
  font-weight: 700;
}
```

- [ ] **Step 4: Run web typecheck**

Run:

```bash
pnpm --filter @motion-tool/web typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/web/src/features/library/ComponentCandidates.tsx apps/web/src/App.tsx apps/web/src/styles.css
git commit -m "feat: show workeasy candidate metadata"
```

## Task 8: Generate Browser Data For 20 Curated Components

**Files:**
- Create: `scripts/generate-workeasy-components.mjs`
- Create: `apps/web/src/data/workeasyComponents.generated.ts`
- Modify: `apps/web/src/data/workeasyComponents.ts`
- Test: `packages/core/test/workeasyAdapter.test.ts`

- [ ] **Step 1: Create deterministic generator script**

Create `scripts/generate-workeasy-components.mjs`:

```js
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const workEasyRoot = "/Users/heyunshen/work/PROJECT/jdc/jdc-WorkEasy";
const selection = {
  buttons: ["1-button", "2-button", "3-button", "11-button", "12-button", "13-button", "14-button", "15-button", "20-button", "21-button"],
  cards: ["1-cards", "2-cards", "3-cards", "4-cards", "5-cards"],
  checkboxes: ["1-checkbox", "2-checkbox", "3-checkbox", "4-checkbox", "5-checkbox"]
};

async function readCategory(category) {
  const path = resolve(workEasyRoot, "public", "api", "components", `${category}.json`);
  const records = JSON.parse(await readFile(path, "utf8"));
  const byId = new Map(records.map((record) => [record.id, record]));
  return selection[category].map((id) => {
    const record = byId.get(id);
    if (!record) throw new Error(`Missing WorkEasy component ${category}/${id}`);
    if (record.type !== "html") throw new Error(`Unsupported WorkEasy component ${category}/${id}: ${record.type}`);
    if (!record.htmlContent || !record.cssContent) throw new Error(`Incomplete WorkEasy component ${category}/${id}`);
    return { category, record };
  });
}

const inputs = [
  ...(await readCategory("buttons")),
  ...(await readCategory("cards")),
  ...(await readCategory("checkboxes"))
];

const output = `import type { WorkEasyComponentRecord, WorkEasyCategory } from "@motion-tool/core";

export const generatedWorkEasyRecords: Array<{ category: WorkEasyCategory; record: WorkEasyComponentRecord }> = ${JSON.stringify(inputs, null, 2)};
`;

const target = resolve(repoRoot, "apps", "web", "src", "data", "workeasyComponents.generated.ts");
await mkdir(dirname(target), { recursive: true });
await writeFile(target, output);
console.log(`Generated ${inputs.length} WorkEasy records at ${target}`);
```

- [ ] **Step 2: Run generator**

Run:

```bash
node scripts/generate-workeasy-components.mjs
```

Expected: prints `Generated 20 WorkEasy records`.

- [ ] **Step 3: Replace manual data with generated records**

Modify `apps/web/src/data/workeasyComponents.ts`:

```ts
import { convertWorkEasyComponent, type MotionComponent } from "@motion-tool/core";
import { generatedWorkEasyRecords } from "./workeasyComponents.generated";

export const workEasyComponents: MotionComponent[] = generatedWorkEasyRecords.flatMap((input) => {
  const result = convertWorkEasyComponent(input);
  return result.ok ? [result.component] : [];
});

export const workEasyComponentCount = workEasyComponents.length;
```

- [ ] **Step 4: Run web typecheck and build**

Run:

```bash
pnpm --filter @motion-tool/web typecheck
pnpm --filter @motion-tool/web build
```

Expected: both PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add scripts/generate-workeasy-components.mjs apps/web/src/data/workeasyComponents.ts apps/web/src/data/workeasyComponents.generated.ts
git commit -m "feat: expand workeasy curated library"
```

## Task 9: Final Verification

**Files:**
- Modify only files required by verification failures.

- [ ] **Step 1: Run core tests**

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

- [ ] **Step 3: Run web build**

Run:

```bash
pnpm --filter @motion-tool/web build
```

Expected: PASS. If Vite warns about Node `20.18.1`, record the warning but treat the build as successful only if it exits `0`.

- [ ] **Step 4: Start dev server**

Run:

```bash
pnpm --filter @motion-tool/web dev
```

Expected: Vite prints a local URL such as `http://127.0.0.1:5177/`.

- [ ] **Step 5: Browser smoke checklist**

Open the local URL and verify:

- Brief `button hover workeasy` returns WorkEasy button candidates.
- Brief `card hover` returns WorkEasy card candidates.
- Selecting a WorkEasy component shows iframe preview.
- Editing at least one color or duration parameter updates the preview.
- Export downloads an editable package JSON with generated WorkEasy source files.

- [ ] **Step 6: Commit verification fixes**

If fixes were required, stage the exact fixed files and commit them:

```bash
git commit -m "fix: verify workeasy fusion flow"
```

If no fixes were required, do not create an empty commit.

## Self-Review Notes

- Spec coverage: adapter, allowlist, manifest generation, preview reuse, recommendation flow, export behavior, skips, and verification are each covered by tasks.
- Scope boundary: React/TSX, Vue, Lottie, full WorkEasy app merge, and WorkEasy repository modification remain excluded.
- Known execution concern: the repository currently has unrelated uncommitted implementation files from the previous V0/V1 work. Execute this plan only after deciding whether to commit, stash, or intentionally build on those existing changes.
