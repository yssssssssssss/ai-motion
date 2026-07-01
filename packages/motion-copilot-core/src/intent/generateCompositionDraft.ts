import { getAppMotionPreset, type AppMotionPresetId } from "../preset/appMotionPresets";
import type { CompositionIssue, CompositionStep, CompositionTiming, MotionDocument, MotionLayer } from "../schema/document";
import { evaluateComposition } from "../composition/evaluateComposition";

export type CompositionDraftExplanation = {
  stepId: string;
  title: string;
  reason: string;
};

export type CompositionDraftCorrection = {
  title: string;
  reason: string;
};

export type CompositionDraftGeneration = {
  steps: CompositionStep[];
  summary: string;
  warnings: string[];
  explanations: CompositionDraftExplanation[];
  corrections: CompositionDraftCorrection[];
  issues: CompositionIssue[];
};

export type GenerateCompositionDraftInput = {
  prompt: string;
  document: MotionDocument;
  existingSteps?: CompositionStep[];
};

export type DraftStepSpec = {
  presetId: AppMotionPresetId;
  layer?: MotionLayer;
  timing: CompositionTiming;
  delayMs: number;
  reason: string;
};

function promptHash(prompt: string): string {
  let hash = 0;
  for (const char of prompt) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash.toString(36);
}

function layerText(layer: MotionLayer): string {
  return `${layer.name} ${layer.content?.text ?? ""}`.toLowerCase();
}

export function selectableLayers(document: MotionDocument): MotionLayer[] {
  return document.layers.filter((layer) => layer.editable && !layer.hidden && !layer.locked);
}

function findLayer(layers: MotionLayer[], pattern: RegExp): MotionLayer | undefined {
  return layers.find((layer) => pattern.test(layerText(layer)));
}

function firstLayer(layers: MotionLayer[], kind: MotionLayer["kind"]): MotionLayer | undefined {
  return layers.find((layer) => layer.kind === kind);
}

function selectedEditableLayer(document: MotionDocument, layers: MotionLayer[]): MotionLayer | undefined {
  return layers.find((layer) => layer.id === document.selectedLayerId);
}

function presetStep(document: MotionDocument, spec: DraftStepSpec, index: number, idPrefix: string): CompositionStep {
  const preset = getAppMotionPreset(spec.presetId);
  const patch = preset.apply(document);
  const layer = spec.layer;

  return {
    id: `${idPrefix}-${index}-${preset.id}`,
    presetId: preset.id,
    label: preset.label,
    target: "selected-layer",
    ...(layer ? { layerId: layer.id, layerName: layer.name } : {}),
    timing: spec.timing,
    delayMs: spec.delayMs,
    durationMs: patch.timeline?.durationMs ?? 240,
    slot: preset.slot,
    ...(patch.element?.initial ? { initial: patch.element.initial } : {}),
    ...(patch.element?.animate ? { animate: patch.element.animate } : {}),
    ...(patch.timeline?.easing ? { easing: patch.timeline.easing } : {})
  };
}

function conflictKey(step: Pick<CompositionStep, "target" | "layerId" | "slot">): string {
  return `${step.target}:${step.layerId ?? "primary"}:${step.slot}`;
}

function modalDraft(layers: MotionLayer[]): DraftStepSpec[] {
  const title = findLayer(layers, /标题|title|主文案/);
  const body = findLayer(layers, /正文|副文案|说明|body|content/);
  const image = firstLayer(layers, "image");
  const button = findLayer(layers, /主按钮|确认|立即|查看|完成|primary/) ?? findLayer(layers, /按钮|button/);
  const container = image ?? title ?? layers[0];

  return [
    ...(container
      ? [{
          presetId: "modal-feedback" as const,
          layer: container,
          timing: "sequential" as const,
          delayMs: 0,
          reason: "先让主体容器进场，建立弹层的空间焦点。"
        }]
      : []),
    ...(title && title.id !== container?.id
      ? [{
          presetId: "enter-screen" as const,
          layer: title,
          timing: "parallel" as const,
          delayMs: 80,
          reason: "标题稍后进入，让用户先感知层级，再读取信息。"
        }]
      : []),
    ...(body
      ? [{
          presetId: "enter-screen" as const,
          layer: body,
          timing: "parallel" as const,
          delayMs: 40,
          reason: "正文跟随标题错峰出现，避免信息瞬间堆叠。"
        }]
      : []),
    ...(button
      ? [{
          presetId: "like-bounce" as const,
          layer: button,
          timing: "parallel" as const,
          delayMs: 60,
          reason: "按钮最后轻弹，提示可操作区域但不抢主内容。"
        }]
      : [])
  ];
}

