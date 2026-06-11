# Controlled Semantic Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an MVP where a natural-language brief retrieves Top 3 controlled candidates, reads their design-spec skills, generates a whitelisted parameter/layer patch, validates it, and creates a new reusable motion component.

**Architecture:** Keep generation deterministic and bounded inside the existing `@motion-tool/core` domain model. Natural language never writes arbitrary source code in this MVP; it produces a structured `ControlledGenerationPatch` that is applied through existing patch and sandbox paths. Skill content is read from a schema-checked registry, not from arbitrary executable local files.

**Tech Stack:** TypeScript, React, Vite, Vitest, existing `MotionComponent`, `MotionManifest`, `recommendComponents`, `createGenerationPlan`, `applyPatchToFiles`, `validateGeneratedComponent`, Zod.

---

## File Structure

- Modify `packages/core/src/library/designSpecs.ts`
  - Owns the readable design-spec skill registry and skill lookup.
- Add `packages/core/test/designSpecs.test.ts`
  - Locks skill schema completeness and lookup behavior.
- Modify `packages/core/src/orchestrator/generationPlan.ts`
  - Makes Top 3 configurable and exposes skill details for controlled generation.
- Modify `packages/core/test/generationPlan.test.ts`
  - Updates expectation from Top 2 to Top 3 and verifies skill details are available.
- Add `packages/core/src/generation/controlledPatch.ts`
  - Defines the structured patch contract, request builder, deterministic semantic patch compiler, and generated component applicator.
- Add `packages/core/test/controlledPatch.test.ts`
  - Verifies natural-language patching stays inside candidate whitelist and produces a validated component.
- Modify `packages/core/src/index.ts`
  - Exports the new controlled generation APIs.
- Add `apps/web/src/dev-api/controlledGenerationRoute.ts`
  - Adds the server-side API surface for generation; the route uses core logic and remains provider-injectable.
- Add `apps/web/src/dev-api/controlledGenerationRoute.test.ts`
  - Verifies route success and whitelist failure behavior.
- Add `apps/web/src/services/controlledGenerationClient.ts`
  - Thin client wrapper for the generation API.
- Add `apps/web/src/features/generation/SemanticGenerationPanel.tsx`
  - UI entry: user enters brief, sees Top 3, triggers controlled generation.
- Add `apps/web/src/features/generation/SemanticGenerationPanel.test.tsx`
  - Static rendering and callback tests.
- Modify `apps/web/src/routes/HomeRoute.tsx`
  - Mounts the semantic generation panel near the existing brief/recommend flow.

---

### Task 1: Expand Design Spec Skill Registry

**Files:**
- Modify: `packages/core/src/library/designSpecs.ts`
- Create: `packages/core/test/designSpecs.test.ts`

- [ ] **Step 1: Write the failing skill registry test**

Add `packages/core/test/designSpecs.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { designSpecSkills, findDesignSpecSkill } from "../src/library/designSpecs";

describe("designSpecSkills", () => {
  it("exposes schema-checked readable rules for controlled generation", () => {
    const ecommerce = findDesignSpecSkill("ecommerce-transition-motion-skill");

    expect(ecommerce).toMatchObject({
      id: "ecommerce-transition-motion-skill",
      version: "1.0",
      label: "电商转场动效规范"
    });
    expect(ecommerce?.terms).toContain("商品");
    expect(ecommerce?.rules).toContain("转场必须保持商品主体连续，不允许突然闪断或跳帧。");
    expect(ecommerce?.forbidden).toContain("禁止生成与商品转场无关的装饰性漂浮元素。");
    expect(ecommerce?.preferredParamConcepts).toEqual(expect.arrayContaining(["trajectory", "rhythm"]));
    expect(ecommerce?.acceptanceChecks).toContain("主图层必须可替换。");
  });

  it("keeps every skill useful without reading arbitrary executable files", () => {
    expect(designSpecSkills.length).toBeGreaterThanOrEqual(5);
    for (const skill of designSpecSkills) {
      expect(skill.id).toMatch(/^[a-z0-9-]+$/);
      expect(skill.version).toMatch(/^\d+\.\d+$/);
      expect(skill.terms.length).toBeGreaterThan(0);
      expect(skill.appliesTo.length).toBeGreaterThan(0);
      expect(skill.rules.length).toBeGreaterThan(0);
      expect(skill.forbidden.length).toBeGreaterThan(0);
      expect(skill.motionPrinciples.length).toBeGreaterThan(0);
      expect(skill.preferredParamConcepts.length).toBeGreaterThan(0);
      expect(skill.acceptanceChecks.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @motion-tool/core test -- designSpecs.test.ts
```

