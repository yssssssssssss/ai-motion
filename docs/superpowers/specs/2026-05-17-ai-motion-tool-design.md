# AI Motion Tool Design

Date: 2026-05-17
Scope: V0 + V1

## Product Goal

Build an AI-assisted motion tool that helps users choose, edit, preview, and export web-oriented motion assets.

The first release focuses on two validated workflows:

1. Start from built-in, high-quality motion components.
2. Import an existing web motion asset and convert safe, identifiable parts into editable parameters.

The product should not promise that arbitrary code can be perfectly understood or edited. Any motion source can be loaded and previewed when technically possible, but only declared, detected, validated, or user-confirmed parameters become stable editing controls.

## Core Positioning

The system is centered on `Motion Manifest`, not on raw AI code generation.

AI helps select components, propose initial parameter values, and organize detected parameters. It does not directly modify source files, bypass validation, or become the source of truth for editable parameters.

## Primary Architecture

```text
Natural Language Brief
        |
        v
AI Orchestrator
        |
        +--------------------+
        |                    |
Built-in Motion Library   Imported Motion Sources
        |                    |
        +---------> Motion Source Normalizer
                          |
                          v
                   Motion Manifest
                          |
              +-----------+-----------+
              |                       |
       Parameter Editor        Preview Runtime
              |                       |
              +-------> Patch Engine <-+
                          |
                          v
                    Export Runtime
```

## V0 Workflow: Built-In Motion Components

V0 proves the main product loop:

```text
User brief
-> AI recommends 3-6 built-in motion components
-> User chooses a component
-> System applies an initial patch
-> User edits parameters
-> Sandbox preview updates
-> User exports a runnable package
```

Built-in components are the golden path. They ship with confirmed parameters and do not require parameter guessing.

Each component package contains:

```text
motion-component/
  source/
    index.html
    style.css
    script.js
  motion.manifest.json
  metadata.json
  preview.png
  optional preview recording
```

Initial component set should stay small, roughly 10-12 components:

- Hero text reveal
- Blur text reveal
- Staggered card enter
- Image mask wipe
- Logo marquee
- Magnetic button hover
- Count up metric
- Progress ring
- Section fade-slide
- Cursor-follow glow
- Grid scan background
- Product mockup float

## V1 Workflow: Imported Motion Assets

V1 adds the external import path:

```text
User imports asset
-> Source Importer builds a normalized source
-> Sandbox previews it
-> Rule Scanner detects low-risk editable values
-> AI Param Advisor suggests naming, grouping, and consolidation
-> Validator checks targets and runtime behavior
-> User confirms which parameters to expose
-> Editor uses the same Motion Manifest flow
-> User exports
```

Supported V1 import types:

- Single HTML file
- Small HTML/CSS/JS package
- SVG/CSS motion asset
- Lite component import when metadata or simple props are available

V1 does not include public internet search for motion assets. External import means bring-your-own-motion: uploaded files, team assets, internal repositories, or explicitly provided sources.

## Motion Manifest

`Motion Manifest` describes what users can edit and how those controls map to the source. It is not a full AST or a general animation DSL.

```ts
type MotionManifest = {
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

Supported source kinds for V0+V1:

```ts
type SourceKind =
  | "builtin-component"
  | "single-html"
  | "html-package"
  | "css-svg"
  | "component-lite";
```

Runtime should default to HTML in V0+V1:

```ts
type MotionRuntime = {
  engine: "html";
  entry: string;
  sandbox: "iframe";
  dependencies?: RuntimeDependency[];
};
```

Parameter model:

```ts
type MotionParam = {
  id: string;
  label: string;
  description?: string;
  type: MotionParamType;
  default: unknown;
  value?: unknown;
  status: "detected" | "suggested" | "confirmed" | "rejected";
  confidence?: number;
  constraints?: MotionParamConstraints;
  targets: MotionTarget[];
  ui?: MotionParamUI;
};
```

V0+V1 parameter types:

```ts
type MotionParamType =
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
```

Parameter status rules:

- `detected`: Found by deterministic scanning.
- `suggested`: AI proposes exposing or grouping it.
- `confirmed`: Safe, validated, and visible in the editor.
- `rejected`: Known but intentionally hidden.

Built-in components ship with `confirmed` parameters. Imported assets move from `detected` or `suggested` to `confirmed` only after validation and user confirmation.

## Target Model

Targets describe where a parameter is applied:

```ts
type MotionTarget =
  | CssVariableTarget
  | CssPropertyTarget
  | HtmlTextTarget
  | HtmlAttributeTarget
  | SvgAttributeTarget
  | JsConfigTarget
  | ComponentPropTarget;
