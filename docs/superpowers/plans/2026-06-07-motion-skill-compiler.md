# Motion Skill Compiler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first version of Motion Skill Compiler: designer CSV in the PDF format becomes versioned motion skill packs, and the homepage can generate a draft from the CSV `元素 + 梯度` selection.

**Architecture:** Add a focused `motionSkill` module in `@motion-tool/core` for CSV normalization, token compilation, lock diffing, and MotionRecipe conversion. Add a small CLI wrapper for `pnpm motion:compile`, then load the compiled registry in the web app and expose a homepage atomic-motion entry beside "生成新组件". Keep natural semantic generation separate and remove its understanding chips.

**Tech Stack:** TypeScript, React 19, Vite, Vitest, Node.js fs APIs, existing `MotionComponent`, `MotionRecipe`, `applyMotionRecipe`, `validateGeneratedComponent`.

---

## File Structure

- Create `motion-source/atomic-motion.csv`
  - Designer-owned source table. First seed should include the PDF's complete `弹窗反馈` rows.
- Create `motion-skills/registry.json`
  - Generated runtime index. Commit the seed output so the app can load it without running the compiler.
- Create `motion-skills/lock.json`
  - Generated compiler state. Used only by the compiler.
- Create `motion-skills/popup-feedback/manifest.json`
- Create `motion-skills/popup-feedback/tokens.json`
- Create `motion-skills/popup-feedback/recipes.json`
- Create `motion-skills/popup-feedback/skill.md`
- Create `motion-skills/popup-feedback/previews.json`
- Create `motion-skills/compile-report.md`
- Create `packages/core/src/motionSkill/types.ts`
  - All public motion skill types.
- Create `packages/core/src/motionSkill/schema.ts`
  - Zod schemas for compiled registry and packs.
- Create `packages/core/src/motionSkill/normalize.ts`
  - Header mapping, fill-down, value parsing, id slugging.
- Create `packages/core/src/motionSkill/compiler.ts`
  - CSV-to-pack compilation and lock diff/versioning.
- Create `packages/core/src/motionSkill/recipeAdapter.ts`
  - Converts compiled tokens/recipes into existing `MotionRecipe`.
- Create `packages/core/src/motionSkill/mockComponent.ts`
  - Builds a generated draft component from a compiled recipe.
- Create `packages/core/src/motionSkill/index.ts`
  - Barrel export for the module.
- Create `packages/core/test/motionSkillNormalize.test.ts`
- Create `packages/core/test/motionSkillCompiler.test.ts`
- Create `packages/core/test/motionSkillRecipeAdapter.test.ts`
- Create `scripts/compile-motion-skills.mjs`
  - Thin Node wrapper that invokes the TypeScript compiler entry.
- Create `packages/core/src/motionSkill/cli.ts`
  - CLI entry used by the wrapper.
- Modify `packages/core/src/index.ts`
  - Export runtime APIs needed by web.
- Modify `packages/core/src/manifest/types.ts`
  - Add optional `motionSkill` metadata to `MotionManifest`.
- Modify `packages/core/src/manifest/schema.ts`
  - Validate optional `motionSkill`.
- Modify root `package.json`
  - Add `motion:compile` script.
- Create `apps/web/src/data/motionSkills.ts`
  - Vite JSON imports for registry and packs.
- Create `apps/web/src/services/atomicMotionGeneration.ts`
  - Web-facing helper that calls core mock generation.
- Create `apps/web/src/features/brief/AtomicMotionPanel.tsx`
  - Homepage atomic-motion selector UI.
- Create `apps/web/src/features/brief/AtomicMotionPanel.test.tsx`
- Modify `apps/web/src/features/brief/BriefPanel.tsx`
  - Add "原子动效参数" action next to generate button.
  - Remove generation understanding chip rendering.
- Modify `apps/web/src/features/brief/BriefPanel.test.ts`
  - Lock the removed chips and new button.
- Modify `apps/web/src/routes/HomeRoute.tsx`
  - Own panel open state and call atomic generation.
- Modify `apps/web/src/routes/HomeRoute.test.ts`
  - Lock homepage wiring.
- Modify `apps/web/src/styles/home.css`
  - Style button group and atomic panel.

---

## Tasks

### Task 1: Motion Skill Types And Manifest Metadata

**Files:**
- Create: `packages/core/src/motionSkill/types.ts`
- Create: `packages/core/src/motionSkill/index.ts`
- Modify: `packages/core/src/manifest/types.ts`
- Modify: `packages/core/src/manifest/schema.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing manifest metadata test**

Add this test case to `packages/core/test/motionSkillCompiler.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { motionManifestSchema, type MotionManifest } from "../src";