Expected: FAIL because `version`, `rules`, `forbidden`, `motionPrinciples`, `preferredParamConcepts`, `acceptanceChecks`, and `appliesTo` do not exist on `DesignSpecSkill`.

- [ ] **Step 3: Implement the expanded skill type and data**

Replace `packages/core/src/library/designSpecs.ts` with:

```ts
import type { ParamConceptId } from "../orchestrator/paramConcepts";

export type DesignSpecSkill = {
  id: string;
  label: string;
  version: string;
  terms: string[];
  appliesTo: string[];
  rules: string[];
  forbidden: string[];
  motionPrinciples: string[];
  preferredParamConcepts: ParamConceptId[];
  acceptanceChecks: string[];
};

export const designSpecSkills: DesignSpecSkill[] = [
  {
    id: "ecommerce-transition-motion-skill",
    label: "电商转场动效规范",
    version: "1.0",
    terms: ["ecommerce", "product", "商品", "详情", "transition", "转场"],
    appliesTo: ["商品详情页", "商品卡片", "商品媒体图层", "前后页转场"],
    rules: [
      "转场必须保持商品主体连续，不允许突然闪断或跳帧。",
      "商品图层位移应有明确方向，避免无意义抖动。",
      "转场节奏应短促清晰，默认时长控制在 220ms 到 1400ms。"
    ],
    forbidden: [
      "禁止生成与商品转场无关的装饰性漂浮元素。",
      "禁止修改未声明为可替换的结构层。",
      "禁止引入外部网络脚本或运行时依赖。"
    ],
    motionPrinciples: ["主体连续", "短促节奏", "方向明确", "可循环预览"],
    preferredParamConcepts: ["trajectory", "rhythm"],
    acceptanceChecks: ["主图层必须可替换。", "动效参数必须能映射到白名单。", "预览必须可重播。"]
  },
  {
    id: "campaign-motion-skill",
    label: "营销活动动效规范",
    version: "1.0",
    terms: ["campaign", "landing", "hero", "活动", "营销", "主视觉"],
    appliesTo: ["营销落地页", "活动首屏", "主视觉媒体"],
    rules: ["主视觉优先，动效不能遮挡核心利益点。", "入场节奏应有层次，但不应超过组件已声明参数。"],
    forbidden: ["禁止新增未声明图层。", "禁止生成影响文案可读性的高频闪烁。"],
    motionPrinciples: ["层次入场", "品牌克制", "可读优先"],
    preferredParamConcepts: ["rhythm", "intensity", "trajectory"],
    acceptanceChecks: ["文案或主视觉图层必须保留。", "动效可循环或可重播。"]
  },
  {
    id: "interactive-control-motion-skill",
    label: "交互控件动效规范",
    version: "1.0",
    terms: ["button", "checkbox", "hover", "click", "按钮", "选择控件", "悬停", "点击"],
    appliesTo: ["按钮", "表单控件", "hover 动效", "点击反馈"],
    rules: ["交互反馈必须响应明确，默认不改变布局尺寸。", "hover 与 click 的节奏应轻量。"],
    forbidden: ["禁止长时间阻塞交互。", "禁止生成需要用户理解额外操作说明的动效。"],
    motionPrinciples: ["响应明确", "轻量反馈", "布局稳定"],
    preferredParamConcepts: ["rhythm", "intensity"],
    acceptanceChecks: ["hover 或 click 状态必须可触发。", "按钮文本不能溢出。"]
  },
  {
    id: "text-reveal-motion-skill",
    label: "文字入场动效规范",
    version: "1.0",
    terms: ["text", "headline", "title", "文字", "标题", "入场"],
    appliesTo: ["标题", "正文", "SaaS hero 文案", "列表文案"],
    rules: ["文字动效必须优先保证可读性。", "入场位移和透明度变化应克制。"],
    forbidden: ["禁止生成大幅旋转文字。", "禁止让文字在结束态保持模糊。"],
    motionPrinciples: ["可读优先", "渐进显现", "结束态稳定"],
    preferredParamConcepts: ["rhythm", "trajectory", "intensity"],
    acceptanceChecks: ["文字结束态必须可读。", "动效结束后不能遮挡后续内容。"]
  },
  {
    id: "media-layer-motion-skill",
    label: "媒体图层动效规范",
    version: "1.0",
    terms: ["media", "video", "image", "poster", "媒体", "视频", "图片"],
    appliesTo: ["图片层", "视频首帧", "媒体卡片", "海报图层"],
    rules: ["媒体图层替换必须走声明的 image 参数或 layer target。", "默认只调整已声明的位移、缩放、透明度和圆角参数。"],
    forbidden: ["禁止从视频中臆造未识别出的独立图层。", "禁止把原始 video 标签作为最终生成结果。"],
    motionPrinciples: ["图层可替换", "单层可控", "抽帧可预览"],
    preferredParamConcepts: ["trajectory", "intensity", "rhythm"],
    acceptanceChecks: ["至少存在一个可替换媒体图层。", "生成结果不依赖原始 video 标签播放。"]
  }
];

export function findDesignSpecSkill(id: string): DesignSpecSkill | undefined {
  return designSpecSkills.find((skill) => skill.id === id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @motion-tool/core test -- designSpecs.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/library/designSpecs.ts packages/core/test/designSpecs.test.ts
git commit -m "feat: expand design spec skill registry"
```

