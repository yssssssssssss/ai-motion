# Reference-Guided Code Generation Design

Date: 2026-06-03
Scope: Natural semantic generation, reference component retrieval, generated source validation

## Goal

Turn "自然语义生成" from a search-like controlled patch flow into a real generation flow. Retrieved components become reference examples, not the final base component. The generator creates a new component source package from the user's semantic brief and validates it before opening the editor.

## Decisions

- Keep "智能推荐" as search.
- Keep the existing controlled patch route as a bounded remix path.
- Add a separate reference-guided generation path for "自然语义生成".
- Parse the brief into a structured intent before generation.
- Use Top 3 hydrated components only as reference code and ranking context.
- Generate new `source/index.html`, `source/style.css`, `source/script.js`, and `motion.manifest.json`.
- When OpenAI generation is configured, request only an HTML/CSS/JS source draft; the core still owns manifest creation, validation, and fallback.
- Do not let generated source call network APIs, access cookies, or use eval-like code.
- Reject outputs that do not satisfy required semantic facets such as role, color, effect, and direction.

## Generation Flow

```text
brief
  -> parseSemanticGenerationIntent()
  -> load Top 3 reference components
  -> optionally generate HTML/CSS/JS source draft with OpenAI
  -> createReferenceGuidedComponent()
  -> validate generated source and manifest targets
  -> fall back to deterministic source if draft fails
  -> open generated editor draft
```

The current controlled patch flow changes existing manifest parameters. The new reference-guided flow writes a fresh component from semantic intent and reference code patterns.

## Intent Model

The first version supports the common product language users already use:

- Roles: button, card, text
- Colors: red, blue, purple, green, orange, yellow, black, white, gray
- Effects: bounce, elastic, slide, scale, glow, fade, rotate
- Directions: left-to-right, right-to-left, top-to-bottom, bottom-to-top
- Triggers: load, hover, click, loop
- Text: quoted text or labeled text when present
- Speed: fast, normal, slow

Unknown words stay in `raw` and `softPreferences`; they should help reference selection but must not silently become unsafe code.

## Generated Component Contract

Every generated component must include:

- `data-motion-root`
- A renderable HTML entry
- CSS variables for editable values
- `window.motionReplay`, `window.motionPause`, and `window.motionSeek`
- Confirmed manifest params with targets that exist in generated source
- At least one replaceable text or structure layer
- `editable` and `export-html` capabilities

For the example brief "创建一个按钮颜色为红色，带有弹动效果，从屏幕左侧移动到右侧", the generated result must be a red button with left-to-right travel and bounce/elastic motion. A checkbox menu or no-op opacity change is invalid.

## Safety

Generated source is only allowed to contain local HTML, CSS, and small replay JS. Model-generated drafts have a bounded timeout and must pass the same gates as deterministic source. The validation layer rejects:

- `fetch`
- `XMLHttpRequest`
- `document.cookie`
- `eval`
- `new Function`
- external scripts
- missing manifest targets
- no-op outputs
- semantic coverage gaps

## Testing

Core tests cover:

- intent parsing for color, role, effect, direction, and trigger
- generated component source content
- manifest target validity
- semantic coverage checks
- unsafe source rejection

Web tests cover:

- route response for a reference-guided generation request
- valid OpenAI source draft adoption
- unsafe or timed-out OpenAI source draft fallback
- frontend client error handling
- Home route wiring uses the reference-guided route for generation mode

## Out Of Scope

- Full freeform LLM code generation without a validator
- Model-generated manifest mutation
- Multi-turn chat
- User accounts
- External asset fetching
- Complex timeline editors
- Multi-reference code merging beyond using reference metadata and source as context