```

V0+V1 should strongly prefer:

- CSS variables
- CSS properties
- HTML text
- HTML attributes
- SVG attributes
- Explicit JS config objects
- Declared component props

Arbitrary JavaScript semantic rewriting is out of scope.

## AI Responsibilities

AI Orchestrator handles:

- Component recommendation from a natural language brief.
- Initial parameter patch selection.
- Variant generation, such as subtle, balanced, and expressive.
- Naming and grouping suggestions for imported detected parameters.
- Consolidating multiple low-level detected values into higher-level suggested controls.

AI must not:

- Directly edit source files.
- Create confirmed parameters without validation.
- Fetch arbitrary internet assets by default.
- Rewrite arbitrary JavaScript.
- Bypass `Motion Manifest`.

## Analyzer Pipeline

Imported assets use this pipeline:

```text
Manual Schema Reader
-> Rule Scanner
-> AI Param Advisor
-> Validator
-> User Confirmation
-> Manifest Builder
```

Manual schema sources:

- `motion.manifest.json`
- `motion.schema.json`
- CSS annotations
- Component metadata

Rule scanner detects:

- CSS variables
- Colors
- Transition and animation durations
- Transition and animation delays
- Easing values
- Transform values
- HTML text nodes with stable selectors
- Image and video sources
- SVG fill, stroke, opacity, and transform attributes

Validator checks:

- Target existence
- Type compatibility
- Constraint sanity
- Sandbox runtime errors
- Whether applying a patch changes DOM, computed styles, or rendered output

## Editor Runtime

The editor uses the same UI for built-in and imported assets.

Recommended layout:

```text
Left: library, import, candidates, variants
Center: sandbox preview
Right: grouped parameter controls
Bottom: replay, pause, viewport, speed, export
```

Required controls:

- Color picker
- Text input
- Slider plus numeric input
- Duration input
- Easing selector
- Asset picker
- Toggle
- Select or segmented control
- Position control

Required preview features:

- iframe sandbox
- Replay
- Pause and resume
- Desktop and mobile viewport switching
- Background mode switching
- Error overlay
- Parameter patch injection

## Patch Model

Edits are stored as patches, not immediate source mutations.

```ts
type MotionPatch = {
  id: string;
  sourceManifestId: string;
  values: Record<string, unknown>;
};
```

This keeps undo, variants, AI suggestions, and export composition simple.

## Export Runtime

V0+V1 export formats:

- Runnable HTML package
- Embeddable snippet
- Editable motion package containing source, manifest, metadata, and patch

Out of scope for V0+V1 export:

- MP4, GIF, or WebM export
- React/Vue/Svelte package export
- npm package publishing

## Explicit Non-Goals

V0+V1 will not include:

- Public internet search for motion assets
- Full timeline editor
- Layer tree editor
- Complex keyframe editor
- Full React/Vue/Svelte build support
- Arbitrary JavaScript semantic understanding
- AI-generated complex motion components entering the library automatically
- Figma or After Effects bidirectional sync
- Multi-user collaboration
- Marketplace or plugin ecosystem

These may be considered after the core loop is reliable.

## Success Criteria

The MVP is successful when:

- A user can get 3 credible built-in component recommendations within 30 seconds.
- A user can adjust a selected component into a usable variant within 2 minutes.
- Parameter changes reliably update the preview.
- Exported HTML packages run independently.
- Imported assets can be previewed even when parameter extraction is partial.
- Failed parameter extraction provides a clear fallback instead of blocking the user.

## Open Questions

- Which user group comes first: designers, frontend developers, marketers, or internal product teams?
- Should V0 include design system tokens, or only leave the integration point ready?
- What is the minimum acceptable export format for the first real users?
- Should imported assets require explicit user confirmation before any AI analysis is sent to a model?
- Which runtime libraries are allowed inside built-in components: CSS-only, Web Animations API, GSAP, or a restricted subset?
