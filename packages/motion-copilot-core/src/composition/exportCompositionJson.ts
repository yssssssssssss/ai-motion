import {
  type AppMotionPresetSlot,
  type CompositionIssue,
  type CompositionStep,
  type CompositionTrack,
  type CompositionTiming,
  type EasingSpec,
  type MotionDocument,
  type MotionLayer,
  type MotionLayerContent,
  type MotionLayerKind,
  type MotionLayerLayout,
  type MotionLayerStyle,
  type MotionState,
  type StageSpec
} from "../schema/document";
import { computeCompositionStepWindows } from "./evaluateComposition";

export type MotionCompositionBinding =
  | { type: "layer"; layerId: string; layerName: string }
  | { type: "unbound"; label: "未绑定图层"; reason: "legacy-unbound" | "missing-layer" };

export type MotionCompositionLayerExport = {
  id: string;
  name: string;
  kind: MotionLayerKind;
  editable: boolean;
  hidden: boolean;
  locked: boolean;
  parentId?: string;
  content?: MotionLayerContent;
  style?: MotionLayerStyle;
  layout?: MotionLayerLayout;
};

export type MotionCompositionLaneExport = {
  id: string;
  label: string;
  binding: MotionCompositionBinding;
  stepIds: string[];
};

export type MotionCompositionStepExport = {
  id: string;
  presetId: string;
  label: string;
  slot: AppMotionPresetSlot;
  timing: CompositionTiming;
  binding: MotionCompositionBinding;
  laneId: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  initial?: MotionState;
  animate?: MotionState;
  easing?: EasingSpec;
};

export type MotionCompositionJsonV1 = {
  schemaVersion: "motion-copilot.composition.v1";
  source: {
    app: "motion-copilot";
    documentVersion: MotionDocument["version"];
  };
  stage: StageSpec;
  layers: MotionCompositionLayerExport[];
  timeline: {
    totalDurationMs: number;
    lanes: MotionCompositionLaneExport[];
    steps: MotionCompositionStepExport[];
    issues: CompositionIssue[];
  };
};

function exportLayer(layer: MotionLayer): MotionCompositionLayerExport {
  return {
    id: layer.id,
    name: layer.name,
    kind: layer.kind,
    editable: layer.editable,
    hidden: Boolean(layer.hidden),
    locked: Boolean(layer.locked),
    ...(layer.parentId ? { parentId: layer.parentId } : {}),
    ...(layer.content ? { content: layer.content } : {}),
    ...(layer.style ? { style: layer.style } : {}),
    ...(layer.layout ? { layout: layer.layout } : {})
  };
}

function stepBinding(document: MotionDocument, step: CompositionStep): MotionCompositionBinding {
  if (!step.layerId) {
    const reason = step.target === "selected-layer" ? "missing-layer" : "legacy-unbound";
    return { type: "unbound", label: "未绑定图层", reason };
  }
  const layer = document.layers.find((item) => item.id === step.layerId);
  if (!layer) return { type: "unbound", label: "未绑定图层", reason: "missing-layer" };
  return { type: "layer", layerId: layer.id, layerName: step.layerName ?? layer.name };
}

function laneIdForBinding(binding: MotionCompositionBinding): string {
  return binding.type === "layer" ? `layer:${binding.layerId}` : `unbound:${binding.reason}`;
}

function laneLabelForBinding(binding: MotionCompositionBinding): string {
  return binding.type === "layer" ? binding.layerName : binding.label;
}

export function createCompositionJsonExport(
  document: MotionDocument,
  track: CompositionTrack
): MotionCompositionJsonV1 {
  const windows = new Map(computeCompositionStepWindows(track.steps).map((window) => [window.stepId, window]));
  const lanes = new Map<string, MotionCompositionLaneExport>();

  const steps = track.steps.map((step) => {
    const binding = stepBinding(document, step);
    const laneId = laneIdForBinding(binding);
    const window = windows.get(step.id) ?? { stepId: step.id, start: 0, end: step.durationMs };

    const lane = lanes.get(laneId);
    if (lane) {
      lane.stepIds.push(step.id);
    } else {
      lanes.set(laneId, {
        id: laneId,
        label: laneLabelForBinding(binding),
        binding,
        stepIds: [step.id]
      });
    }

    return {
      id: step.id,
      presetId: step.presetId,
      label: step.label,
      slot: step.slot,
      timing: step.timing,
      binding,
      laneId,
      startMs: window.start,
      endMs: window.end,
      durationMs: step.durationMs,
      ...(step.initial ? { initial: step.initial } : {}),
      ...(step.animate ? { animate: step.animate } : {}),
      ...(step.easing ? { easing: step.easing } : {})
    };
  });

  return {
    schemaVersion: "motion-copilot.composition.v1",
    source: {
      app: "motion-copilot",
      documentVersion: document.version
    },
    stage: document.stage,
    layers: document.layers.map(exportLayer),
    timeline: {
      totalDurationMs: track.totalDurationMs,
      lanes: Array.from(lanes.values()),
      steps,
      issues: track.issues
    }
  };
}

export function exportCompositionJson(document: MotionDocument, track: CompositionTrack): string {
  return JSON.stringify(createCompositionJsonExport(document, track), null, 2);
}