function loadingDraft(layers: MotionLayer[]): DraftStepSpec[] {
  const image = firstLayer(layers, "image") ?? layers[0];
  const text = firstLayer(layers, "text") ?? layers.find((layer) => layer.id !== image?.id);
  return [
    ...(image
      ? [{
          presetId: "skeleton-loading" as const,
          layer: image,
          timing: "sequential" as const,
          delayMs: 0,
          reason: "先用骨架屏保持视点稳定，避免加载期布局跳动。"
        }]
      : []),
    ...(text
      ? [{
          presetId: "loading-to-success" as const,
          layer: text,
          timing: "parallel" as const,
          delayMs: 260,
          reason: "成功态在骨架之后淡入，给用户明确完成反馈。"
        }]
      : [])
  ];
}

function switchDraft(layers: MotionLayer[]): DraftStepSpec[] {
  const selected = layers[0];
  const secondary = layers.find((layer) => layer.id !== selected?.id);
  return [
    ...(selected
      ? [{
          presetId: "move-inside" as const,
          layer: selected,
          timing: "sequential" as const,
          delayMs: 0,
          reason: "选中态先做屏幕内移动，表达位置变化而不打断结构。"
        }]
      : []),
    ...(secondary
      ? [{
          presetId: "horizontal-switch" as const,
          layer: secondary,
          timing: "parallel" as const,
          delayMs: 0,
          reason: "内容层同步横向切换，让导航和内容节奏对齐。"
        }]
      : [])
  ];
}

function buttonDraft(layers: MotionLayer[]): DraftStepSpec[] {
  const button = findLayer(layers, /按钮|button|确认|立即|查看|完成/) ?? layers[0];
  return button
    ? [{
        presetId: "like-bounce",
        layer: button,
        timing: "sequential",
        delayMs: 0,
        reason: "按钮使用短促缩放反馈，强化点击确认感。"
      }]
    : [];
}

function defaultDraft(layers: MotionLayer[]): DraftStepSpec[] {
  const layer = layers[0];
  return layer
    ? [{
        presetId: "enter-screen",
        layer,
        timing: "sequential",
        delayMs: 0,
        reason: "默认使用进入屏幕动效，先保证内容出现节奏清晰。"
      }]
    : [];
}

function specsForPrompt(prompt: string, layers: MotionLayer[]): DraftStepSpec[] {
  const text = prompt.toLowerCase();
  if (/加载|成功|loading|success|骨架/.test(text)) return loadingDraft(layers);
  if (/切换|tab|横向|导航|switch/.test(text)) return switchDraft(layers);
  if (/弹窗|弹层|面板|浮层|modal|sheet|dialog/.test(text)) return modalDraft(layers);
  if (/按钮|点击|按压|反馈|button|click/.test(text)) return buttonDraft(layers);
  return defaultDraft(layers);
}

export function generateCompositionDraft(input: GenerateCompositionDraftInput): CompositionDraftGeneration {
  const layers = selectableLayers(input.document);
  const selected = selectedEditableLayer(input.document, layers);
  const orderedLayers = selected ? [selected, ...layers.filter((layer) => layer.id !== selected.id)] : layers;
  const specs = specsForPrompt(input.prompt, orderedLayers);
  return assembleDraftFromSpecs(input, specs);
}

export function assembleDraftFromSpecs(
  input: GenerateCompositionDraftInput,
  specs: DraftStepSpec[]
): CompositionDraftGeneration {
  if (specs.length === 0) {
    return {
      steps: [],
      summary: "未生成编排片段",
      warnings: ["当前文档没有可用的可编辑图层。"],
      explanations: [],
      corrections: [],
      issues: []
    };
  }

  const idPrefix = `draft-${promptHash(input.prompt)}-${input.existingSteps?.length ?? 0}`;
  const existingKeys = new Set((input.existingSteps ?? []).map(conflictKey));
  const corrections: CompositionDraftCorrection[] = [];
  const retainedSpecs = specs.filter((spec) => {
    const preset = getAppMotionPreset(spec.presetId);
    const key = conflictKey({
      target: "selected-layer",
      ...(spec.layer ? { layerId: spec.layer.id } : {}),
      slot: preset.slot
    });
    if (!existingKeys.has(key)) return true;
    corrections.push({
      title: `已跳过「${preset.label}」`,
      reason: `${spec.layer?.name ?? "当前图层"} 已有 ${preset.slot} 槽位动效，系统跳过重复片段，避免后续片段覆盖已有编排。`
    });
    return false;
  });
  const steps = retainedSpecs.map((spec, index) => presetStep(input.document, spec, index, idPrefix));
  const issues = evaluateComposition([...(input.existingSteps ?? []), ...steps]).issues.filter((issue) =>
    steps.some((step) => step.id === issue.stepId)
  );

  return {
    steps,
    summary: steps.length > 0 ? `已生成 ${steps.length} 个结构化编排片段` : "没有新增编排片段",
    warnings: steps.length > 0 ? [] : ["当前描述命中的动效都已存在于时间轴。"],
    explanations: steps.map((step, index) => {
      const spec = retainedSpecs[index]!;
      return {
        stepId: step.id,
        title: `${step.layerName ?? "当前图层"} · ${step.label}`,
        reason: spec.reason
      };
    }),
    corrections,
    issues
  };
}