describe("motion skill manifest metadata", () => {
  it("accepts generated components that record their designer CSV source", () => {
    const manifest: MotionManifest = {
      version: "1.0",
      id: "generated-popup-feedback-manifest",
      name: "弹窗反馈 / 中型尺寸",
      sourceKind: "builtin-component",
      runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
      params: [],
      motionSkill: {
        source: "designer-csv",
        element: "弹窗反馈",
        variant: "中型尺寸",
        family: "popup-feedback",
        version: "1.0.0",
        recipeId: "popup-feedback.medium.enter",
        tokenIds: ["popup-feedback.medium.scale", "popup-feedback.medium.opacity"]
      }
    };

    expect(motionManifestSchema.parse(manifest).motionSkill).toMatchObject({
      source: "designer-csv",
      family: "popup-feedback",
      recipeId: "popup-feedback.medium.enter"
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @motion-tool/core test -- motionSkillCompiler.test.ts
```

Expected: FAIL because `motionSkill` is not exported/allowed yet.

- [ ] **Step 3: Add types and schema**

Add `MotionSkillBinding` to `packages/core/src/manifest/types.ts`:

```ts
export type MotionSkillBinding = {
  source: "designer-csv";
  element: string;
  variant: string;
  family: string;
  version: string;
  recipeId: string;
  tokenIds: string[];
};
```

Add it to `MotionManifest`:

```ts
motionSkill?: MotionSkillBinding;
```

In `packages/core/src/manifest/schema.ts`, add:

```ts
const motionSkillBindingSchema = z.object({
  source: z.literal("designer-csv"),
  element: z.string().min(1),
  variant: z.string().min(1),
  family: z.string().min(1),
  version: z.string().min(1),
  recipeId: z.string().min(1),
  tokenIds: z.array(z.string().min(1))
});
```

And add to `motionManifestSchema`:

```ts
motionSkill: motionSkillBindingSchema.optional(),
```

Create `packages/core/src/motionSkill/types.ts` with the initial runtime types:

```ts
import type { MotionRecipe } from "../generation/motionRecipe";

export type DesignerMotionRow = {
  element: string;
  motionPreview?: string;
  variant: string;
  variantPreview?: string;
  token: string;
  value: string;
  delay: string;
  animationType: string;
  propertyChange: string;
  cssValue: string;
  rowNumber: number;
};

export type AtomicMotionProperty = "scale" | "opacity" | "position" | "roundness" | "size";

export type AtomicMotionToken = {
  id: string;
  family: string;
  sourceElement: string;
  variant: string;
  sourceVariant: string;
  targetRole: "modal" | "card" | "screen" | "container" | "unknown";
  token: string;
  property: AtomicMotionProperty;
  durationMs: number;
  delayMs: number;
  easing: string;
  keyframes: number[] | Array<{ x?: number; y?: number; width?: number; height?: number }>;
  metadata: {
    animationType: string;
    sourceChange: string;
  };
};

export type MotionSkillRecipe = {
  id: string;
  name: string;
  family: string;
  sourceElement: string;
  variant: string;
  sourceVariant: string;
  targetRole: AtomicMotionToken["targetRole"];
  trigger: MotionRecipe["trigger"];
  tokenIds: string[];
};

export type MotionSkillElement = {
  id: string;
  label: string;
  latestVersion: string;
  active: boolean;
  variants: string[];
  packPath: string;
  status?: "active" | "incomplete";
  reason?: string;
};

export type MotionSkillRegistry = {
  version: "1.0";
  elements: MotionSkillElement[];
};

export type MotionSkillManifest = {
  id: string;
  name: string;
  version: string;
  source: "designer-csv";
  variants: string[];
  defaultVariant: string;
  tokenFile: string;
  recipeFile: string;
  skillFile: string;
};

export type MotionSkillTokenFile = {
  tokens: AtomicMotionToken[];
};

export type MotionSkillRecipeFile = {
  recipes: MotionSkillRecipe[];
};

export type MotionSkillPack = {
  manifest: MotionSkillManifest;
  tokens: AtomicMotionToken[];
  recipes: MotionSkillRecipe[];
};
```

Create `packages/core/src/motionSkill/index.ts`:

```ts
export type {
  DesignerMotionRow,
  AtomicMotionProperty,
  AtomicMotionToken,
  MotionSkillRecipe,
  MotionSkillElement,
  MotionSkillRegistry,
  MotionSkillManifest,
  MotionSkillTokenFile,
  MotionSkillRecipeFile,
  MotionSkillPack
} from "./types";
```

Export `MotionSkillBinding` and the module from `packages/core/src/index.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @motion-tool/core test -- motionSkillCompiler.test.ts
```

Expected: PASS.

---

### Task 2: CSV Header Mapping, Fill-Down, And Value Parsing

**Files:**
- Create: `packages/core/src/motionSkill/normalize.ts`
- Modify: `packages/core/src/motionSkill/index.ts`
- Test: `packages/core/test/motionSkillNormalize.test.ts`

- [ ] **Step 1: Write failing normalization tests**

Create `packages/core/test/motionSkillNormalize.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  normalizeDesignerMotionRows,
  parseCssEasing,
  parseKeyframes,
  parseMilliseconds,
  propertyFromAnimationType,
  slugMotionId
} from "../src";

describe("motion skill normalization", () => {
  it("fill-downs PDF-style merged cells after CSV export", () => {
    const rows = normalizeDesignerMotionRows([
      {
        元素: "弹窗反馈",
        动态示意: "popup.png",
        梯度: "中型尺寸",
        示意: "medium.png",
        Token: "standard easing",
        Value: "200ms",
        Delay: "50ms",
        动画类型: "缩放",
        关键属性变化: "scale: 95 -> 105% -> 100%",
        "CSS Value": "(0.38, 0.00, 0.24, 1.00)"
      },
      {
        元素: "",
        动态示意: "",
        梯度: "",
        示意: "",
        Token: "",
        Value: "150ms",
        Delay: "50ms",
        动画类型: "透明度-淡入",
        关键属性变化: "opacity：0 → 100%",
        "CSS Value": "(0.80, 0.00, 1.00, 1.00)"
      }
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({
      element: "弹窗反馈",
      motionPreview: "popup.png",
      variant: "中型尺寸",
      variantPreview: "medium.png",
      token: "standard easing"
    });
  });

  it("parses time, easing, property, keyframes, and stable ids", () => {
    expect(parseMilliseconds("200ms")).toBe(200);
    expect(parseMilliseconds("0.2s")).toBe(200);
    expect(parseMilliseconds("50")).toBe(50);
    expect(parseCssEasing("(0.38, 0.00, 0.24, 1.00)")).toBe("cubic-bezier(0.38, 0, 0.24, 1)");
    expect(propertyFromAnimationType("透明度-淡入")).toBe("opacity");
    expect(propertyFromAnimationType("缩放")).toBe("scale");
    expect(parseKeyframes("scale:95->105->100", "scale")).toEqual([0.95, 1.05, 1]);
    expect(parseKeyframes("opacity:0->100", "opacity")).toEqual([0, 1]);
    expect(slugMotionId("弹窗反馈")).toBe("popup-feedback");
    expect(slugMotionId("中型尺寸")).toBe("medium");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @motion-tool/core test -- motionSkillNormalize.test.ts
```

Expected: FAIL because functions do not exist.

- [ ] **Step 3: Implement normalization helpers**

Implement in `packages/core/src/motionSkill/normalize.ts`:

```ts
import type { AtomicMotionProperty, DesignerMotionRow } from "./types";

type CsvRow = Record<string, unknown>;

const HEADER_ALIASES: Record<keyof Omit<DesignerMotionRow, "rowNumber">, string[]> = {
  element: ["元素"],
  motionPreview: ["动态示意"],
  variant: ["梯度"],
  variantPreview: ["示意"],
  token: ["Token", "token"],
  value: ["Value", "值", "时长"],
  delay: ["Delay", "延迟"],
  animationType: ["动画类型"],
  propertyChange: ["关键属性变化"],
  cssValue: ["CSS Value", "CSSValue", "曲线"]
};

const SLUG_ALIASES: Record<string, string> = {
  弹窗反馈: "popup-feedback",
  弹窗关闭: "popup-close",
  容器变换: "container-transform",
  前后进场: "front-back-entry",
  横向切换: "horizontal-switch",
  容器加载: "container-loading",
  大型尺寸: "large",
  中型尺寸: "medium",
  小型尺寸: "small",
  all: "all"
};

function cell(row: CsvRow, aliases: string[]): string {
  for (const alias of aliases) {
    const value = row[alias];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}

export function normalizeDesignerMotionRows(rows: CsvRow[]): DesignerMotionRow[] {
  const last: Partial<DesignerMotionRow> = {};
  return rows.map((row, index) => {
    const next: DesignerMotionRow = {
      element: cell(row, HEADER_ALIASES.element) || last.element || "",
      motionPreview: cell(row, HEADER_ALIASES.motionPreview) || last.motionPreview,
      variant: cell(row, HEADER_ALIASES.variant) || last.variant || "",
      variantPreview: cell(row, HEADER_ALIASES.variantPreview) || last.variantPreview,
      token: cell(row, HEADER_ALIASES.token) || last.token || "",
      value: cell(row, HEADER_ALIASES.value),
      delay: cell(row, HEADER_ALIASES.delay),
      animationType: cell(row, HEADER_ALIASES.animationType),
      propertyChange: cell(row, HEADER_ALIASES.propertyChange),
      cssValue: cell(row, HEADER_ALIASES.cssValue),
      rowNumber: index + 2
    };

    last.element = next.element;
    last.motionPreview = next.motionPreview;
    last.variant = next.variant;
    last.variantPreview = next.variantPreview;
    last.token = next.token;
    return next;
  });
}

export function parseMilliseconds(value: string): number {
  const normalized = value.trim();
  const match = normalized.match(/^-?\d+(?:\.\d+)?/);
  if (!match?.[0]) throw new Error(`Invalid time value: ${value}`);
  const parsed = Number(match[0]);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Invalid time value: ${value}`);
  return /s$/i.test(normalized) && !/ms$/i.test(normalized) ? Math.round(parsed * 1000) : Math.round(parsed);
}

export function parseCssEasing(value: string): string {
  const trimmed = value.trim();
  if (/^cubic-bezier\(/i.test(trimmed)) return trimmed.replace(/\s+/g, " ");
  const tuple = trimmed.match(/^\(?\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)?$/);
  if (tuple) {
    const values = tuple.slice(1).map((item) => String(Number(item)));
    return `cubic-bezier(${values.join(", ")})`;
  }
  if (/ease\s*out/i.test(trimmed)) return "ease-out";
  if (/ease\s*in/i.test(trimmed)) return "ease-in";
  return trimmed;
}

export function propertyFromAnimationType(value: string): AtomicMotionProperty {
  if (/透明度|opacity/i.test(value)) return "opacity";
  if (/缩放|scale/i.test(value)) return "scale";
  if (/位移|position|translate/i.test(value)) return "position";
  if (/圆度|圆角|roundness|radius/i.test(value)) return "roundness";
  if (/尺寸|size|宽|高/i.test(value)) return "size";
  throw new Error(`Unsupported animation type: ${value}`);
}

function normalizePercentNumber(raw: string, property: AtomicMotionProperty): number {
  const parsed = Number(raw.replace("%", ""));
  if (!Number.isFinite(parsed)) throw new Error(`Invalid keyframe value: ${raw}`);
  return property === "scale" || property === "opacity" ? parsed / 100 : parsed;
}

export function parseKeyframes(value: string, property: AtomicMotionProperty): number[] {
  const normalized = value.replaceAll("：", ":").replaceAll("→", "->");
  const [, body = normalized] = normalized.split(":");
  const values = body
    .split("->")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => normalizePercentNumber(item, property));
  if (values.length < 2) throw new Error(`Invalid keyframes: ${value}`);
  return values;
}

export function slugMotionId(value: string): string {
  const trimmed = value.trim();
  if (SLUG_ALIASES[trimmed]) return SLUG_ALIASES[trimmed];
  return trimmed
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
```

Export these functions from `packages/core/src/motionSkill/index.ts` and `packages/core/src/index.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter @motion-tool/core test -- motionSkillNormalize.test.ts
```

Expected: PASS.

---

### Task 3: Compile CSV Rows Into Registry, Tokens, Recipes, And Lock

**Files:**
- Create: `packages/core/src/motionSkill/compiler.ts`
- Create: `packages/core/src/motionSkill/schema.ts`
- Modify: `packages/core/src/motionSkill/index.ts`
- Test: `packages/core/test/motionSkillCompiler.test.ts`

- [ ] **Step 1: Extend failing compiler tests**

Add to `packages/core/test/motionSkillCompiler.test.ts`:

```ts
import {
  compileMotionSkillsFromRows,
  motionSkillRegistrySchema,
  motionSkillTokenFileSchema,
  type MotionSkillLock
} from "../src";

const popupRows = [
  {
    元素: "弹窗反馈",
    动态示意: "",
    梯度: "中型尺寸",
    示意: "",
    Token: "standard easing",
    Value: "200ms",
    Delay: "50ms",
    动画类型: "缩放",
    关键属性变化: "scale：95 → 105% →100%",
    "CSS Value": "(0.38, 0.00, 0.24, 1.00)"
  },
  {
    元素: "",
    动态示意: "",
    梯度: "",
    示意: "",
    Token: "",
    Value: "150ms",
    Delay: "50ms",
    动画类型: "透明度-淡入",
    关键属性变化: "opacity：0 → 100%",
    "CSS Value": "(0.80, 0.00, 1.00, 1.00)"
  }
];

describe("motion skill compiler", () => {
  it("compiles PDF-style popup feedback rows into a registry and pack", () => {
    const result = compileMotionSkillsFromRows({ rows: popupRows, previousLock: null });
    const pack = result.packs["popup-feedback"];

    expect(motionSkillRegistrySchema.parse(result.registry).elements[0]).toMatchObject({
      id: "popup-feedback",
      label: "弹窗反馈",
      latestVersion: "1.0.0",
      active: true
    });
    expect(pack?.manifest).toMatchObject({
      id: "popup-feedback",
      name: "弹窗反馈",
      version: "1.0.0",
      defaultVariant: "medium"
    });
    expect(motionSkillTokenFileSchema.parse({ tokens: pack?.tokens }).tokens).toHaveLength(2);
    expect(pack?.recipes[0]).toMatchObject({
      id: "popup-feedback.medium.enter",
      sourceElement: "弹窗反馈",
      sourceVariant: "中型尺寸",
      tokenIds: ["popup-feedback.medium.scale", "popup-feedback.medium.opacity"]
    });
    expect(result.report).toContain("新增元素: 弹窗反馈@1.0.0");
  });

  it("keeps unchanged locks stable and archives removed historical tokens", () => {
    const first = compileMotionSkillsFromRows({ rows: popupRows, previousLock: null });
    const second = compileMotionSkillsFromRows({ rows: popupRows, previousLock: first.lock });
    const removed = compileMotionSkillsFromRows({ rows: [popupRows[0]!], previousLock: first.lock });

    expect(second.registry.elements[0]?.latestVersion).toBe("1.0.0");
    expect(second.report).toContain("无变化: 弹窗反馈@1.0.0");
    expect(removed.registry.elements[0]?.latestVersion).toBe("1.1.0");
    expect(removed.lock.families["popup-feedback"]?.tokens["popup-feedback.medium.opacity"]?.status).toBe("archived");
  });

  it("marks incomplete elements as disabled instead of generating broken recipes", () => {
    const result = compileMotionSkillsFromRows({
      rows: [{ 元素: "前后进场", 梯度: "半弹层" }],
      previousLock: null
    });

    expect(result.registry.elements[0]).toMatchObject({
      id: "front-back-entry",
      label: "前后进场",
      active: false,
      status: "incomplete"
    });
    expect(result.report).toContain("不完整元素: 前后进场");
  });

  it("bumps the family version when visual token values change", () => {
    const first = compileMotionSkillsFromRows({ rows: popupRows, previousLock: null });
    const changed = compileMotionSkillsFromRows({
      rows: [{ ...popupRows[0]!, Value: "240ms" }, popupRows[1]!],
      previousLock: first.lock as MotionSkillLock
    });

    expect(changed.registry.elements[0]?.latestVersion).toBe("1.1.0");
    expect(changed.report).toContain("更新元素: 弹窗反馈 1.0.0 -> 1.1.0");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @motion-tool/core test -- motionSkillCompiler.test.ts
```

Expected: FAIL because compiler and schemas do not exist.

- [ ] **Step 3: Implement schemas**

In `packages/core/src/motionSkill/schema.ts`, create schemas for registry, tokens, recipes, pack, and lock. Use the type names from Task 1. At minimum export:

```ts
export const atomicMotionTokenSchema = z.object({ ... });
export const motionSkillRegistrySchema = z.object({ ... });
export const motionSkillTokenFileSchema = z.object({ tokens: z.array(atomicMotionTokenSchema) });
export const motionSkillRecipeFileSchema = z.object({ recipes: z.array(motionSkillRecipeSchema) });
export const motionSkillLockSchema = z.object({ ... });
```

Keep schema fields aligned with `types.ts`; do not allow unknown runtime fields in the initial implementation.

- [ ] **Step 4: Implement compiler**

In `packages/core/src/motionSkill/compiler.ts`, implement:

```ts
export type MotionSkillLock = {
  version: "1.0";
  families: Record<
    string,
    {
      latestVersion: string;
      tokens: Record<string, { fingerprint: string; status: "active" | "archived" }>;
    }
  >;
};

export type CompileMotionSkillsResult = {
  registry: MotionSkillRegistry;
  lock: MotionSkillLock;
  packs: Record<string, MotionSkillPack>;
  report: string;
};

export function compileMotionSkillsFromRows(input: {
  rows: Record<string, unknown>[];
  previousLock: MotionSkillLock | null;
}): CompileMotionSkillsResult;
```

Implementation rules:

- Use `normalizeDesignerMotionRows`.
- Skip incomplete token rows when compiling packs.
- Still create disabled registry entries for incomplete elements.
- Build token ids as `${family}.${variant}.${property}`.
- Build recipe ids as `${family}.${variant}.enter`.
- Fingerprint visual fields: duration, delay, easing, property, keyframes.
- If no previous family exists, version is `1.0.0`.
- If previous family exists and any active token fingerprint changed, a token was added, or a token was archived, bump minor.
- If no change, keep previous version.
- Generate report strings exactly matching tests.

- [ ] **Step 5: Export compiler and schemas**

Export from `packages/core/src/motionSkill/index.ts` and `packages/core/src/index.ts`:

```ts
export {
  compileMotionSkillsFromRows,
  motionSkillRegistrySchema,
  motionSkillTokenFileSchema,
  motionSkillRecipeFileSchema,
  motionSkillLockSchema
} from "./motionSkill";
export type { MotionSkillLock, CompileMotionSkillsResult } from "./motionSkill";
```

- [ ] **Step 6: Run compiler tests**

Run:

```bash
pnpm --filter @motion-tool/core test -- motionSkillCompiler.test.ts motionSkillNormalize.test.ts
```

Expected: PASS.

---

### Task 4: Motion Skill Recipe Adapter And Mock Draft Component

**Files:**
- Create: `packages/core/src/motionSkill/recipeAdapter.ts`
- Create: `packages/core/src/motionSkill/mockComponent.ts`
- Modify: `packages/core/src/motionSkill/index.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/motionSkillRecipeAdapter.test.ts`

- [ ] **Step 1: Write failing adapter tests**

Create `packages/core/test/motionSkillRecipeAdapter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  compileMotionSkillsFromRows,
  createMotionSkillDraftComponent,
  motionSkillRecipeToMotionRecipe,
  validateGeneratedComponent,
  validateRecipeApplication
} from "../src";

const rows = [
  {
    元素: "弹窗反馈",
    梯度: "中型尺寸",
    Token: "standard easing",
    Value: "200ms",
    Delay: "50ms",
    动画类型: "缩放",
    关键属性变化: "scale:95->105->100",
    "CSS Value": "(0.38, 0.00, 0.24, 1.00)"
  },
  {
    元素: "",
    梯度: "",
    Token: "",
    Value: "150ms",
    Delay: "50ms",
    动画类型: "透明度-淡入",
    关键属性变化: "opacity:0->100",
    "CSS Value": "(0.80, 0.00, 1.00, 1.00)"
  }
];

describe("motion skill recipe adapter", () => {
  it("converts compiled popup tokens into a MotionRecipe", () => {
    const compiled = compileMotionSkillsFromRows({ rows, previousLock: null });
    const pack = compiled.packs["popup-feedback"]!;
    const recipe = motionSkillRecipeToMotionRecipe({
      manifest: pack.manifest,
      recipe: pack.recipes[0]!,
      tokens: pack.tokens
    });

    expect(recipe).toMatchObject({
      id: "popup-feedback.medium.enter",
      name: "弹窗反馈 / 中型尺寸",
      category: "feedback",
      trigger: "load"
    });
    expect(recipe.params.map((param) => param.id)).toEqual(
      expect.arrayContaining(["popupFeedbackMediumScaleDuration", "popupFeedbackMediumOpacityDuration"])
    );
    expect(recipe.bindings.keyframes).toEqual(
      expect.arrayContaining(["popup-feedback-medium-scale", "popup-feedback-medium-opacity"])
    );
  });

  it("creates a generated draft component with motionSkill metadata and replayable source", () => {
    const compiled = compileMotionSkillsFromRows({ rows, previousLock: null });
    const component = createMotionSkillDraftComponent({
      registry: compiled.registry,
      pack: compiled.packs["popup-feedback"]!,
      recipeId: "popup-feedback.medium.enter",
      now: 1717747200000
    });
    const sourceText = component.source.files.map((file) => file.content).join("\n");
    const binding = component.manifest.motionRecipes?.[0]!;

    expect(component.source.origin).toBe("generated");
    expect(component.manifest.motionSkill).toMatchObject({
      source: "designer-csv",
      element: "弹窗反馈",
      variant: "中型尺寸",
      family: "popup-feedback",
      version: "1.0.0",
      recipeId: "popup-feedback.medium.enter"
    });
    expect(sourceText).toContain('data-motion="modalLayer"');
    expect(sourceText).toContain("window.motionReplay");
    expect(validateRecipeApplication({
      binding,
      params: component.manifest.params,
      layers: component.manifest.layers ?? [],
      sourceText
    }).valid).toBe(true);
    expect(validateGeneratedComponent(component).valid).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @motion-tool/core test -- motionSkillRecipeAdapter.test.ts
```

Expected: FAIL because adapter/draft functions do not exist.

- [ ] **Step 3: Implement MotionRecipe adapter**

In `packages/core/src/motionSkill/recipeAdapter.ts`, implement:

```ts
export function motionSkillRecipeToMotionRecipe(input: {
  manifest: MotionSkillManifest;
  recipe: MotionSkillRecipe;
  tokens: AtomicMotionToken[];
}): MotionRecipe;
```

Rules:

- Category: `feedback` for popup feedback/close; otherwise `entrance`.
- Target selector: `[data-motion=modalLayer]` for modal target.
- Every token produces duration and delay params.
- Easing params may be shared per token as simple `easing` params.
- `scale` token creates a keyframe block name like `popup-feedback-medium-scale`.
- `opacity` token creates `popup-feedback-medium-opacity`.
- Bindings selectors include `[data-motion=modalLayer]`.

- [ ] **Step 4: Implement mock component builder**

In `packages/core/src/motionSkill/mockComponent.ts`, implement:

```ts
export function createMotionSkillDraftComponent(input: {
  registry: MotionSkillRegistry;
  pack: MotionSkillPack;
  recipeId: string;
  now?: number;
}): MotionComponent;
```

Rules:

- Find recipe by id or throw.
- Convert to MotionRecipe.
- Start with source files:

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main class="motion-skill-stage" data-motion-root>
      <section class="motion-skill-modal" data-motion="modalLayer"></section>
    </main>
    <script src="./script.js"></script>
  </body>
</html>
```

- Base CSS should include stable stage/modal dimensions and a neutral background.
- Call existing `applyMotionRecipe()` with the converted recipe and source files.
- Return a generated `MotionComponent` with `motionSkill` metadata and `motionRecipes`.

- [ ] **Step 5: Export APIs**

Export from `packages/core/src/motionSkill/index.ts` and `packages/core/src/index.ts`:

```ts
export { motionSkillRecipeToMotionRecipe } from "./recipeAdapter";
export { createMotionSkillDraftComponent } from "./mockComponent";
```

- [ ] **Step 6: Run tests**

Run:

```bash
pnpm --filter @motion-tool/core test -- motionSkillRecipeAdapter.test.ts motionSkillCompiler.test.ts motionSkillNormalize.test.ts
```

Expected: PASS.

---

### Task 5: CLI And Seed Designer CSV/Packs

**Files:**
- Create: `motion-source/atomic-motion.csv`
- Create: `scripts/compile-motion-skills.mjs`
- Create: `packages/core/src/motionSkill/cli.ts`
- Modify: `package.json`
- Generated: `motion-skills/**`

- [ ] **Step 1: Add seed CSV**

Create `motion-source/atomic-motion.csv`:

```csv
元素,动态示意,梯度,示意,Token,Value,Delay,动画类型,关键属性变化,CSS Value
弹窗反馈,,大型尺寸,,standard easing,300ms,50ms,缩放,scale：95 → 105% →100%,"(0.38, 0.00, 0.24, 1.00)"
,,,,,200ms,50ms,透明度-淡入,opacity：0 → 100%,"(0.80, 0.00, 1.00, 1.00)"
,,中型尺寸,,standard easing,200ms,50ms,缩放,scale：95 → 105% →100%,"(0.38, 0.00, 0.24, 1.00)"
,,,,,150ms,50ms,透明度-淡入,opacity：0 → 100%,"(0.80, 0.00, 1.00, 1.00)"
,,小型尺寸,,standard easing,150ms,50ms,缩放,scale：95 → 105% →100%,"(0.38, 0.00, 0.24, 1.00)"
,,,,,100ms,50ms,透明度-淡入,opacity：0 → 100%,"(0.80, 0.00, 1.00, 1.00)"
弹窗关闭,,all,,ease in,50ms,0ms,透明度-淡出,opacity：100 → 0%,"(0.00, 0.00, 0.00, 1.00)"
前后进场,,半弹层,,ease out,,,,,
横向切换,,,,,,,,,
容器加载,,,,,,,,,
```

- [ ] **Step 2: Add CLI test by running missing script**

Run:

```bash
pnpm motion:compile
```

Expected: FAIL because script does not exist.

- [ ] **Step 3: Add root script and wrapper**

Modify root `package.json` scripts:

```json
"motion:compile": "node scripts/compile-motion-skills.mjs"
```

Create `scripts/compile-motion-skills.mjs`:

```js
import { spawnSync } from "node:child_process";

const result = spawnSync("pnpm", ["exec", "tsx", "packages/core/src/motionSkill/cli.ts"], {
  stdio: "inherit",
  shell: process.platform === "win32"
});

process.exit(result.status ?? 1);
```

- [ ] **Step 4: Implement CLI**

Create `packages/core/src/motionSkill/cli.ts`. It should:

- Read `motion-source/atomic-motion.csv`.
- Parse CSV with a small local parser that supports quoted commas.
- Read `motion-skills/lock.json` if present.
- Call `compileMotionSkillsFromRows`.
- Write `motion-skills/registry.json`, `lock.json`, family pack files, and `compile-report.md`.

Keep the CSV parser private to `cli.ts` for now; do not add a dependency.

- [ ] **Step 5: Run compile**

Run:

```bash
pnpm motion:compile
```

Expected:

- PASS exit code 0.
- `motion-skills/registry.json` exists.
- `motion-skills/popup-feedback/tokens.json` exists.
- `motion-skills/compile-report.md` includes `新增元素: 弹窗反馈@1.0.0`.
- `前后进场`, `横向切换`, and `容器加载` are marked incomplete.

- [ ] **Step 6: Run core tests and typecheck**

Run:

```bash
pnpm --filter @motion-tool/core test -- motionSkill
pnpm --filter @motion-tool/core typecheck
```

Expected: PASS.

---

### Task 6: Web Runtime Data And Atomic Generation Service

**Files:**
- Create: `apps/web/src/data/motionSkills.ts`
- Create: `apps/web/src/services/atomicMotionGeneration.ts`
- Test: `apps/web/src/services/atomicMotionGeneration.test.ts`

- [ ] **Step 1: Write failing service test**

Create `apps/web/src/services/atomicMotionGeneration.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { generateAtomicMotionComponent, motionSkillElements } from "./atomicMotionGeneration";

describe("atomic motion generation service", () => {
  it("lists active elements and generates popup feedback from element and variant", () => {
    expect(motionSkillElements.some((element) => element.label === "弹窗反馈")).toBe(true);

    const component = generateAtomicMotionComponent({
      elementId: "popup-feedback",
      variant: "中型尺寸",
      now: 1717747200000
    });

    expect(component.manifest.motionSkill).toMatchObject({
      source: "designer-csv",
      element: "弹窗反馈",
      variant: "中型尺寸",
      family: "popup-feedback"
    });
    expect(component.source.files.map((file) => file.content).join("\n")).toContain("window.motionReplay");
  });

  it("rejects incomplete elements before generation", () => {
    expect(() =>
      generateAtomicMotionComponent({
        elementId: "front-back-entry",
        variant: "半弹层",
        now: 1717747200000
      })
    ).toThrow(/参数未完整/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @motion-tool/web test -- atomicMotionGeneration.test.ts
```

Expected: FAIL because service/data module does not exist.

- [ ] **Step 3: Implement Vite JSON data loader**

Create `apps/web/src/data/motionSkills.ts`:

```ts
import registry from "../../../../motion-skills/registry.json";
import popupManifest from "../../../../motion-skills/popup-feedback/manifest.json";
import popupTokens from "../../../../motion-skills/popup-feedback/tokens.json";
import popupRecipes from "../../../../motion-skills/popup-feedback/recipes.json";
import type { MotionSkillPack, MotionSkillRegistry } from "@motion-tool/core";

export const motionSkillRegistry = registry as MotionSkillRegistry;

export const motionSkillPacks: Record<string, MotionSkillPack> = {
  "popup-feedback": {
    manifest: popupManifest,
    tokens: popupTokens.tokens,
    recipes: popupRecipes.recipes
  } as MotionSkillPack
};
```

- [ ] **Step 4: Implement service**

Create `apps/web/src/services/atomicMotionGeneration.ts`:

```ts
import { createMotionSkillDraftComponent, type MotionComponent } from "@motion-tool/core";
import { motionSkillPacks, motionSkillRegistry } from "../data/motionSkills";

export const motionSkillElements = motionSkillRegistry.elements;

export function generateAtomicMotionComponent(input: {
  elementId: string;
  variant: string;
  now?: number;
}): MotionComponent {
  const element = motionSkillRegistry.elements.find((item) => item.id === input.elementId);
  if (!element || !element.active || element.status === "incomplete") {
    throw new Error(element?.reason || "原子动效参数未完整，暂不可生成");
  }
  const pack = motionSkillPacks[input.elementId];
  if (!pack) throw new Error("未找到原子动效能力包");
  const recipe = pack.recipes.find((item) => item.sourceVariant === input.variant);
  if (!recipe) throw new Error("未找到所选梯度的动效参数");
  return createMotionSkillDraftComponent({
    registry: motionSkillRegistry,
    pack,
    recipeId: recipe.id,
    now: input.now
  });
}
```

- [ ] **Step 5: Run service tests**

Run:

```bash
pnpm --filter @motion-tool/web test -- atomicMotionGeneration.test.ts
```

Expected: PASS.

---

### Task 7: Homepage UI Entry And Remove Generation Understanding Chips

**Files:**
- Create: `apps/web/src/features/brief/AtomicMotionPanel.tsx`
- Create: `apps/web/src/features/brief/AtomicMotionPanel.test.tsx`
- Modify: `apps/web/src/features/brief/BriefPanel.tsx`
- Modify: `apps/web/src/features/brief/BriefPanel.test.ts`
- Modify: `apps/web/src/routes/HomeRoute.tsx`
- Modify: `apps/web/src/routes/HomeRoute.test.ts`
- Modify: `apps/web/src/styles/home.css`

- [ ] **Step 1: Update BriefPanel tests first**

Modify `apps/web/src/features/brief/BriefPanel.test.ts`:

- Remove tests that assert `generationUnderstandingChips` renders chips in generation mode.
- Keep parser helper tests only if `generationUnderstandingChips` is still exported; otherwise remove that export and its tests.
- Change the generation mode render test expectations:

```ts
expect(html).toContain("原子动效参数");
expect(html).not.toContain('aria-label="生成理解结果"');
expect(html).not.toContain("已理解");
expect(html).not.toContain("页面转场");
expect(html).not.toContain("排除 按钮");
```

Add prop to baseProps:

```ts
onOpenAtomicMotion: () => {}
```

- [ ] **Step 2: Run BriefPanel test to verify failure**

Run:

```bash
pnpm --filter @motion-tool/web test -- BriefPanel.test.ts
```

Expected: FAIL until component is changed.

- [ ] **Step 3: Modify BriefPanel**

In `apps/web/src/features/brief/BriefPanel.tsx`:

- Remove `generationUnderstandingChips` rendering.
- Remove `generationIntent` prop if unused.
- Add prop:

```ts
onOpenAtomicMotion: () => void;
```

- Replace single action button with:

```tsx
<div className="brief-actions">
  <button className="ai-recommend-button" type="button" onClick={isGenerateMode ? onGenerate : onRecommend} disabled={isLoading || isDisabled}>
    {isDisabled ? "组件库加载中..." : isLoading ? heading.loading : heading.button}
  </button>
  {isGenerateMode ? (
    <button className="atomic-motion-button" type="button" onClick={onOpenAtomicMotion} disabled={isDisabled}>
      原子动效参数
    </button>
  ) : null}
</div>
```

- [ ] **Step 4: Add AtomicMotionPanel test**

Create `apps/web/src/features/brief/AtomicMotionPanel.test.tsx`:

```ts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AtomicMotionPanel } from "./AtomicMotionPanel";

describe("AtomicMotionPanel", () => {
  it("renders elements, variants, parameter summary, and disabled incomplete entries", () => {
    const html = renderToStaticMarkup(
      createElement(AtomicMotionPanel, {
        elements: [
          {
            id: "popup-feedback",
            label: "弹窗反馈",
            latestVersion: "1.0.0",
            active: true,
            variants: ["中型尺寸"],
            packPath: "popup-feedback/manifest.json"
          },
          {
            id: "front-back-entry",
            label: "前后进场",
            latestVersion: "0.0.0",
            active: false,
            variants: ["半弹层"],
            packPath: "",
            status: "incomplete",
            reason: "缺少完整 token 行"
          }
        ],
        selectedElementId: "popup-feedback",
        selectedVariant: "中型尺寸",
        tokenSummary: ["缩放 · 200ms · delay 50ms · scale 95 -> 105 -> 100"],
        onSelectElement: () => {},
        onSelectVariant: () => {},
        onGenerate: () => {},
        onClose: () => {}
      })
    );

    expect(html).toContain("原子动效参数");
    expect(html).toContain("弹窗反馈");
    expect(html).toContain("中型尺寸");
    expect(html).toContain("缩放 · 200ms");
    expect(html).toContain("前后进场");
    expect(html).toContain("缺少完整 token 行");
  });
});
```

- [ ] **Step 5: Implement AtomicMotionPanel**

Create `apps/web/src/features/brief/AtomicMotionPanel.tsx` with controlled props from the test. Keep it presentational:

- Render a dialog section with close button.
- Render element buttons.
- Render variant buttons for active element.
- Render token summary.
- Disable generate when active element is incomplete.

- [ ] **Step 6: Wire HomeRoute**

In `apps/web/src/routes/HomeRoute.tsx`:

- Import `AtomicMotionPanel`.
- Import `generateAtomicMotionComponent`, `motionSkillElements`.
- Add state:

```ts
const [isAtomicMotionOpen, setIsAtomicMotionOpen] = useState(false);
const [atomicElementId, setAtomicElementId] = useState(motionSkillElements[0]?.id ?? "");
const [atomicVariant, setAtomicVariant] = useState(motionSkillElements[0]?.variants[0] ?? "");
```

- Pass `onOpenAtomicMotion={() => setIsAtomicMotionOpen(true)}` to `BriefPanel`.
- Render `AtomicMotionPanel` when open.
- On generate:

```ts
const component = generateAtomicMotionComponent({ elementId: atomicElementId, variant: atomicVariant });
onGeneratedComponentReady(component);
setIsAtomicMotionOpen(false);
```

- [ ] **Step 7: Update HomeRoute tests**

In `apps/web/src/routes/HomeRoute.test.ts`, add source assertions:

```ts
expect(homeRouteSource).toContain("AtomicMotionPanel");
expect(homeRouteSource).toContain("generateAtomicMotionComponent");
expect(homeRouteSource).toContain("onOpenAtomicMotion");
```

And keep assertion that understanding labels are removed from `BriefPanel.test.ts`.

- [ ] **Step 8: Add CSS**

In `apps/web/src/styles/home.css`, add focused styles:

- `.brief-actions`
- `.atomic-motion-button`
- `.atomic-motion-backdrop`
- `.atomic-motion-panel`
- `.atomic-motion-options`
- `.atomic-motion-summary`

Avoid nested cards and large decorative effects. Keep it visually aligned with current home controls.

- [ ] **Step 9: Run web tests**

Run:

```bash
pnpm --filter @motion-tool/web test -- BriefPanel.test.ts AtomicMotionPanel.test.tsx HomeRoute.test.ts atomicMotionGeneration.test.ts
```

Expected: PASS.

---

### Task 8: Final Verification

**Files:**
- All touched files.

- [ ] **Step 1: Run core focused tests**

Run:

```bash
pnpm --filter @motion-tool/core test -- motionSkill motionRecipe.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run web focused tests**

Run:

```bash
pnpm --filter @motion-tool/web test -- BriefPanel.test.ts AtomicMotionPanel.test.tsx HomeRoute.test.ts atomicMotionGeneration.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run typechecks**

Run:

```bash
pnpm --filter @motion-tool/core typecheck
pnpm --filter @motion-tool/web typecheck
```

Expected: PASS.

- [ ] **Step 4: Run compiler**

Run:

```bash
pnpm motion:compile
```

Expected: PASS and generated files stay stable on immediate second run.

- [ ] **Step 5: Run circular dependency check**

Run:

```bash
pnpm check:circular
```

Expected: PASS.

- [ ] **Step 6: Manual browser verification**

Start dev server:

```bash
pnpm dev
```

Open the local URL from the command output. Verify:

- "自然语义生成" mode shows `[生成新组件] [原子动效参数]`.
- It does not show `已理解 / 文字 / 入场 / 常规` chips.
- Clicking "原子动效参数" opens the selector.
- Select `弹窗反馈 / 中型尺寸`.
- Click generate.
- Generated editor modal opens with replayable popup feedback draft.
- Closing without saving does not add it to the library.

Stop dev server after verification:

```bash
pnpm dev:stop
```

Expected: app returns to clean stopped state.

---

## Acceptance Criteria

- Designer CSV can keep the PDF field names.
- `pnpm motion:compile` emits registry, lock, popup feedback pack, and compile report.
- Incomplete elements are present but disabled.
- `弹窗反馈 / 中型尺寸` compiles into scale + opacity tokens.
- A generated draft component records `manifest.motionSkill`.
- Homepage exposes "原子动效参数" beside "生成新组件".
- Natural semantic generation no longer renders understanding chips.
- Atomic motion generation does not depend on prompt matching.
- Existing generated-draft save behavior remains unchanged.

