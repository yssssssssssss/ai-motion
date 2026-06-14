# MotionLens P0 Execution Brief

Date: 2026-06-11
Status: Ready for implementation planning
Module name: MotionLens
Primary user mode: Designer review

## Confirmed Direction

MotionLens is a new module derived from the existing Motion Copilot implementation, but it must remain separate from the current `motion-copilot` module.

P0 focuses on designer review:

```text
static design draft
-> visual annotation
-> opportunity rationale
-> recommended motion parameters
```

Code generation and experiment analytics are secondary. The first useful product is a motion review surface that helps designers decide where motion belongs and why.

## Input Constraint

No concrete user-provided design drafts are available for P0.

Therefore P0 must use synthetic and curated fixture drafts to cover representative page archetypes. The goal is not to cover every possible draft. That is impossible and would lead to vague, low-value recommendations.

The correct goal is to cover the main motion decision situations that commonly appear across product UI.

## Fixture Coverage Matrix

### Commerce

- Product detail page
- Campaign landing page
- Checkout confirmation page
- Coupon or promotion modal

Expected opportunities:

- Primary CTA attention
- Product image/card transition
- Coupon popup entry/exit
- Purchase success feedback
- Trust-preserving payment confirmation

### AI Product

- Prompt input page
- AI result page
- Streaming generation page
- Empty/error result page

Expected opportunities:

- Result progressive reveal
- Loading/progress feedback
- Important answer highlight
- Error recovery feedback
- Input submit confirmation

### SaaS / Dashboard

- Dense KPI dashboard
- Data table page
- Settings page
- Onboarding checklist

Expected opportunities:

- Sequential reveal for dense modules
- Row/action feedback
- Saved state confirmation
- Onboarding progress guidance
- Avoidance of decorative motion in dense operational surfaces

### Form / Workflow

- Login/signup form
- Multi-step form
- Upload flow
- Submit success/error page

Expected opportunities:

- Field validation feedback
- Step transition
- Upload progress
- Submit success confirmation
- Error motion with strict restraint

### Modal / Overlay

- Confirmation dialog
- Delete warning
- Subscription upsell
- Permission request

Expected opportunities:

- Stable modal transition
- Trust-preserving easing
- Destructive action warning
- Secondary CTA de-emphasis
- Clear close/dismiss feedback

### Content / Marketing

- Hero section
- Feature cards
- Testimonial section
- Pricing page

Expected opportunities:

- One-shot hero reveal
- Feature card stagger
- Pricing CTA attention
- Trust signal emphasis
- Avoidance of repeated decorative motion

## P0 Recommendation Rules

MotionLens should recommend 3 to 5 opportunities per draft by default.

Priority:

- `P0`: directly supports the stated business/design goal.
- `P1`: improves comprehension or confidence with manageable risk.
- `P2`: optional enhancement; hidden behind expansion if possible.

If too many candidates are found, prefer:

1. Primary action.
2. Feedback/status area.
3. High-density content group.
4. Risk/trust moment.
5. Onboarding/progress moment.

Do not recommend motion for every visual section.

## Output Requirements

For each opportunity, show:

- Visual annotation on the draft.
- Element label.
- Priority.
- User decision friction.
- Motion strategy.
- Pattern name.
- Rationale.
- Recommended parameters.
- Risks.

Example:

```text
P0 · 主 CTA 点击反馈
阻力: Attention + Confidence
策略: Attention Motion
模式: button-press-success
参数: scale 1 -> 0.94 -> 1, 160ms, spring, repeat none
风险: 不要使用循环呼吸；点击反馈必须短于 200ms
```

## First Implementation Assumption

Since no real design drafts are available, implementation should start with fixture-backed analysis:

```text
fixture draft metadata
-> detected elements fixture
-> deterministic opportunity pipeline
-> overlay UI
-> opportunity detail
-> recommended params
```

Only after this designer-review loop is useful should real vision-model analysis be added.

## Name

Use `MotionLens` as the product/module name unless renamed later.

Recommended engineering names:

```text
apps/motion-lens
packages/motion-lens-core
```

## P0 Done Definition

- MotionLens runs as a separate module from Motion Copilot.
- At least 6 fixture page archetypes are represented.
- Each fixture has deterministic opportunities.
- The UI shows annotations, rationale, and recommended parameters.
- Designer review is useful without code export.
- Existing Motion Copilot remains untouched.
