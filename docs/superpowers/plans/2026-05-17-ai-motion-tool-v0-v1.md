# AI Motion Tool V0+V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the V0+V1 motion tool: built-in motion component recommendation/editing plus imported web motion asset parameter detection and confirmation.

**Architecture:** Use a small TypeScript monorepo. `packages/core` owns manifest types, validation, component library loading, patching, import analysis, and export composition. `apps/web` owns the React editor UI, iframe preview, import confirmation, and export controls. Built-in motion assets live in `motion-components` as plain HTML/CSS/JS packages with metadata and `motion.manifest.json`.

**Tech Stack:** TypeScript, React, Vite, Vitest, Zod, JSZip, PostCSS/value-parser if needed for CSS scanning, browser iframe sandbox for preview.

---

## Assumptions

- Project root: `/Users/heyunshen/Documents/Codex/2026-05-16/ai/ai-motion-tool`
- Package manager: `pnpm`
- Runtime target: browser-first web app.
- AI calls are mocked in V0. The AI Orchestrator interface is real, but the first implementation ranks built-in component metadata deterministically. A real model provider can be wired behind the same interface later.
- V0+V1 do not perform public internet search.
- Built-in components are plain HTML/CSS/JS. React/Vue/Svelte import is represented only as `component-lite` metadata in V1.

## Directory Structure

```text
ai-motion-tool/
  apps/
    web/
      index.html
      package.json
      src/
        App.tsx
        main.tsx
        styles.css
        features/
          brief/BriefPanel.tsx
          library/ComponentCandidates.tsx
          editor/ParameterPanel.tsx
          editor/PreviewFrame.tsx
          import/ImportPanel.tsx
          import/ConfirmParamsPanel.tsx
          export/ExportPanel.tsx
        state/
          projectStore.ts
  packages/
    core/
      package.json
      src/
        index.ts
        manifest/types.ts
        manifest/schema.ts
        library/componentLibrary.ts
        orchestrator/recommend.ts
        patch/applyPatch.ts
        import/sourceImporter.ts
        analyze/ruleScanner.ts
        analyze/paramAdvisor.ts
        analyze/validator.ts
        export/exportPackage.ts
      test/
        manifest.schema.test.ts
        library.test.ts
        recommend.test.ts
        applyPatch.test.ts
        sourceImporter.test.ts
        ruleScanner.test.ts
        validator.test.ts
        exportPackage.test.ts
  motion-components/
    hero-text-reveal/
      source/index.html
      source/style.css
      source/script.js
      motion.manifest.json
      metadata.json
    staggered-card-enter/
      source/index.html
      source/style.css
      source/script.js
      motion.manifest.json
      metadata.json
  docs/
    superpowers/
      specs/2026-05-17-ai-motion-tool-design.md
      plans/2026-05-17-ai-motion-tool-v0-v1.md
```

## Task 1: Scaffold The Workspace

**Files:**

- Create: `ai-motion-tool/package.json`
- Create: `ai-motion-tool/pnpm-workspace.yaml`
- Create: `ai-motion-tool/tsconfig.base.json`
- Create: `ai-motion-tool/apps/web/package.json`
- Create: `ai-motion-tool/packages/core/package.json`

- [ ] **Step 1: Create workspace package files**

Create `package.json`:

