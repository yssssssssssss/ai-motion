# LLM Brief Recommendation And Component Feed Design

Date: 2026-05-18
Scope: Discovery home, LLM brief parsing, component feed, editor navigation

## Goal

Improve component discovery so users can either describe what they need in natural language or browse the available motion component library directly.

The home page becomes a discovery surface. It should not expose the parameter editor. Selecting a component from AI recommendations or the component feed opens a dedicated editor page where preview, parameters, replay, viewport controls, and export live.

## Decisions

- Use a lightweight backend endpoint for LLM brief parsing.
- Keep the OpenAI API key on the server side only.
- LLM output is structured intent, not final product logic.
- Component ranking remains deterministic and testable in `@motion-tool/core`.
- If LLM parsing fails, recommendations fall back to local rule matching.
- Home page uses a single-column top-to-bottom layout.
- AI recommendation results appear only after the user submits a brief.
- Component feed is always visible and is the primary home page content.
- Component editing happens on a separate editor view.

## User Experience

Home page order:

```text
Brief input
AI Recommend button
LLM parse status and parsed chips
AI Recommended results, only after submission
Browse component feed
```

The `AI Recommend` button sits directly below the brief input. Parse status chips such as `LLM parsed`, `local fallback ready`, `button`, `hover`, `WorkEasy`, and `tech` appear below the button.

Recommended results appear below the button/status area after submission. They are a compact result strip, not a fixed home page summary. The feed remains visible below and highlights AI-matched components when applicable.

Selecting any recommendation or feed item navigates to the editor view.

Editor page:

```text
Selected component preview
Parameter Inspector
Replay / viewport / export controls
```

## Brief Parsing

Add a structured brief intent model in core:

```ts
type ParsedBriefIntent = {
  query: string;
  categories: string[];
  componentKinds: string[];
  motionStyles: string[];
  sources: string[];
  keywords: string[];
  confidence: number;
};
```

The server endpoint parses the user brief into this shape using OpenAI Responses API structured output. The prompt should be narrow: extract component-discovery intent only. It must not generate code, mutate files, or choose a component by itself.

The parser response includes enough UI metadata for status display:

- `mode: "llm" | "fallback"`
- `intent`
- `message`

## Recommendation Flow

Recommendation should support two paths:

1. LLM path
   - Frontend posts brief to `/api/brief/parse`.
   - Backend returns `ParsedBriefIntent`.
   - Frontend calls core recommendation with the parsed intent.
   - UI displays `LLM parsed` and intent chips.

2. Fallback path
   - Used when no API key exists, endpoint fails, or model output is invalid.
   - Frontend uses the existing local tokenizer-based recommendation.
   - UI displays `local fallback ready` or equivalent state.

Final component scoring stays in core. The LLM only improves query understanding.

## Feed Behavior

The component feed is always present below discovery. It shows all loaded components and supports simple filters:

- All
- WorkEasy
- Native
- Buttons
- Cards
- Checkboxes

Each feed card shows:

- Visual preview tile
- Component name
- Source badge
- Category or kind
- Editable parameter count
- AI match badge when it appears in current recommendations

Clicking a card opens the editor page for that component.

## Data And Routing

The current single-screen app should be split into two views:

- `home`: discovery input, recommendation strip, component feed
- `editor`: selected component preview, parameter panel, export controls

This can be implemented with internal React state first instead of adding a router dependency. A selected component id is enough to switch views. Browser URL routing can wait.

## Error Handling

- Missing `OPENAI_API_KEY`: use fallback matching.
- LLM request failure: use fallback matching and show a non-blocking status.
- Invalid structured response: reject it, use fallback, and keep the page usable.
- Empty brief: skip LLM request and show feed only.
- No matches: show an empty recommended state while keeping feed visible.

## Testing

Core tests:

- Parsed intent scoring ranks matching WorkEasy components above unrelated components.
- Fallback matching still works.
- Empty or partial intent does not crash recommendation.

Web tests or smoke checks:

- Brief submission shows status chips and recommendation results.
- Recommendation cards open editor view.
- Feed cards open editor view without brief submission.
- Editor page shows preview and parameter inspector.
- Export still works from editor view.

## Out Of Scope

- Full URL routing.
- User accounts or saved sessions.
- Multi-turn chat.
- LLM-generated component code.
- LLM direct mutation of component source.
- Importing additional WorkEasy categories.
