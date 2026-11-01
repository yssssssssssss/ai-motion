import { describe, expect, it } from "vitest";
import { createDefaultDocument, generateCompositionDraft } from "@motion-copilot/core";
import { createProjectState, projectReducer, type ProjectAction } from "./projectState";

const document = createDefaultDocument("modal");
const draft = generateCompositionDraft({ document, prompt: "标题淡入" });
const initial = () => createProjectState({ document });

describe("projectReducer", () => {
  it("starts blank and restores the same project fields as the workspace", () => {
    expect(initial()).toEqual({
      document,
      steps: [],
      selectedStepId: undefined,
      hasStarted: false,
      lastDraftGeneration: undefined,
      epoch: 0
    });
    const restored = createProjectState({ document, steps: draft.steps, hasStarted: true });
    expect(restored.steps).toEqual(draft.steps);
    expect(restored.hasStarted).toBe(true);
    expect(restored.selectedStepId).toBeUndefined();
    expect(restored.lastDraftGeneration).toBeUndefined();
  });

  const cases: Array<[ProjectAction["type"], keyof ReturnType<typeof initial>, unknown, unknown]> = [
    ["setMotionDocument", "document", createDefaultDocument("button"), document],
    ["setCompositionSteps", "steps", draft.steps, []],
    ["setSelectedCompositionStepId", "selectedStepId", "chosen", undefined],
    ["setHasStarted", "hasStarted", true, false],
    ["setLastDraftGeneration", "lastDraftGeneration", draft, undefined]
  ];
  it.each(cases)("%s accepts a value and sequential functional updates", (type, field, value, before) => {
    const state = initial();
    const next = projectReducer(state, { type, value } as ProjectAction);
    expect(next[field]).toEqual(value);
    expect(next.epoch).toBe(0);
    expect(state[field]).toEqual(before);
    const seen: unknown[] = [];
    const updater = (current: unknown) => {
      seen.push(current);
      return before;
    };
    const updated = projectReducer(next, { type, value: updater } as ProjectAction);
    expect(seen).toEqual([value]);
    expect(updated[field]).toEqual(before);
    expect(projectReducer(updated, { type, value: (current: unknown) => current } as ProjectAction)).toEqual(
      updated
    );
  });

  it("replaces the whole project and increments the epoch, including functional replacements", () => {
    const replacement = {
      ...initial(),
      document: createDefaultDocument("button"),
      steps: draft.steps,
      selectedStepId: "loaded",
      hasStarted: true,
      lastDraftGeneration: draft
    };
    const next = projectReducer(initial(), { type: "replaceProject", value: replacement });
    expect(next).toEqual({ ...replacement, epoch: 1 });
    const cleared = projectReducer(next, {
      type: "replaceProject",
      value: (current) => ({
        ...current,
        steps: [],
        selectedStepId: undefined,
        lastDraftGeneration: undefined
      })
    });
    expect(cleared.epoch).toBe(2);
    expect(cleared.document).toBe(next.document);
    expect(cleared.steps).toEqual([]);
    expect(cleared.selectedStepId).toBeUndefined();
    expect(cleared.lastDraftGeneration).toBeUndefined();
  });

  it("appends a current draft, selects it and records its generation", () => {
    const state = { ...initial(), steps: [draft.steps[0]!], selectedStepId: "old" };
    const next = projectReducer(state, {
      type: "applyDraft",
      epoch: 0,
      draft,
      document: (current) => ({ ...current, stage: { ...current.stage, background: "#123456" } })
    });
    expect(next.steps).toEqual([...state.steps, ...draft.steps]);
    expect(next.selectedStepId).toBe(draft.steps[0]!.id);
    expect(next.lastDraftGeneration).toBe(draft);
    expect(next.hasStarted).toBe(true);
    expect(next.document.stage.background).toBe("#123456");
    expect(next.epoch).toBe(0);
  });

  it("keeps the current selection when a current draft has no steps", () => {
    const state = { ...initial(), selectedStepId: "keep" };
    expect(
      projectReducer(state, { type: "applyDraft", epoch: 0, draft: { ...draft, steps: [] } }).selectedStepId
    ).toBe("keep");
  });

  it("ignores stale drafts without invoking their document updater", () => {
    const state = {
      ...initial(),
      epoch: 3,
      steps: draft.steps,
      selectedStepId: "loaded",
      lastDraftGeneration: draft
    };
    expect(
      projectReducer(state, {
        type: "applyDraft",
        epoch: 2,
        draft,
        document: () => {
          throw new Error("stale updater ran");
        }
      })
    ).toBe(state);
  });
});