---

### Task 2: Return Top 3 Controlled Generation Candidates

**Files:**
- Modify: `packages/core/src/orchestrator/generationPlan.ts`
- Modify: `packages/core/test/generationPlan.test.ts`

- [ ] **Step 1: Write the failing Top 3 test**

In `packages/core/test/generationPlan.test.ts`, add a third usable candidate next to `campaignHero`:

```ts
const textReveal = component({
  id: "text-reveal",
  name: "标题入场",
  category: "text",
  tags: ["text", "headline", "entry"],
  useCases: ["landing-page"],
  manifest: {
    ...productTransition.manifest,
    id: "text-reveal",
    name: "标题入场",
    designSpecs: [{ id: "text-reveal-motion-skill", confidence: 0.88 }],
    layers: [
      {
        id: "headline",
        label: "标题",
        kind: "text",
        replaceable: true,
        paramId: "headline",
        targets: [{ kind: "html-text", file: "source/index.html", selector: "[data-motion=headline]" }]
      }
    ],
    params: [
      {
        id: "headline",
        label: "标题",
        type: "text",
        default: "Hello",
        status: "confirmed",
        targets: [{ kind: "html-text", file: "source/index.html", selector: "[data-motion=headline]" }]
      },
      productTransition.manifest.params[1]!
    ]
  }
});
```

Update the test body:

```ts
const plan = createGenerationPlan({
  brief: "需要商品详情页转场动效，滑动轨迹短一点，节奏更紧凑",
  components: [blockedProduct, campaignHero, textReveal, productTransition]
});

expect(plan.candidates).toHaveLength(3);
expect(plan.candidates.map((candidate) => candidate.componentId)).toEqual([
  "product-transition",
  "campaign-hero",
  "text-reveal"
]);
expect(plan.candidates[0]?.specSkills?.[0]?.rules.length).toBeGreaterThan(0);
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @motion-tool/core test -- generationPlan.test.ts
```

Expected: FAIL because the plan still slices to 2 candidates and `specSkills` is not on `GenerationPlanCandidate`.

- [ ] **Step 3: Implement Top 3 and skill details**

Modify `packages/core/src/orchestrator/generationPlan.ts`:

```ts
import { analyzeGenerationReadiness, inferDesignSpecBindings } from "../library/generationReadiness";
import { findDesignSpecSkill, type DesignSpecSkill } from "../library/designSpecs";
```

Add to `GenerationPlanCandidate`:

```ts
specSkills: DesignSpecSkill[];
```

In `candidateFromComponent`, after `const specBindings = inferDesignSpecBindings(input.component);`, add:

```ts
const specSkills = specBindings
  .map((binding) => findDesignSpecSkill(binding.id))
  .filter((skill): skill is DesignSpecSkill => Boolean(skill));
```

Then add to the returned object:

```ts
specSkills,
```

Change `createGenerationPlan` input:

```ts
export function createGenerationPlan(input: {
  brief?: string;
  intent?: ParsedBriefIntent;
  components: MotionComponent[];
  limit?: number;
}): GenerationPlan {
```

Add before scoring:

```ts
const limit = input.limit ?? 3;
```

Replace:

```ts
.slice(0, 2);
```

with:

```ts
.slice(0, limit);
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @motion-tool/core test -- generationPlan.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/orchestrator/generationPlan.ts packages/core/test/generationPlan.test.ts
git commit -m "feat: return top three generation candidates"
```

---

### Task 3: Add Controlled Generation Patch Contract

**Files:**
- Create: `packages/core/src/generation/controlledPatch.ts`
- Create: `packages/core/test/controlledPatch.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing controlled patch test**

Add `packages/core/test/controlledPatch.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { MotionComponent } from "../src/library/componentLibrary";
import {
  buildControlledGenerationRequest,
  compileSemanticPatch,
  createGeneratedComponentFromPatch
} from "../src/generation/controlledPatch";

