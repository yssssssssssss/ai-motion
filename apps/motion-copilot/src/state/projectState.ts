import { useCallback, useReducer, type SetStateAction } from "react";
import type { CompositionDraftGeneration, CompositionStep, MotionDocument } from "@motion-copilot/core";

export type ProjectState = {
  document: MotionDocument;
  steps: CompositionStep[];
  selectedStepId: string | undefined;
  hasStarted: boolean;
  lastDraftGeneration: CompositionDraftGeneration | undefined;
  epoch: number;
};

type ProjectSnapshot = Omit<ProjectState, "epoch">;
type SetterValues = {
  setMotionDocument: MotionDocument;
  setCompositionSteps: CompositionStep[];
  setSelectedCompositionStepId: string | undefined;
  setHasStarted: boolean;
  setLastDraftGeneration: CompositionDraftGeneration | undefined;
};
type SetterAction = {
  [K in keyof SetterValues]: { type: K; value: SetStateAction<SetterValues[K]> };
}[keyof SetterValues];
type ApplyDraft = {
  type: "applyDraft";
  epoch: number;
  draft: CompositionDraftGeneration;
  document?: SetStateAction<MotionDocument>;
};
export type ProjectAction =
  | SetterAction
  | { type: "replaceProject"; value: SetStateAction<ProjectSnapshot> }
  | ApplyDraft;

export function createProjectState(input: {
  document: MotionDocument;
  steps?: CompositionStep[] | undefined;
  hasStarted?: boolean | undefined;
}): ProjectState {
  return {
    document: input.document,
    steps: input.steps ?? input.document.composition?.steps ?? [],
    selectedStepId: undefined,
    hasStarted: input.hasStarted ?? false,
    lastDraftGeneration: undefined,
    epoch: 0
  };
}

function resolveValue<T>(value: SetStateAction<T>, current: T): T {
  return typeof value === "function" ? (value as (previous: T) => T)(current) : value;
}

export function projectReducer(state: ProjectState, action: ProjectAction): ProjectState {
  switch (action.type) {
    case "setMotionDocument":
      return { ...state, document: resolveValue(action.value, state.document) };
    case "setCompositionSteps":
      return { ...state, steps: resolveValue(action.value, state.steps) };
    case "setSelectedCompositionStepId":
      return { ...state, selectedStepId: resolveValue(action.value, state.selectedStepId) };
    case "setHasStarted":
      return { ...state, hasStarted: resolveValue(action.value, state.hasStarted) };
    case "setLastDraftGeneration":
      return { ...state, lastDraftGeneration: resolveValue(action.value, state.lastDraftGeneration) };
    case "replaceProject":
      return { ...resolveValue(action.value, state), epoch: state.epoch + 1 };
    case "applyDraft":
      if (action.epoch !== state.epoch) return state;
      return {
        ...state,
        document: action.document ? resolveValue(action.document, state.document) : state.document,
        steps: [...state.steps, ...action.draft.steps],
        selectedStepId: action.draft.steps[0]?.id ?? state.selectedStepId,
        hasStarted: true,
        lastDraftGeneration: action.draft
      };
  }
}

export function useProjectState(initialState: () => ProjectState) {
  const [state, dispatch] = useReducer(projectReducer, undefined, initialState);
  const setMotionDocument = useCallback((value: SetStateAction<MotionDocument>) => {
    dispatch({ type: "setMotionDocument", value });
  }, []);
  const setCompositionSteps = useCallback((value: SetStateAction<CompositionStep[]>) => {
    dispatch({ type: "setCompositionSteps", value });
  }, []);
  const setSelectedCompositionStepId = useCallback((value: SetStateAction<string | undefined>) => {
    dispatch({ type: "setSelectedCompositionStepId", value });
  }, []);
  const setHasStarted = useCallback((value: SetStateAction<boolean>) => {
    dispatch({ type: "setHasStarted", value });
  }, []);
  const setLastDraftGeneration = useCallback(
    (value: SetStateAction<CompositionDraftGeneration | undefined>) => {
      dispatch({ type: "setLastDraftGeneration", value });
    },
    []
  );
  const replaceProject = useCallback((value: SetStateAction<ProjectSnapshot>) => {
    dispatch({ type: "replaceProject", value });
  }, []);
  const applyDraft = useCallback((action: Omit<ApplyDraft, "type">) => {
    dispatch({ ...action, type: "applyDraft" });
  }, []);
  return {
    ...state,
    setMotionDocument,
    setCompositionSteps,
    setSelectedCompositionStepId,
    setHasStarted,
    setLastDraftGeneration,
    replaceProject,
    applyDraft
  };
}