```json
{
  "name": "ai-motion-tool",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "pnpm --filter @motion-tool/web dev",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "build": "pnpm -r build"
  },
  "devDependencies": {
    "typescript": "^5.8.0"
  }
}
```

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true
  }
}
```

Create `packages/core/package.json`:

```json
{
  "name": "@motion-tool/core",
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "build": "tsc --noEmit"
  },
  "dependencies": {
    "jszip": "^3.10.1",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "vitest": "^3.2.0",
    "typescript": "^5.8.0"
  }
}
```

Create `apps/web/package.json`:

```json
{
  "name": "@motion-tool/web",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "build": "vite build"
  },
  "dependencies": {
    "@motion-tool/core": "workspace:*",
    "@vitejs/plugin-react": "^5.0.0",
    "vite": "^7.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "vitest": "^3.2.0",
    "typescript": "^5.8.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:

```bash
cd /Users/heyunshen/Documents/Codex/2026-05-16/ai/ai-motion-tool
pnpm install
```

Expected: `node_modules` and `pnpm-lock.yaml` are created.

- [ ] **Step 3: Verify empty workspace scripts are wired**

Run:

```bash
pnpm -r typecheck
```

Expected: no package has source yet or TypeScript reports missing config. If it reports missing config, add per-package `tsconfig.json` files in Task 2.

## Task 2: Define Core Manifest Types And Runtime Schema

**Files:**

- Create: `packages/core/src/manifest/types.ts`
- Create: `packages/core/src/manifest/schema.ts`
- Create: `packages/core/src/index.ts`
- Create: `packages/core/test/manifest.schema.test.ts`
- Create: `packages/core/tsconfig.json`

- [ ] **Step 1: Write failing schema tests**

Create `packages/core/test/manifest.schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { motionManifestSchema } from "../src/manifest/schema";

describe("motionManifestSchema", () => {
  it("accepts a minimal confirmed HTML manifest", () => {
    const result = motionManifestSchema.safeParse({
      version: "1.0",
      id: "hero-text-reveal",
      name: "Hero Text Reveal",
      sourceKind: "builtin-component",
      runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
      params: [
        {
          id: "headline",
          label: "Headline",
          type: "text",
          default: "Build faster",
          status: "confirmed",
          targets: [{ kind: "html-text", file: "source/index.html", selector: "[data-motion=headline]" }]
        }
      ]
    });

    expect(result.success).toBe(true);
  });

  it("rejects unsupported parameter types", () => {
    const result = motionManifestSchema.safeParse({
      version: "1.0",
      id: "bad",
      name: "Bad",
      sourceKind: "builtin-component",
      runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
      params: [
        {
          id: "timeline",
          label: "Timeline",
          type: "keyframe-editor",
          default: [],
          status: "confirmed",
          targets: []
        }
      ]
    });

    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @motion-tool/core test packages/core/test/manifest.schema.test.ts
```

Expected: FAIL because `manifest/schema` does not exist.

- [ ] **Step 3: Implement manifest types and schema**

Create `packages/core/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "test"],
  "compilerOptions": {
    "types": ["vitest/globals"],
    "noEmit": true
  }
}
```

Create `packages/core/src/manifest/types.ts`:

```ts
export type SourceKind = "builtin-component" | "single-html" | "html-package" | "css-svg" | "component-lite";

export type MotionRuntime = {
  engine: "html";
  entry: string;
  sandbox: "iframe";
  dependencies?: RuntimeDependency[];
};

export type RuntimeDependency = {
  name: string;
  version?: string;
  url?: string;
};

export type MotionParamType =
  | "color"
  | "number"
  | "range"
  | "text"
  | "image"
  | "toggle"
  | "select"
  | "easing"
  | "duration"
  | "position"
  | "transform";

export type MotionParamStatus = "detected" | "suggested" | "confirmed" | "rejected";

export type MotionParamConstraints = {
  min?: number;
  max?: number;
  step?: number;
  unit?: "px" | "%" | "ms" | "s" | "deg" | "rem" | "vh" | "vw";
  options?: { label: string; value: string | number | boolean }[];
  allowedFileTypes?: string[];
  maxLength?: number;
};

export type MotionTarget =
  | { kind: "css-variable"; file: string; selector: string; name: string }
  | { kind: "css-property"; file: string; selector: string; property: string }
  | { kind: "html-text"; file: string; selector: string }
  | { kind: "html-attribute"; file: string; selector: string; attribute: string }
  | { kind: "svg-attribute"; file: string; selector: string; attribute: string }
  | { kind: "js-config"; file: string; path: string }
  | { kind: "component-prop"; component: string; prop: string };

export type MotionParamUI = {
  group?: string;
  order?: number;
  helperText?: string;
};

export type MotionParam = {
  id: string;
  label: string;
  description?: string;
  type: MotionParamType;
  default: unknown;
  value?: unknown;
  status: MotionParamStatus;
  confidence?: number;
  constraints?: MotionParamConstraints;
  targets: MotionTarget[];
  ui?: MotionParamUI;
};

export type MotionParamGroup = {
  id: string;
  label: string;
  params: string[];
};

export type MotionPatch = {
  id: string;
  sourceManifestId: string;
  values: Record<string, unknown>;
};

export type MotionPreset = {
  id: string;
  name: string;
  patch: MotionPatch;
};

export type MotionCapability = "editable" | "export-html" | "imported" | "builtin";

export type MotionManifest = {
  version: "1.0";
  id: string;
  name: string;
  sourceKind: SourceKind;
  runtime: MotionRuntime;
  params: MotionParam[];
  groups?: MotionParamGroup[];
  presets?: MotionPreset[];
  capabilities?: MotionCapability[];
};
```

Create `packages/core/src/manifest/schema.ts`:

```ts
import { z } from "zod";

const runtimeDependencySchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  url: z.string().optional()
});

const targetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("css-variable"), file: z.string(), selector: z.string(), name: z.string() }),
  z.object({ kind: z.literal("css-property"), file: z.string(), selector: z.string(), property: z.string() }),
  z.object({ kind: z.literal("html-text"), file: z.string(), selector: z.string() }),
  z.object({
    kind: z.literal("html-attribute"),
    file: z.string(),
    selector: z.string(),
    attribute: z.string()
  }),
  z.object({
    kind: z.literal("svg-attribute"),
    file: z.string(),
    selector: z.string(),
    attribute: z.string()
  }),
  z.object({ kind: z.literal("js-config"), file: z.string(), path: z.string() }),
  z.object({ kind: z.literal("component-prop"), component: z.string(), prop: z.string() })
]);

export const motionParamSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  type: z.enum([
    "color",
    "number",
    "range",
    "text",
    "image",
    "toggle",
    "select",
    "easing",
    "duration",
    "position",
    "transform"
  ]),
  default: z.unknown(),
  value: z.unknown().optional(),
  status: z.enum(["detected", "suggested", "confirmed", "rejected"]),
  confidence: z.number().min(0).max(1).optional(),
  constraints: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      step: z.number().optional(),
      unit: z.enum(["px", "%", "ms", "s", "deg", "rem", "vh", "vw"]).optional(),
      options: z
        .array(z.object({ label: z.string(), value: z.union([z.string(), z.number(), z.boolean()]) }))
        .optional(),
      allowedFileTypes: z.array(z.string()).optional(),
      maxLength: z.number().int().positive().optional()
    })
    .optional(),
  targets: z.array(targetSchema),
  ui: z
    .object({
      group: z.string().optional(),
      order: z.number().optional(),
      helperText: z.string().optional()
    })
    .optional()
});

export const motionManifestSchema = z.object({
  version: z.literal("1.0"),
  id: z.string().min(1),
  name: z.string().min(1),
  sourceKind: z.enum(["builtin-component", "single-html", "html-package", "css-svg", "component-lite"]),
  runtime: z.object({
    engine: z.literal("html"),
    entry: z.string().min(1),
    sandbox: z.literal("iframe"),
    dependencies: z.array(runtimeDependencySchema).optional()
  }),
  params: z.array(motionParamSchema),
  groups: z.array(z.object({ id: z.string(), label: z.string(), params: z.array(z.string()) })).optional(),
  presets: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        patch: z.object({ id: z.string(), sourceManifestId: z.string(), values: z.record(z.unknown()) })
      })
    )
    .optional(),
  capabilities: z.array(z.enum(["editable", "export-html", "imported", "builtin"])).optional()
});
```

Create `packages/core/src/index.ts`:

```ts
export * from "./manifest/types";
export * from "./manifest/schema";
```

- [ ] **Step 4: Run schema tests**

Run:

```bash
pnpm --filter @motion-tool/core test packages/core/test/manifest.schema.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add packages/core/src packages/core/test packages/core/tsconfig.json
git commit -m "feat: define motion manifest schema"
```

## Task 3: Add Built-In Component Package Format And Loader

**Files:**

- Create: `motion-components/hero-text-reveal/source/index.html`
- Create: `motion-components/hero-text-reveal/source/style.css`
- Create: `motion-components/hero-text-reveal/source/script.js`
- Create: `motion-components/hero-text-reveal/motion.manifest.json`
- Create: `motion-components/hero-text-reveal/metadata.json`
- Create: `packages/core/src/library/componentLibrary.ts`
- Create: `packages/core/test/library.test.ts`

- [ ] **Step 1: Write failing loader test**

Create `packages/core/test/library.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { loadMotionComponentFromFiles } from "../src/library/componentLibrary";

describe("loadMotionComponentFromFiles", () => {
  it("loads metadata, manifest, and source files", () => {
    const component = loadMotionComponentFromFiles({
      "metadata.json": JSON.stringify({
        id: "hero-text-reveal",
        name: "Hero Text Reveal",
        category: "text",
        tags: ["hero", "text"],
        useCases: ["landing-page"],
        moods: ["subtle"]
      }),
      "motion.manifest.json": JSON.stringify({
        version: "1.0",
        id: "hero-text-reveal",
        name: "Hero Text Reveal",
        sourceKind: "builtin-component",
        runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
        params: []
      }),
      "source/index.html": "<h1>Hello</h1>",
      "source/style.css": ":root{}",
      "source/script.js": ""
    });

    expect(component.id).toBe("hero-text-reveal");
    expect(component.source.files).toHaveLength(3);
    expect(component.manifest.sourceKind).toBe("builtin-component");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @motion-tool/core test packages/core/test/library.test.ts
```

Expected: FAIL because `componentLibrary` does not exist.

- [ ] **Step 3: Implement component loader**

Create `packages/core/src/library/componentLibrary.ts`:

```ts
import { motionManifestSchema } from "../manifest/schema";
import type { MotionManifest } from "../manifest/types";

export type SourceFile = {
  path: string;
  content: string;
  kind: "html" | "css" | "js" | "json" | "asset";
};

export type MotionSource = {
  id: string;
  origin: "builtin" | "imported" | "generated";
  kind: "builtin-component" | "single-html" | "html-package" | "css-svg" | "component-lite";
  files: SourceFile[];
  entry: string;
};

export type MotionComponentMetadata = {
  id: string;
  name: string;
  category: "text" | "media" | "layout" | "interaction" | "background" | "data";
  tags: string[];
  useCases: string[];
  moods: string[];
};

export type MotionComponent = MotionComponentMetadata & {
  source: MotionSource;
  manifest: MotionManifest;
};

function fileKind(path: string): SourceFile["kind"] {
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".js")) return "js";
  if (path.endsWith(".json")) return "json";
  return "asset";
}

export function loadMotionComponentFromFiles(files: Record<string, string>): MotionComponent {
  const metadataRaw = files["metadata.json"];
  const manifestRaw = files["motion.manifest.json"];

  if (!metadataRaw) throw new Error("metadata.json is required");
  if (!manifestRaw) throw new Error("motion.manifest.json is required");

  const metadata = JSON.parse(metadataRaw) as MotionComponentMetadata;
  const manifest = motionManifestSchema.parse(JSON.parse(manifestRaw));

  const sourceFiles = Object.entries(files)
    .filter(([path]) => path.startsWith("source/"))
    .map(([path, content]) => ({ path, content, kind: fileKind(path) }));

  if (!sourceFiles.some((file) => file.path === manifest.runtime.entry)) {
    throw new Error(`Runtime entry ${manifest.runtime.entry} is missing`);
  }

  return {
    ...metadata,
    manifest,
    source: {
      id: metadata.id,
      origin: "builtin",
      kind: "builtin-component",
      files: sourceFiles,
      entry: manifest.runtime.entry
    }
  };
}
```

- [ ] **Step 4: Add first built-in component files**

Create `motion-components/hero-text-reveal/source/index.html`:

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main class="hero">
      <p data-motion="eyebrow">AI Motion Tool</p>
      <h1 data-motion="headline">Build motion faster</h1>
    </main>
    <script src="./script.js"></script>
  </body>
</html>
```

Create `motion-components/hero-text-reveal/source/style.css`:

```css
:root {
  --background-color: #0f172a;
  --text-color: #f8fafc;
  --accent-color: #38bdf8;
  --reveal-duration: 800ms;
  --reveal-distance: 18px;
}

body {
  margin: 0;
  background: var(--background-color);
  color: var(--text-color);
  font-family: Inter, system-ui, sans-serif;
}

.hero {
  display: grid;
  min-height: 100vh;
  place-content: center;
  gap: 16px;
  padding: 48px;
}

[data-motion="eyebrow"] {
  color: var(--accent-color);
  font-size: 14px;
  letter-spacing: 0;
  margin: 0;
  opacity: 0;
  transform: translateY(var(--reveal-distance));
  animation: reveal var(--reveal-duration) ease-out forwards;
}

[data-motion="headline"] {
  font-size: 72px;
  line-height: 1;
  margin: 0;
  opacity: 0;
  transform: translateY(var(--reveal-distance));
  animation: reveal var(--reveal-duration) ease-out 120ms forwards;
}

@keyframes reveal {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

Create `motion-components/hero-text-reveal/source/script.js`:

```js
window.motionReplay = function motionReplay() {
  for (const element of document.querySelectorAll("[data-motion]")) {
    element.style.animation = "none";
    element.offsetHeight;
    element.style.animation = "";
  }
};
```

Create `motion-components/hero-text-reveal/metadata.json`:

```json
{
  "id": "hero-text-reveal",
  "name": "Hero Text Reveal",
  "category": "text",
  "tags": ["hero", "text", "reveal", "saas"],
  "useCases": ["landing-page", "banner"],
  "moods": ["subtle", "premium", "clean"]
}
```

Create `motion-components/hero-text-reveal/motion.manifest.json`:

```json
{
  "version": "1.0",
  "id": "hero-text-reveal",
  "name": "Hero Text Reveal",
  "sourceKind": "builtin-component",
  "runtime": { "engine": "html", "entry": "source/index.html", "sandbox": "iframe" },
  "capabilities": ["builtin", "editable", "export-html"],
  "params": [
    {
      "id": "headline",
      "label": "Headline",
      "type": "text",
      "default": "Build motion faster",
      "status": "confirmed",
      "targets": [{ "kind": "html-text", "file": "source/index.html", "selector": "[data-motion=headline]" }]
    },
    {
      "id": "accentColor",
      "label": "Accent color",
      "type": "color",
      "default": "#38bdf8",
      "status": "confirmed",
      "targets": [
        { "kind": "css-variable", "file": "source/style.css", "selector": ":root", "name": "--accent-color" }
      ]
    },
    {
      "id": "duration",
      "label": "Reveal duration",
      "type": "duration",
      "default": 800,
      "constraints": { "min": 200, "max": 2000, "step": 50, "unit": "ms" },
      "status": "confirmed",
      "targets": [
        {
          "kind": "css-variable",
          "file": "source/style.css",
          "selector": ":root",
          "name": "--reveal-duration"
        }
      ]
    }
  ],
  "groups": [
    { "id": "content", "label": "Content", "params": ["headline"] },
    { "id": "style", "label": "Style", "params": ["accentColor"] },
    { "id": "motion", "label": "Motion", "params": ["duration"] }
  ]
}
```

- [ ] **Step 5: Run loader test**

Run:

```bash
pnpm --filter @motion-tool/core test packages/core/test/library.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add motion-components packages/core/src/library packages/core/test/library.test.ts
git commit -m "feat: add built-in motion component format"
```

## Task 4: Implement Patch Engine

**Files:**

- Create: `packages/core/src/patch/applyPatch.ts`
- Create: `packages/core/test/applyPatch.test.ts`

- [ ] **Step 1: Write failing patch tests**

Create `packages/core/test/applyPatch.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyPatchToFiles } from "../src/patch/applyPatch";
import type { MotionManifest, MotionPatch } from "../src/manifest/types";

const manifest: MotionManifest = {
  version: "1.0",
  id: "hero",
  name: "Hero",
  sourceKind: "builtin-component",
  runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
  params: [
    {
      id: "headline",
      label: "Headline",
      type: "text",
      default: "Original",
      status: "confirmed",
      targets: [{ kind: "html-text", file: "source/index.html", selector: "[data-motion=headline]" }]
    },
    {
      id: "accentColor",
      label: "Accent",
      type: "color",
      default: "#000000",
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--accent-color" }]
    }
  ]
};

describe("applyPatchToFiles", () => {
  it("updates html text and css variables", () => {
    const patch: MotionPatch = {
      id: "patch-1",
      sourceManifestId: "hero",
      values: { headline: "Updated", accentColor: "#ff3366" }
    };

    const files = applyPatchToFiles({
      files: {
        "source/index.html": '<h1 data-motion="headline">Original</h1>',
        "source/style.css": ":root { --accent-color: #000000; }"
      },
      manifest,
      patch
    });

    expect(files["source/index.html"]).toContain(">Updated<");
    expect(files["source/style.css"]).toContain("--accent-color: #ff3366");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @motion-tool/core test packages/core/test/applyPatch.test.ts
```

Expected: FAIL because `applyPatch` does not exist.

- [ ] **Step 3: Implement minimal patching**

Create `packages/core/src/patch/applyPatch.ts`:

```ts
import type { MotionManifest, MotionPatch, MotionTarget } from "../manifest/types";

type ApplyPatchInput = {
  files: Record<string, string>;
  manifest: MotionManifest;
  patch: MotionPatch;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyHtmlText(content: string, selector: string, value: unknown): string {
  const motionMatch = selector.match(/^\[data-motion=([^\]]+)\]$/);
  if (!motionMatch) return content;

  const key = motionMatch[1].replace(/^["']|["']$/g, "");
  const pattern = new RegExp(
    `(<[^>]+data-motion=["']${escapeRegExp(key)}["'][^>]*>)([\\s\\S]*?)(<\\/[^>]+>)`
  );
  return content.replace(pattern, `$1${String(value)}$3`);
}

function applyCssVariable(content: string, name: string, value: unknown): string {
  const pattern = new RegExp(`(${escapeRegExp(name)}\\s*:\\s*)[^;]+`);
  const unitValue = typeof value === "number" ? String(value) : String(value);
  return content.replace(pattern, `$1${unitValue}`);
}

function applyTarget(content: string, target: MotionTarget, value: unknown): string {
  if (target.kind === "html-text") return applyHtmlText(content, target.selector, value);
  if (target.kind === "css-variable") return applyCssVariable(content, target.name, value);
  return content;
}

export function applyPatchToFiles(input: ApplyPatchInput): Record<string, string> {
  const output = { ...input.files };

  for (const param of input.manifest.params) {
    if (!(param.id in input.patch.values)) continue;

    const value = input.patch.values[param.id];
    for (const target of param.targets) {
      const filePath = "file" in target ? target.file : undefined;
      if (!filePath || output[filePath] === undefined) continue;
      output[filePath] = applyTarget(output[filePath], target, value);
    }
  }

  return output;
}
```

- [ ] **Step 4: Run patch test**

Run:

```bash
pnpm --filter @motion-tool/core test packages/core/test/applyPatch.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add packages/core/src/patch packages/core/test/applyPatch.test.ts
git commit -m "feat: apply manifest patches to source files"
```

## Task 5: Implement Built-In Component Recommendation

**Files:**

- Create: `packages/core/src/orchestrator/recommend.ts`
- Create: `packages/core/test/recommend.test.ts`

- [ ] **Step 1: Write failing recommendation tests**

Create `packages/core/test/recommend.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { recommendComponents } from "../src/orchestrator/recommend";
import type { MotionComponent } from "../src/library/componentLibrary";

const components = [
  {
    id: "hero-text-reveal",
    name: "Hero Text Reveal",
    category: "text",
    tags: ["hero", "text", "saas"],
    useCases: ["landing-page"],
    moods: ["subtle"],
    manifest: { id: "hero-text-reveal", presets: [] }
  },
  {
    id: "magnetic-button",
    name: "Magnetic Button",
    category: "interaction",
    tags: ["button", "hover"],
    useCases: ["cta"],
    moods: ["expressive"],
    manifest: { id: "magnetic-button", presets: [] }
  }
] as unknown as MotionComponent[];

describe("recommendComponents", () => {
  it("ranks components by matching brief terms", () => {
    const results = recommendComponents({ brief: "subtle saas hero text", components, limit: 3 });

    expect(results[0].componentId).toBe("hero-text-reveal");
    expect(results[0].initialPatch.id).toBe("hero-text-reveal-initial");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @motion-tool/core test packages/core/test/recommend.test.ts
```

Expected: FAIL because `recommend` does not exist.

- [ ] **Step 3: Implement deterministic recommendation**

Create `packages/core/src/orchestrator/recommend.ts`:

```ts
import type { MotionPatch } from "../manifest/types";
import type { MotionComponent } from "../library/componentLibrary";

export type Recommendation = {
  componentId: string;
  score: number;
  reason: string;
  initialPatch: MotionPatch;
};

export function recommendComponents(input: {
  brief: string;
  components: MotionComponent[];
  limit?: number;
}): Recommendation[] {
  const terms = input.brief.toLowerCase().split(/\W+/).filter(Boolean);

  return input.components
    .map((component) => {
      const haystack = [
        component.name,
        component.category,
        ...component.tags,
        ...component.useCases,
        ...component.moods
      ]
        .join(" ")
        .toLowerCase();

      const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);

      return {
        componentId: component.id,
        score,
        reason: score > 0 ? "Matches the brief metadata." : "Included as a fallback candidate.",
        initialPatch: {
          id: `${component.id}-initial`,
          sourceManifestId: component.manifest.id,
          values: {}
        }
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, input.limit ?? 6);
}
```

- [ ] **Step 4: Run recommendation test**

Run:

```bash
pnpm --filter @motion-tool/core test packages/core/test/recommend.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add packages/core/src/orchestrator packages/core/test/recommend.test.ts
git commit -m "feat: recommend built-in motion components"
```

## Task 6: Implement Source Importer

**Files:**

- Create: `packages/core/src/import/sourceImporter.ts`
- Create: `packages/core/test/sourceImporter.test.ts`

- [ ] **Step 1: Write failing importer tests**

Create `packages/core/test/sourceImporter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { importMotionSourceFromFiles } from "../src/import/sourceImporter";

describe("importMotionSourceFromFiles", () => {
  it("detects a single html file", () => {
    const result = importMotionSourceFromFiles({
      "index.html": "<!doctype html><html><body>Hello</body></html>"
    });

    expect(result.source.kind).toBe("single-html");
    expect(result.source.entry).toBe("index.html");
    expect(result.warnings).toEqual([]);
  });

  it("detects html package with css and js", () => {
    const result = importMotionSourceFromFiles({
      "index.html": '<link rel="stylesheet" href="style.css"><script src="script.js"></script>',
      "style.css": "body{}",
      "script.js": "console.log('ok')"
    });

    expect(result.source.kind).toBe("html-package");
    expect(result.source.files).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @motion-tool/core test packages/core/test/sourceImporter.test.ts
```

Expected: FAIL because `sourceImporter` does not exist.

- [ ] **Step 3: Implement importer**

Create `packages/core/src/import/sourceImporter.ts`:

```ts
import type { MotionSource, SourceFile } from "../library/componentLibrary";

export type ImportWarning = {
  code: "missing-entry" | "unsupported-file";
  message: string;
};

export type ImportResult = {
  source: MotionSource;
  warnings: ImportWarning[];
};

function fileKind(path: string): SourceFile["kind"] {
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".js")) return "js";
  if (path.endsWith(".json")) return "json";
  return "asset";
}

export function importMotionSourceFromFiles(files: Record<string, string>): ImportResult {
  const paths = Object.keys(files);
  const htmlFiles = paths.filter((path) => path.endsWith(".html"));
  const entry = htmlFiles.includes("index.html") ? "index.html" : htmlFiles[0];
  const warnings: ImportWarning[] = [];

  if (!entry) {
    warnings.push({ code: "missing-entry", message: "No HTML entry file was found." });
  }

  const hasCssOrJs = paths.some((path) => path.endsWith(".css") || path.endsWith(".js"));
  const hasSvgOnly =
    paths.length > 0 && paths.every((path) => path.endsWith(".svg") || path.endsWith(".css"));

  const kind = hasSvgOnly ? "css-svg" : hasCssOrJs ? "html-package" : "single-html";

  return {
    warnings,
    source: {
      id: `import-${Date.now()}`,
      origin: "imported",
      kind,
      files: paths.map((path) => ({ path, content: files[path] ?? "", kind: fileKind(path) })),
      entry: entry ?? paths[0] ?? ""
    }
  };
}
```

- [ ] **Step 4: Run importer tests**

Run:

```bash
pnpm --filter @motion-tool/core test packages/core/test/sourceImporter.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add packages/core/src/import packages/core/test/sourceImporter.test.ts
git commit -m "feat: import web motion sources"
```

## Task 7: Implement Rule Scanner

**Files:**

- Create: `packages/core/src/analyze/ruleScanner.ts`
- Create: `packages/core/test/ruleScanner.test.ts`

- [ ] **Step 1: Write failing scanner tests**

Create `packages/core/test/ruleScanner.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { scanSourceForParams } from "../src/analyze/ruleScanner";
import type { MotionSource } from "../src/library/componentLibrary";

const source: MotionSource = {
  id: "import-1",
  origin: "imported",
  kind: "html-package",
  entry: "index.html",
  files: [
    { path: "index.html", kind: "html", content: '<h1 data-motion="headline">Hello</h1>' },
    { path: "style.css", kind: "css", content: ":root { --primary-color: #ff3366; --duration: 800ms; }" }
  ]
};

describe("scanSourceForParams", () => {
  it("detects css variables and data-motion text", () => {
    const params = scanSourceForParams(source);

    expect(params.map((param) => param.id)).toContain("primaryColor");
    expect(params.map((param) => param.id)).toContain("duration");
    expect(params.map((param) => param.id)).toContain("headline");
    expect(params.every((param) => param.status === "detected")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @motion-tool/core test packages/core/test/ruleScanner.test.ts
```

Expected: FAIL because `ruleScanner` does not exist.

- [ ] **Step 3: Implement scanner**

Create `packages/core/src/analyze/ruleScanner.ts`:

```ts
import type { MotionParam } from "../manifest/types";
import type { MotionSource } from "../library/componentLibrary";

function toParamId(name: string): string {
  return name.replace(/^--/, "").replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function cssVariableType(value: string): MotionParam["type"] {
  if (/^#|rgb|hsl/.test(value.trim())) return "color";
  if (/ms|s$/.test(value.trim())) return "duration";
  if (/px|rem|%|vh|vw/.test(value.trim())) return "range";
  return "text";
}

export function scanSourceForParams(source: MotionSource): MotionParam[] {
  const params: MotionParam[] = [];

  for (const file of source.files) {
    if (file.kind === "css") {
      const variablePattern = /(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
      for (const match of file.content.matchAll(variablePattern)) {
        const name = match[1];
        const value = match[2].trim();
        params.push({
          id: toParamId(name),
          label: toParamId(name),
          type: cssVariableType(value),
          default: value,
          status: "detected",
          confidence: 0.9,
          targets: [{ kind: "css-variable", file: file.path, selector: ":root", name }]
        });
      }
    }

    if (file.kind === "html") {
      const dataMotionPattern = /<([a-z0-9-]+)[^>]*data-motion=["']([^"']+)["'][^>]*>([^<]*)<\/\1>/gi;
      for (const match of file.content.matchAll(dataMotionPattern)) {
        const id = match[2];
        params.push({
          id,
          label: id,
          type: "text",
          default: match[3],
          status: "detected",
          confidence: 0.8,
          targets: [{ kind: "html-text", file: file.path, selector: `[data-motion=${id}]` }]
        });
      }
    }
  }

  return params;
}
```

- [ ] **Step 4: Run scanner tests**

Run:

```bash
pnpm --filter @motion-tool/core test packages/core/test/ruleScanner.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add packages/core/src/analyze/ruleScanner.ts packages/core/test/ruleScanner.test.ts
git commit -m "feat: scan imported motion parameters"
```

## Task 8: Implement Param Advisor And Validator

**Files:**

- Create: `packages/core/src/analyze/paramAdvisor.ts`
- Create: `packages/core/src/analyze/validator.ts`
- Create: `packages/core/test/validator.test.ts`

- [ ] **Step 1: Write failing validator tests**

Create `packages/core/test/validator.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { confirmValidParams } from "../src/analyze/validator";
import type { MotionParam } from "../src/manifest/types";
import type { MotionSource } from "../src/library/componentLibrary";

const source: MotionSource = {
  id: "source",
  origin: "imported",
  kind: "single-html",
  entry: "index.html",
  files: [{ path: "index.html", kind: "html", content: '<h1 data-motion="headline">Hello</h1>' }]
};

describe("confirmValidParams", () => {
  it("confirms params whose targets exist", () => {
    const params: MotionParam[] = [
      {
        id: "headline",
        label: "Headline",
        type: "text",
        default: "Hello",
        status: "suggested",
        targets: [{ kind: "html-text", file: "index.html", selector: "[data-motion=headline]" }]
      }
    ];

    const result = confirmValidParams({ source, params });
    expect(result.confirmed[0].status).toBe("confirmed");
    expect(result.rejected).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @motion-tool/core test packages/core/test/validator.test.ts
```

Expected: FAIL because `validator` does not exist.

- [ ] **Step 3: Implement advisor and validator**

Create `packages/core/src/analyze/paramAdvisor.ts`:

```ts
import type { MotionParam } from "../manifest/types";

export function suggestParams(detected: MotionParam[], maxParams = 10): MotionParam[] {
  return detected.slice(0, maxParams).map((param) => ({
    ...param,
    label: param.label.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase()),
    status: "suggested" as const,
    confidence: Math.min(1, param.confidence ?? 0.7)
  }));
}
```

Create `packages/core/src/analyze/validator.ts`:

```ts
import type { MotionParam } from "../manifest/types";
import type { MotionSource } from "../library/componentLibrary";

export type ValidationResult = {
  confirmed: MotionParam[];
  rejected: MotionParam[];
  warnings: string[];
};

function fileExists(source: MotionSource, path: string): boolean {
  return source.files.some((file) => file.path === path);
}

function targetExists(source: MotionSource, param: MotionParam): boolean {
  return param.targets.every((target) => {
    if (!("file" in target)) return true;
    const file = source.files.find((item) => item.path === target.file);
    if (!file) return false;

    if (target.kind === "css-variable") return file.content.includes(target.name);
    if (target.kind === "html-text") {
      const dataMotion = target.selector.match(/^\[data-motion=([^\]]+)\]$/)?.[1];
      return dataMotion
        ? file.content.includes(`data-motion="${dataMotion}"`) ||
            file.content.includes(`data-motion='${dataMotion}'`)
        : fileExists(source, target.file);
    }

    return fileExists(source, target.file);
  });
}

export function confirmValidParams(input: { source: MotionSource; params: MotionParam[] }): ValidationResult {
  const confirmed: MotionParam[] = [];
  const rejected: MotionParam[] = [];
  const warnings: string[] = [];

  for (const param of input.params) {
    if (targetExists(input.source, param)) {
      confirmed.push({ ...param, status: "confirmed" });
    } else {
      rejected.push({ ...param, status: "rejected" });
      warnings.push(`Param ${param.id} has a missing target.`);
    }
  }

  return { confirmed, rejected, warnings };
}
```

- [ ] **Step 4: Run validator tests**

Run:

```bash
pnpm --filter @motion-tool/core test packages/core/test/validator.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add packages/core/src/analyze/paramAdvisor.ts packages/core/src/analyze/validator.ts packages/core/test/validator.test.ts
git commit -m "feat: validate suggested motion params"
```

## Task 9: Implement Export Package Composer

**Files:**

- Create: `packages/core/src/export/exportPackage.ts`
- Create: `packages/core/test/exportPackage.test.ts`

- [ ] **Step 1: Write failing export tests**

Create `packages/core/test/exportPackage.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { composeEditablePackageFiles } from "../src/export/exportPackage";
import type { MotionManifest, MotionPatch } from "../src/manifest/types";

describe("composeEditablePackageFiles", () => {
  it("includes source, manifest, metadata, and patch", () => {
    const manifest: MotionManifest = {
      version: "1.0",
      id: "hero",
      name: "Hero",
      sourceKind: "builtin-component",
      runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
      params: []
    };
    const patch: MotionPatch = { id: "patch", sourceManifestId: "hero", values: {} };

    const files = composeEditablePackageFiles({
      sourceFiles: { "source/index.html": "<h1>Hello</h1>" },
      manifest,
      metadata: { id: "hero", name: "Hero" },
      patch
    });

    expect(files["motion.manifest.json"]).toContain('"id": "hero"');
    expect(files["motion.patch.json"]).toContain('"sourceManifestId": "hero"');
    expect(files["source/index.html"]).toBe("<h1>Hello</h1>");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @motion-tool/core test packages/core/test/exportPackage.test.ts
```

Expected: FAIL because `exportPackage` does not exist.

- [ ] **Step 3: Implement package composer**

Create `packages/core/src/export/exportPackage.ts`:

```ts
import type { MotionManifest, MotionPatch } from "../manifest/types";

export function composeEditablePackageFiles(input: {
  sourceFiles: Record<string, string>;
  manifest: MotionManifest;
  metadata: Record<string, unknown>;
  patch: MotionPatch;
}): Record<string, string> {
  return {
    ...input.sourceFiles,
    "motion.manifest.json": JSON.stringify(input.manifest, null, 2),
    "metadata.json": JSON.stringify(input.metadata, null, 2),
    "motion.patch.json": JSON.stringify(input.patch, null, 2)
  };
}
```

- [ ] **Step 4: Run export tests**

Run:

```bash
pnpm --filter @motion-tool/core test packages/core/test/exportPackage.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add packages/core/src/export packages/core/test/exportPackage.test.ts
git commit -m "feat: compose editable motion packages"
```

## Task 10: Build Web App Shell And Project State

**Files:**

- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/styles.css`
- Create: `apps/web/src/state/projectStore.ts`
- Create: `apps/web/tsconfig.json`

- [ ] **Step 1: Create Vite app entry**

Create `apps/web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"],
  "compilerOptions": {
    "jsx": "react-jsx",
    "noEmit": true
  }
}
```

Create `apps/web/index.html`:

```html
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Motion Tool</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `apps/web/src/main.tsx`:

```tsx
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(<App />);
```

- [ ] **Step 2: Add project state**

Create `apps/web/src/state/projectStore.ts`:

```ts
import type { MotionManifest, MotionPatch } from "@motion-tool/core";
import type { MotionSource } from "@motion-tool/core/src/library/componentLibrary";

export type MotionProject = {
  id: string;
  source: MotionSource;
  manifest: MotionManifest;
  patch: MotionPatch;
};

export function createEmptyPatch(manifest: MotionManifest): MotionPatch {
  return {
    id: `${manifest.id}-patch`,
    sourceManifestId: manifest.id,
    values: {}
  };
}
```

- [ ] **Step 3: Add shell UI**

Create `apps/web/src/App.tsx`:

```tsx
export function App() {
  return (
    <main className="app-shell">
      <aside className="sidebar">Library and import</aside>
      <section className="preview">Preview</section>
      <aside className="parameters">Parameters</aside>
      <footer className="transport">Replay Pause Viewport Export</footer>
    </main>
  );
}
```

Create `apps/web/src/styles.css`:

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Inter, system-ui, sans-serif;
  background: #f8fafc;
  color: #0f172a;
}

.app-shell {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr) 320px;
  grid-template-rows: 1fr 56px;
  min-height: 100vh;
}

.sidebar,
.parameters {
  border: 1px solid #e2e8f0;
  background: #ffffff;
  padding: 16px;
}

.preview {
  display: grid;
  place-items: center;
  min-width: 0;
  padding: 24px;
}

.transport {
  grid-column: 1 / -1;
  border-top: 1px solid #e2e8f0;
  background: #ffffff;
  padding: 12px 16px;
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
git add apps/web
git commit -m "feat: add web editor shell"
```

## Task 11: Build Parameter Panel And Preview Frame

**Files:**

- Create: `apps/web/src/features/editor/ParameterPanel.tsx`
- Create: `apps/web/src/features/editor/PreviewFrame.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Add parameter panel**

Create `apps/web/src/features/editor/ParameterPanel.tsx`:

```tsx
import type { MotionManifest, MotionPatch } from "@motion-tool/core";

type Props = {
  manifest: MotionManifest | null;
  patch: MotionPatch | null;
  onChange: (paramId: string, value: unknown) => void;
};

export function ParameterPanel({ manifest, patch, onChange }: Props) {
  if (!manifest || !patch) return <p>No component selected.</p>;

  const params = manifest.params.filter((param) => param.status === "confirmed");

  return (
    <div>
      <h2>Parameters</h2>
      {params.map((param) => {
        const value = patch.values[param.id] ?? param.default;

        if (param.type === "color") {
          return (
            <label key={param.id}>
              {param.label}
              <input
                type="color"
                value={String(value)}
                onChange={(event) => onChange(param.id, event.target.value)}
              />
            </label>
          );
        }

        if (param.type === "duration" || param.type === "range" || param.type === "number") {
          return (
            <label key={param.id}>
              {param.label}
              <input
                type="range"
                min={param.constraints?.min ?? 0}
                max={param.constraints?.max ?? 2000}
                step={param.constraints?.step ?? 1}
                value={Number(value)}
                onChange={(event) => onChange(param.id, Number(event.target.value))}
              />
            </label>
          );
        }

        return (
          <label key={param.id}>
            {param.label}
            <input value={String(value)} onChange={(event) => onChange(param.id, event.target.value)} />
          </label>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Add preview frame**

Create `apps/web/src/features/editor/PreviewFrame.tsx`:

```tsx
import { applyPatchToFiles } from "@motion-tool/core/src/patch/applyPatch";
import type { MotionManifest, MotionPatch } from "@motion-tool/core";
import type { MotionSource } from "@motion-tool/core/src/library/componentLibrary";

type Props = {
  source: MotionSource | null;
  manifest: MotionManifest | null;
  patch: MotionPatch | null;
};

export function PreviewFrame({ source, manifest, patch }: Props) {
  if (!source || !manifest || !patch) return <div>Select a motion component.</div>;

  const files = Object.fromEntries(source.files.map((file) => [file.path, file.content]));
  const patchedFiles = applyPatchToFiles({ files, manifest, patch });
  const html = patchedFiles[source.entry] ?? "";

  return <iframe title="Motion preview" sandbox="allow-scripts" srcDoc={html} className="preview-frame" />;
}
```

- [ ] **Step 3: Wire components in App**

Modify `apps/web/src/App.tsx`:

```tsx
import { useState } from "react";
import type { MotionProject } from "./state/projectStore";
import { ParameterPanel } from "./features/editor/ParameterPanel";
import { PreviewFrame } from "./features/editor/PreviewFrame";

export function App() {
  const [project, setProject] = useState<MotionProject | null>(null);

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

  return (
    <main className="app-shell">
      <aside className="sidebar">Library and import</aside>
      <section className="preview">
        <PreviewFrame
          source={project?.source ?? null}
          manifest={project?.manifest ?? null}
          patch={project?.patch ?? null}
        />
      </section>
      <aside className="parameters">
        <ParameterPanel
          manifest={project?.manifest ?? null}
          patch={project?.patch ?? null}
          onChange={updateParam}
        />
      </aside>
      <footer className="transport">Replay Pause Viewport Export</footer>
    </main>
  );
}
```

- [ ] **Step 4: Add frame styling**

Append to `apps/web/src/styles.css`:

```css
.preview-frame {
  width: min(100%, 960px);
  height: min(70vh, 680px);
  border: 1px solid #cbd5e1;
  background: #ffffff;
}

label {
  display: grid;
  gap: 6px;
  margin-bottom: 14px;
  font-size: 13px;
}
```

- [ ] **Step 5: Run web typecheck**

Run:

```bash
pnpm --filter @motion-tool/web typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/web/src
git commit -m "feat: render motion parameters and preview"
```

## Task 12: Build Library Candidate UI

**Files:**

- Create: `apps/web/src/features/brief/BriefPanel.tsx`
- Create: `apps/web/src/features/library/ComponentCandidates.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Add brief panel**

Create `apps/web/src/features/brief/BriefPanel.tsx`:

```tsx
type Props = {
  brief: string;
  onBriefChange: (brief: string) => void;
  onRecommend: () => void;
};

export function BriefPanel({ brief, onBriefChange, onRecommend }: Props) {
  return (
    <section>
      <h2>Brief</h2>
      <textarea value={brief} onChange={(event) => onBriefChange(event.target.value)} rows={5} />
      <button type="button" onClick={onRecommend}>
        Recommend
      </button>
    </section>
  );
}
```

- [ ] **Step 2: Add candidates UI**

Create `apps/web/src/features/library/ComponentCandidates.tsx`:

```tsx
import type { Recommendation } from "@motion-tool/core/src/orchestrator/recommend";

type Props = {
  recommendations: Recommendation[];
  onSelect: (componentId: string) => void;
};

export function ComponentCandidates({ recommendations, onSelect }: Props) {
  return (
    <section>
      <h2>Candidates</h2>
      {recommendations.map((item) => (
        <button key={item.componentId} type="button" onClick={() => onSelect(item.componentId)}>
          <strong>{item.componentId}</strong>
          <span>{item.reason}</span>
        </button>
      ))}
    </section>
  );
}
```

- [ ] **Step 3: Wire deterministic demo data**

Modify `apps/web/src/App.tsx` to hold a local `components` array and call `recommendComponents`. The first implementation can use the hero component object inline until filesystem-backed loading is added to the web bundler.

```tsx
import { useState } from "react";
import { recommendComponents, type Recommendation } from "@motion-tool/core/src/orchestrator/recommend";
import type { MotionProject } from "./state/projectStore";
import { createEmptyPatch } from "./state/projectStore";
import { ParameterPanel } from "./features/editor/ParameterPanel";
import { PreviewFrame } from "./features/editor/PreviewFrame";
import { BriefPanel } from "./features/brief/BriefPanel";
import { ComponentCandidates } from "./features/library/ComponentCandidates";

const demoComponent = {
  id: "hero-text-reveal",
  name: "Hero Text Reveal",
  category: "text",
  tags: ["hero", "text", "reveal", "saas"],
  useCases: ["landing-page", "banner"],
  moods: ["subtle", "premium", "clean"],
  manifest: {
    version: "1.0",
    id: "hero-text-reveal",
    name: "Hero Text Reveal",
    sourceKind: "builtin-component",
    runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
    params: []
  },
  source: {
    id: "hero-text-reveal",
    origin: "builtin",
    kind: "builtin-component",
    entry: "source/index.html",
    files: [
      {
        path: "source/index.html",
        kind: "html",
        content: '<h1 data-motion="headline">Build motion faster</h1>'
      }
    ]
  }
} as const;

export function App() {
  const [brief, setBrief] = useState("subtle saas hero text");
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [project, setProject] = useState<MotionProject | null>(null);

  function updateParam(paramId: string, value: unknown) {
    setProject((current) =>
      current
        ? { ...current, patch: { ...current.patch, values: { ...current.patch.values, [paramId]: value } } }
        : current
    );
  }

  function runRecommend() {
    setRecommendations(recommendComponents({ brief, components: [demoComponent as any] }));
  }

  function selectComponent() {
    setProject({
      id: "project-hero-text-reveal",
      source: demoComponent.source as any,
      manifest: demoComponent.manifest as any,
      patch: createEmptyPatch(demoComponent.manifest as any)
    });
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <BriefPanel brief={brief} onBriefChange={setBrief} onRecommend={runRecommend} />
        <ComponentCandidates recommendations={recommendations} onSelect={selectComponent} />
      </aside>
      <section className="preview">
        <PreviewFrame
          source={project?.source ?? null}
          manifest={project?.manifest ?? null}
          patch={project?.patch ?? null}
        />
      </section>
      <aside className="parameters">
        <ParameterPanel
          manifest={project?.manifest ?? null}
          patch={project?.patch ?? null}
          onChange={updateParam}
        />
      </aside>
      <footer className="transport">Replay Pause Viewport Export</footer>
    </main>
  );
}
```

- [ ] **Step 4: Run typecheck**

Run:

```bash
pnpm --filter @motion-tool/web typecheck
```

Expected: PASS. If TypeScript rejects the inline `as any`, replace it with explicit imported types from `@motion-tool/core` and `componentLibrary`.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/web/src
git commit -m "feat: add built-in recommendation flow"
```

## Task 13: Build Import And Confirm Params UI

**Files:**

- Create: `apps/web/src/features/import/ImportPanel.tsx`
- Create: `apps/web/src/features/import/ConfirmParamsPanel.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Add import panel**

Create `apps/web/src/features/import/ImportPanel.tsx`:

```tsx
type Props = {
  onImport: (files: Record<string, string>) => void;
};

export function ImportPanel({ onImport }: Props) {
  async function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    const entries: Record<string, string> = {};

    for (const file of Array.from(fileList)) {
      entries[file.name] = await file.text();
    }

    onImport(entries);
  }

  return (
    <section>
      <h2>Import</h2>
      <input type="file" multiple onChange={(event) => void handleFiles(event.target.files)} />
    </section>
  );
}
```

- [ ] **Step 2: Add confirmation panel**

Create `apps/web/src/features/import/ConfirmParamsPanel.tsx`:

```tsx
import type { MotionParam } from "@motion-tool/core";

type Props = {
  params: MotionParam[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onConfirm: () => void;
};

export function ConfirmParamsPanel({ params, selected, onToggle, onConfirm }: Props) {
  if (params.length === 0) return null;

  return (
    <section>
      <h2>Confirm parameters</h2>
      {params.map((param) => (
        <label key={param.id}>
          <input type="checkbox" checked={selected.has(param.id)} onChange={() => onToggle(param.id)} />
          {param.label} ({param.type})
        </label>
      ))}
      <button type="button" onClick={onConfirm}>
        Use selected parameters
      </button>
    </section>
  );
}
```

- [ ] **Step 3: Wire import flow in App**

Modify `apps/web/src/App.tsx` to call:

```ts
import { importMotionSourceFromFiles } from "@motion-tool/core/src/import/sourceImporter";
import { scanSourceForParams } from "@motion-tool/core/src/analyze/ruleScanner";
import { suggestParams } from "@motion-tool/core/src/analyze/paramAdvisor";
import { confirmValidParams } from "@motion-tool/core/src/analyze/validator";
```

Add state:

```ts
const [pendingImport, setPendingImport] = useState<MotionSource | null>(null);
const [suggestedParams, setSuggestedParams] = useState<MotionParam[]>([]);
const [selectedParamIds, setSelectedParamIds] = useState<Set<string>>(new Set());
```

Add handlers:

```ts
function importFiles(files: Record<string, string>) {
  const result = importMotionSourceFromFiles(files);
  const detected = scanSourceForParams(result.source);
  const suggested = suggestParams(detected);
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
  const manifest = {
    version: "1.0",
    id: `${pendingImport.id}-manifest`,
    name: "Imported Motion",
    sourceKind: pendingImport.kind,
    runtime: { engine: "html", entry: pendingImport.entry, sandbox: "iframe" },
    params: validation.confirmed
  } as const;

  setProject({
    id: `${pendingImport.id}-project`,
    source: pendingImport,
    manifest: manifest as any,
    patch: createEmptyPatch(manifest as any)
  });
}
```

Render `ImportPanel` and `ConfirmParamsPanel` in the sidebar.

- [ ] **Step 4: Run typecheck**

Run:

```bash
pnpm --filter @motion-tool/web typecheck
```

Expected: PASS. If the `as const` manifest narrows incorrectly, type it as `MotionManifest`.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/web/src/features/import apps/web/src/App.tsx
git commit -m "feat: add imported motion confirmation flow"
```

## Task 14: Add Export UI

**Files:**

- Create: `apps/web/src/features/export/ExportPanel.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Add export panel**

Create `apps/web/src/features/export/ExportPanel.tsx`:

```tsx
import { composeEditablePackageFiles } from "@motion-tool/core/src/export/exportPackage";
import type { MotionProject } from "../../state/projectStore";

type Props = {
  project: MotionProject | null;
};

export function ExportPanel({ project }: Props) {
  function exportJson() {
    if (!project) return;
    const sourceFiles = Object.fromEntries(project.source.files.map((file) => [file.path, file.content]));
    const files = composeEditablePackageFiles({
      sourceFiles,
      manifest: project.manifest,
      metadata: { id: project.id, sourceId: project.source.id },
      patch: project.patch
    });
    const blob = new Blob([JSON.stringify(files, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.id}.motion-package.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button type="button" disabled={!project} onClick={exportJson}>
      Export editable package
    </button>
  );
}
```

- [ ] **Step 2: Wire export panel**

Modify `apps/web/src/App.tsx` footer:

```tsx
import { ExportPanel } from "./features/export/ExportPanel";

// inside return
<footer className="transport">
  <ExportPanel project={project} />
</footer>;
```

- [ ] **Step 3: Run typecheck**

Run:

```bash
pnpm --filter @motion-tool/web typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

Run:

```bash
git add apps/web/src/features/export apps/web/src/App.tsx
git commit -m "feat: export editable motion package"
```

## Task 15: Verification And Browser Smoke Test

**Files:**

- Modify only files required by failures found during verification.

- [ ] **Step 1: Run core tests**

Run:

```bash
pnpm --filter @motion-tool/core test
```

Expected: all core tests PASS.

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

Expected: Vite build completes without errors.

- [ ] **Step 4: Start dev server**

Run:

```bash
pnpm --filter @motion-tool/web dev
```

Expected: Vite prints a localhost URL.

- [ ] **Step 5: Browser smoke test**

Open the local URL and verify:

- Brief panel accepts text.
- Recommend button produces at least one candidate.
- Selecting a candidate shows iframe preview.
- Editing a parameter updates the iframe.
- Importing a simple HTML file produces detected parameters when `data-motion` or CSS variables exist.
- Confirming imported params opens the same editor.
- Export button downloads an editable package JSON.

- [ ] **Step 6: Commit verification fixes**

Run:

```bash
git add .
git commit -m "fix: pass v0 v1 smoke verification"
```

## Development Order

1. Workspace scaffold.
2. Manifest types and schema.
3. Built-in component package format.
4. Patch engine.
5. Built-in component recommendation.
6. Source importer.
7. Rule scanner.
8. Param advisor and validator.
9. Export composer.
10. Web app shell.
11. Parameter panel and preview frame.
12. Library candidate UI.
13. Import and confirm params UI.
14. Export UI.
15. Full verification.

This order keeps the core contract testable before UI work begins.

## Self-Review

Spec coverage:

- Built-in component V0 path is covered by Tasks 3, 5, 10, 11, 12, and 14.
- External import V1 path is covered by Tasks 6, 7, 8, 11, 13, and 14.
- Motion Manifest is covered by Task 2.
- Patch model is covered by Task 4.
- Export runtime is covered by Tasks 9 and 14.
- Preview runtime is covered by Task 11 and smoke-tested in Task 15.
- Public internet search, timeline editing, complex JS rewriting, and video export remain explicit non-goals.

Placeholder scan:

- No task depends on unspecified follow-up behavior.
- Real AI provider integration is intentionally replaced by deterministic recommendation behind the same orchestrator boundary.

Type consistency:

- `MotionManifest`, `MotionPatch`, `MotionParam`, `MotionSource`, and `MotionComponent` names are consistent across tasks.
- Direct deep imports from `@motion-tool/core/src/...` are acceptable for the first internal monorepo iteration. A later cleanup can add package export maps once the module boundaries settle.