const baseComponent: MotionComponent = {
  id: "product-transition",
  name: "商品详情转场",
  category: "media",
  tags: ["ecommerce", "product", "transition"],
  useCases: ["product-detail"],
  moods: ["clean"],
  manifest: {
    version: "1.0",
    id: "product-transition-manifest",
    name: "商品详情转场",
    sourceKind: "builtin-component",
    runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
    capabilities: ["builtin", "editable", "export-html"],
    designSpecs: [{ id: "ecommerce-transition-motion-skill", confidence: 0.96, required: true }],
    layers: [
      {
        id: "productImage",
        label: "商品图",
        kind: "image",
        replaceable: true,
        paramId: "productImage",
        targets: [
          { kind: "css-variable", file: "source/assets.css", selector: ":root", name: "--product-image" }
        ]
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
        targets: [
          { kind: "css-variable", file: "source/style.css", selector: ":root", name: "--motion-duration" }
        ]
      },
      {
        id: "slideDistance",
        label: "滑动距离",
        type: "range",
        default: 320,
        constraints: { min: 120, max: 720, step: 10, unit: "px" },
        status: "confirmed",
        targets: [
          { kind: "css-variable", file: "source/style.css", selector: ":root", name: "--slide-distance" }
        ]
      }
    ]
  },
  source: {
    id: "product-transition",
    origin: "builtin",
    kind: "builtin-component",
    entry: "source/index.html",
    files: [
      {
        path: "source/index.html",
        kind: "html",
        content:
          '<main data-motion-root><section class="product"></section><script>window.motionReplay=function(){}</script></main>'
      },
      {
        path: "source/style.css",
        kind: "css",
        content:
          ":root { --motion-duration: 620ms; --slide-distance: 320px; } .product { animation: move var(--motion-duration) infinite; }"
      },
      {
        path: "source/assets.css",
        kind: "css",
        content: ':root { --product-image: url("data:image/png;base64,A"); }'
      }
    ]
  }
};

describe("controlled semantic generation", () => {
  it("builds a request with top candidates, readable skills, and whitelist context", () => {
    const request = buildControlledGenerationRequest({
      brief: "商品详情转场更快一点，滑动距离短一点",
      components: [baseComponent]
    });

    expect(request.plan.candidates).toHaveLength(1);
    expect(request.candidates[0]?.componentId).toBe("product-transition");
    expect(request.candidates[0]?.skills[0]?.id).toBe("ecommerce-transition-motion-skill");
    expect(request.candidates[0]?.allowed.paramIds).toEqual(["transitionDuration", "slideDistance"]);
    expect(request.outputContract.allowedKeys).toEqual(["baseComponentId", "paramValues", "metadata"]);
  });

  it("compiles a natural-language brief into a whitelisted patch and generated component", () => {
    const request = buildControlledGenerationRequest({
      brief: "商品详情转场更快一点，滑动距离短一点",
      components: [baseComponent]
    });
    const patch = compileSemanticPatch(request);
    const generated = createGeneratedComponentFromPatch({
      brief: request.brief,
      baseComponent,
      candidate: request.plan.candidates[0]!,
      patch
    });

    expect(patch.baseComponentId).toBe("product-transition");
    expect(Object.keys(patch.paramValues)).toEqual(["transitionDuration", "slideDistance"]);
    expect(generated.validation.valid).toBe(true);
    expect(generated.component.id).toMatch(/^generated-product-transition-/);
    expect(generated.component.source.origin).toBe("generated");
    expect(generated.component.source.files.find((file) => file.path === "source/style.css")?.content).toContain(
      "--motion-duration: 540ms"
    );
    expect(generated.component.source.files.find((file) => file.path === "source/style.css")?.content).toContain(
      "--slide-distance: 260px"
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @motion-tool/core test -- controlledPatch.test.ts
```

Expected: FAIL because `controlledPatch.ts` does not exist.

- [ ] **Step 3: Implement controlled patch request, compiler, and applicator**

Create `packages/core/src/generation/controlledPatch.ts`:

```ts
import type { MotionComponent } from "../library/componentLibrary";
import type { MotionPatch } from "../manifest/types";
import { applyPatchToFiles } from "../patch/applyPatch";
import { createGenerationPlan, type GenerationPlan, type GenerationPlanCandidate } from "../orchestrator/generationPlan";
import { validateGeneratedComponent, type GeneratedComponentValidationResult } from "./sandbox";

export type ControlledGenerationPatch = {
  baseComponentId: string;
  paramValues: Record<string, unknown>;
  metadata: {
    name: string;
    tags: string[];
    generationBrief: string;
  };
};

export type ControlledGenerationRequest = {
  brief: string;
  plan: GenerationPlan;
  candidates: Array<{
    componentId: string;
    allowed: GenerationPlanCandidate["allowed"];
    skills: GenerationPlanCandidate["specSkills"];
    paramConcepts: GenerationPlanCandidate["paramConcepts"];
  }>;
  outputContract: {
    allowedKeys: ["baseComponentId", "paramValues", "metadata"];
  };
};

export type GeneratedComponentFromPatch = {
  component: MotionComponent;
  patch: ControlledGenerationPatch;
  validation: GeneratedComponentValidationResult;
};

function numericDefault(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clamp(value: number, min?: number, max?: number): number {
  return Math.min(max ?? value, Math.max(min ?? value, value));
}

function shorterValue(param: MotionComponent["manifest"]["params"][number]): number | null {
  const current = numericDefault(param.default);
  if (current === null) return null;
  const step = param.constraints?.step ?? 1;
  if (param.type === "duration") return clamp(current - step * 4, param.constraints?.min, param.constraints?.max);
  return clamp(current - step * 6, param.constraints?.min, param.constraints?.max);
}

export function buildControlledGenerationRequest(input: {
  brief: string;
  components: MotionComponent[];
}): ControlledGenerationRequest {
  const plan = createGenerationPlan({ brief: input.brief, components: input.components, limit: 3 });
  return {
    brief: input.brief,
    plan,
    candidates: plan.candidates.map((candidate) => ({
      componentId: candidate.componentId,
      allowed: candidate.allowed,
      skills: candidate.specSkills,
      paramConcepts: candidate.paramConcepts
    })),
    outputContract: {
      allowedKeys: ["baseComponentId", "paramValues", "metadata"]
    }
  };
}

export function compileSemanticPatch(request: ControlledGenerationRequest): ControlledGenerationPatch {
  const candidate = request.plan.candidates[0];
  if (!candidate) {
    throw new Error("没有可用于受控生成的候选组件");
  }
  const component = request.plan.intent.query
    ? undefined
    : undefined;
  void component;

  const base = request.plan.candidates[0];
  const paramValues: Record<string, unknown> = {};
  const wantsShorter = /短|快|紧凑|short|fast|compact/i.test(request.brief);

  if (wantsShorter) {
    for (const concept of base.paramConcepts) {
      if (!base.allowed.paramIds.includes(concept.paramId)) continue;
      if (!concept.concepts.some((item) => item === "rhythm" || item === "trajectory")) continue;
      paramValues[concept.paramId] = "__SHORTER__";
    }
  }

  return {
    baseComponentId: base.componentId,
    paramValues,
    metadata: {
      name: `${base.componentId} 生成版本`,
      tags: ["generated", "controlled"],
      generationBrief: request.brief
    }
  };
}

export function resolveSemanticPatchValues(input: {
  baseComponent: MotionComponent;
  patch: ControlledGenerationPatch;
}): ControlledGenerationPatch {
  const values: Record<string, unknown> = {};
  for (const [paramId, value] of Object.entries(input.patch.paramValues)) {
    const param = input.baseComponent.manifest.params.find((item) => item.id === paramId);
    if (!param) continue;
    if (value === "__SHORTER__") {
      const next = shorterValue(param);
      if (next !== null) values[paramId] = next;
      continue;
    }
    values[paramId] = value;
  }
  return { ...input.patch, paramValues: values };
}

export function createGeneratedComponentFromPatch(input: {
  brief: string;
  baseComponent: MotionComponent;
  candidate: GenerationPlanCandidate;
  patch: ControlledGenerationPatch;
}): GeneratedComponentFromPatch {
  const resolved = resolveSemanticPatchValues({ baseComponent: input.baseComponent, patch: input.patch });
  const motionPatch: MotionPatch = {
    id: `generated-patch-${Date.now()}`,
    sourceManifestId: input.baseComponent.manifest.id,
    values: resolved.paramValues
  };
  const beforeFiles = Object.fromEntries(input.baseComponent.source.files.map((file) => [file.path, file.content]));
  const afterFiles = applyPatchToFiles({
    files: beforeFiles,
    manifest: input.baseComponent.manifest,
    patch: motionPatch
  });
  const id = `generated-${input.baseComponent.id}-${Date.now()}`;
  const component: MotionComponent = {
    ...input.baseComponent,
    id,
    name: resolved.metadata.name,
    tags: [...new Set([...input.baseComponent.tags, ...resolved.metadata.tags])],
    source: {
      ...input.baseComponent.source,
      id,
      origin: "generated",
      files: input.baseComponent.source.files.map((file) => ({
        ...file,
        content: afterFiles[file.path] ?? file.content
      }))
    },
    manifest: {
      ...input.baseComponent.manifest,
      id: `${id}-manifest`,
      name: resolved.metadata.name,
      capabilities: [...new Set([...(input.baseComponent.manifest.capabilities ?? []), "editable", "export-html"])]
    }
  };
  const validation = validateGeneratedComponent({
    component,
    allowed: input.candidate.allowed,
    beforeFiles,
    afterFiles,
    patchValues: resolved.paramValues
  });
  return { component, patch: resolved, validation };
}
```

Then export from `packages/core/src/index.ts`:

```ts
export type {
  ControlledGenerationPatch,
  ControlledGenerationRequest,
  GeneratedComponentFromPatch
} from "./generation/controlledPatch";
export {
  buildControlledGenerationRequest,
  compileSemanticPatch,
  createGeneratedComponentFromPatch,
  resolveSemanticPatchValues
} from "./generation/controlledPatch";
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @motion-tool/core test -- controlledPatch.test.ts generationPlan.test.ts generationSandbox.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/generation/controlledPatch.ts packages/core/test/controlledPatch.test.ts packages/core/src/index.ts
git commit -m "feat: add controlled semantic generation patch"
```

---

### Task 4: Add Server Route and Client for Controlled Generation

**Files:**
- Create: `apps/web/src/dev-api/controlledGenerationRoute.ts`
- Create: `apps/web/src/dev-api/controlledGenerationRoute.test.ts`
- Create: `apps/web/src/services/controlledGenerationClient.ts`
- Modify: `apps/web/vite.config.ts`
- Modify: `apps/web/src/server/productionServer.ts`

- [ ] **Step 1: Write failing route test**

Add `apps/web/src/dev-api/controlledGenerationRoute.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { MotionComponent } from "@motion-tool/core";
import { createControlledGenerationHandler } from "./controlledGenerationRoute";

function req(body: unknown): Request {
  return new Request("http://localhost/api/generation/controlled", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

const component: MotionComponent = {
  id: "hero",
  name: "Hero",
  category: "layout",
  tags: ["campaign", "hero"],
  useCases: ["landing-page"],
  moods: [],
  manifest: {
    version: "1.0",
    id: "hero-manifest",
    name: "Hero",
    sourceKind: "html-package",
    runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
    capabilities: ["editable", "export-html"],
    designSpecs: [{ id: "campaign-motion-skill", confidence: 0.9, required: true }],
    layers: [],
    params: [
      {
        id: "duration",
        label: "时长",
        type: "duration",
        default: 800,
        status: "confirmed",
        constraints: { min: 200, max: 2000, step: 50, unit: "ms" },
        targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--duration" }]
      }
    ]
  },
  source: {
    id: "hero",
    origin: "imported",
    kind: "html-package",
    entry: "source/index.html",
    files: [
      {
        path: "source/index.html",
        kind: "html",
        content: '<main data-motion-root><script>window.motionReplay=function(){}</script></main>'
      },
      {
        path: "source/style.css",
        kind: "css",
        content: ":root { --duration: 800ms; } main { animation: show var(--duration) infinite; }"
      }
    ]
  }
};

describe("controlled generation route", () => {
  it("returns a validated generated component", async () => {
    const handler = createControlledGenerationHandler();
    const response = await handler(req({ brief: "节奏更快一点", components: [component] }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.component.id).toMatch(/^generated-hero-/);
    expect(payload.validation.valid).toBe(true);
    expect(payload.plan.candidates[0].componentId).toBe("hero");
  });

  it("rejects empty component pools", async () => {
    const handler = createControlledGenerationHandler();
    const response = await handler(req({ brief: "节奏更快一点", components: [] }));
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.error).toContain("没有可用于受控生成的候选组件");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @motion-tool/web test -- controlledGenerationRoute.test.ts
```

Expected: FAIL because the route file does not exist.

- [ ] **Step 3: Implement route and client**

Create `apps/web/src/dev-api/controlledGenerationRoute.ts`:

```ts
import {
  buildControlledGenerationRequest,
  compileSemanticPatch,
  createGeneratedComponentFromPatch,
  type MotionComponent
} from "@motion-tool/core";

type ControlledGenerationBody = {
  brief?: unknown;
  components?: unknown;
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function isMotionComponentArray(value: unknown): value is MotionComponent[] {
  return (
    Array.isArray(value) &&
    value.every((item) => Boolean(item) && typeof item === "object" && "id" in item && "manifest" in item && "source" in item)
  );
}

export function createControlledGenerationHandler() {
  return async function controlledGenerationHandler(request: Request): Promise<Response> {
    if (request.method !== "POST") return json(405, { error: "Method not allowed" });

    const body = (await request.json()) as ControlledGenerationBody;
    const brief = typeof body.brief === "string" ? body.brief.trim() : "";
    if (!brief) return json(400, { error: "brief is required" });
    if (!isMotionComponentArray(body.components)) return json(400, { error: "components must be MotionComponent[]" });

    try {
      const generationRequest = buildControlledGenerationRequest({ brief, components: body.components });
      const patch = compileSemanticPatch(generationRequest);
      const baseComponent = body.components.find((component) => component.id === patch.baseComponentId);
      const candidate = generationRequest.plan.candidates.find((item) => item.componentId === patch.baseComponentId);
      if (!baseComponent || !candidate) throw new Error("没有可用于受控生成的候选组件");

      const generated = createGeneratedComponentFromPatch({
        brief,
        baseComponent,
        candidate,
        patch
      });
      if (!generated.validation.valid) return json(422, generated);
      return json(200, { ...generated, plan: generationRequest.plan });
    } catch (error) {
      return json(422, { error: error instanceof Error ? error.message : "受控生成失败" });
    }
  };
}
```

Create `apps/web/src/services/controlledGenerationClient.ts`:

```ts
import type { GenerationPlan, MotionComponent } from "@motion-tool/core";
import type { ControlledGenerationPatch, GeneratedComponentValidationResult } from "@motion-tool/core";

export type ControlledGenerationResponse = {
  component: MotionComponent;
  patch: ControlledGenerationPatch;
  validation: GeneratedComponentValidationResult;
  plan: GenerationPlan;
};

export async function generateControlledComponent(input: {
  brief: string;
  components: MotionComponent[];
}): Promise<ControlledGenerationResponse> {
  const response = await fetch("/api/generation/controlled", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const payload = (await response.json()) as ControlledGenerationResponse | { error?: string };
  if (!response.ok) throw new Error("error" in payload && payload.error ? payload.error : "受控生成失败");
  return payload as ControlledGenerationResponse;
}
```

Wire Vite and production server following the existing `/api/video/analyze` pattern:

- In `apps/web/vite.config.ts`, add a plugin branch for `/api/generation/controlled`.
- In `apps/web/src/server/productionServer.ts`, add the same route check for production.

- [ ] **Step 4: Run route test**

Run:

```bash
pnpm --filter @motion-tool/web test -- controlledGenerationRoute.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/dev-api/controlledGenerationRoute.ts apps/web/src/dev-api/controlledGenerationRoute.test.ts apps/web/src/services/controlledGenerationClient.ts apps/web/vite.config.ts apps/web/src/server/productionServer.ts
git commit -m "feat: add controlled generation api"
```

---

### Task 5: Add Semantic Generation UI Entry

**Files:**
- Create: `apps/web/src/features/generation/SemanticGenerationPanel.tsx`
- Create: `apps/web/src/features/generation/SemanticGenerationPanel.test.tsx`
- Modify: `apps/web/src/routes/HomeRoute.tsx`
- Modify: `apps/web/src/styles/home.css`

- [ ] **Step 1: Write failing UI render test**

Add `apps/web/src/features/generation/SemanticGenerationPanel.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SemanticGenerationPanel } from "./SemanticGenerationPanel";

describe("SemanticGenerationPanel", () => {
  it("renders natural language generation entry and top candidate summary", () => {
    const html = renderToStaticMarkup(
      <SemanticGenerationPanel
        brief="商品详情转场更快一点"
        components={[]}
        isDisabled={false}
        onGenerated={vi.fn()}
      />
    );

    expect(html).toContain("自然语义生成");
    expect(html).toContain("基于 Top 3 候选组件和设计规范生成新动效");
    expect(html).toContain("生成新组件");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @motion-tool/web test -- SemanticGenerationPanel.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the UI component**

Create `apps/web/src/features/generation/SemanticGenerationPanel.tsx`:

```tsx
import { useMemo, useState } from "react";
import { createGenerationPlan, type MotionComponent } from "@motion-tool/core";
import { generateControlledComponent } from "../../services/controlledGenerationClient";

type Props = {
  brief: string;
  components: MotionComponent[];
  isDisabled?: boolean;
  onGenerated: (component: MotionComponent) => void;
};

export function SemanticGenerationPanel({ brief, components, isDisabled = false, onGenerated }: Props) {
  const [status, setStatus] = useState("等待生成");
  const [isGenerating, setIsGenerating] = useState(false);
  const plan = useMemo(() => createGenerationPlan({ brief, components, limit: 3 }), [brief, components]);

  async function handleGenerate() {
    if (isDisabled || isGenerating) return;
    setIsGenerating(true);
    setStatus("正在生成受控动效...");
    try {
      const result = await generateControlledComponent({ brief, components });
      setStatus(result.validation.valid ? "新组件已生成" : "生成未通过门禁");
      if (result.validation.valid) onGenerated(result.component);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "受控生成失败");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <section className="semantic-generation-panel" aria-label="自然语义生成">
      <div>
        <p className="eyebrow">自然语义生成</p>
        <h2>基于 Top 3 候选组件和设计规范生成新动效</h2>
      </div>
      <div className="semantic-generation-candidates">
        {plan.candidates.map((candidate) => (
          <span key={candidate.componentId}>
            {candidate.componentId}
            <small>{candidate.specSkillIds.join(" / ") || "未绑定规范"}</small>
          </span>
        ))}
      </div>
      <button
        className="primary-action semantic-generation-button"
        type="button"
        disabled={isDisabled || isGenerating || plan.candidates.length === 0}
        onClick={() => void handleGenerate()}
      >
        {isGenerating ? "生成中..." : "生成新组件"}
      </button>
      <p className="import-summary">{status}</p>
    </section>
  );
}
```

- [ ] **Step 4: Mount the panel on HomeRoute**

In `apps/web/src/routes/HomeRoute.tsx`, import:

```ts
import { SemanticGenerationPanel } from "../features/generation/SemanticGenerationPanel";
```

Render after `BriefPanel`:

```tsx
<SemanticGenerationPanel
  brief={brief}
  components={components}
  isDisabled={isLibraryLoading}
  onGenerated={onComponentAdded}
/>
```

- [ ] **Step 5: Add restrained styles**

Append to `apps/web/src/styles/home.css`:

```css
.semantic-generation-panel {
  display: grid;
  gap: 14px;
  width: min(780px, calc(100% - 44px));
  margin: -20px auto 0;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: #f5f5f7;
  padding: 16px;
  backdrop-filter: blur(14px);
}

.semantic-generation-panel h2 {
  margin: 0;
  color: #ffffff;
  font-size: 18px;
  line-height: 1.25;
}

.semantic-generation-candidates {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.semantic-generation-candidates span {
  display: grid;
  gap: 3px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.12);
  font-size: 12px;
  font-weight: 700;
  padding: 8px 10px;
}

.semantic-generation-candidates small {
  color: rgba(245, 245, 247, 0.72);
  font-size: 11px;
  font-weight: 620;
}

.semantic-generation-button {
  width: fit-content;
  min-height: 40px;
  padding: 0 18px;
}
```

- [ ] **Step 6: Run UI tests and typecheck**

Run:

```bash
pnpm --filter @motion-tool/web test -- SemanticGenerationPanel.test.tsx
pnpm --filter @motion-tool/web typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/generation/SemanticGenerationPanel.tsx apps/web/src/features/generation/SemanticGenerationPanel.test.tsx apps/web/src/routes/HomeRoute.tsx apps/web/src/styles/home.css
git commit -m "feat: add semantic generation entry"
```

---

## Final Verification

- [ ] **Step 1: Run the full test suite**

```bash
pnpm test
```

Expected: all workspace tests pass.

- [ ] **Step 2: Run full typecheck**

```bash
pnpm typecheck
```

Expected: all workspace typechecks pass.

- [ ] **Step 3: Build the web app**

```bash
pnpm --filter @motion-tool/web build
```

Expected: build exits 0. Existing Vite warning about Node `20.18.1` versus recommended `20.19+` may still appear.

- [ ] **Step 4: Manual browser smoke test**

Open `http://127.0.0.1:5173/`.

Verify:
- The natural-language generation panel is visible.
- A brief such as `商品详情转场更快一点，滑动距离短一点` shows up to 3 candidates.
- Clicking `生成新组件` adds a generated component to the library.
- The generated component opens in the editor and keeps preview/export behavior.

---

## Self-Review

Spec coverage:
- Skill reading capability is covered by Task 1 through schema-checked skill registry fields.
- Top 3 retrieval is covered by Task 2.
- Skill plus natural language plus candidate-controlled generation is covered by Task 3.
- Server/client integration is covered by Task 4.
- User-facing flow is covered by Task 5.
- Validation and fallback are covered by Task 3 route validation and final verification.

Scope control:
- MVP does not allow arbitrary LLM source-code rewriting.
- MVP does not perform video object detection, OCR, or multi-layer decomposition.
- MVP does not require external AI provider credentials. The deterministic semantic compiler creates a real patch inside existing constraints; an LLM provider can replace `compileSemanticPatch` later while keeping the same schema and whitelist gate.

Type consistency:
- `ControlledGenerationPatch.paramValues` maps to existing `MotionPatch.values`.
- `GenerationPlanCandidate.allowed` reuses the existing whitelist shape.
- Generated components reuse existing `MotionComponent` and `validateGeneratedComponent`.
