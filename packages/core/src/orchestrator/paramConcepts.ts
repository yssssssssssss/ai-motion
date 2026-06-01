import type { MotionParam } from "../manifest/types";

export type ParamConceptId = "speed" | "easing" | "intensity" | "trajectory" | "rhythm" | "layer";

export type ParamConcept = {
  id: ParamConceptId;
  label: string;
};

const CONCEPT_LABELS: Record<ParamConceptId, string> = {
  speed: "速度",
  easing: "缓动",
  intensity: "强度",
  trajectory: "轨迹",
  rhythm: "节奏",
  layer: "图层"
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function paramText(param: Pick<MotionParam, "id" | "label" | "type">): string {
  return normalize(`${param.id} ${param.label} ${param.type}`);
}

function isDimensionText(text: string): boolean {
  return /(width|height|radius|size|popupwidth|popupheight|cardwidth|cardheight|宽度|高度|尺寸|圆角)/.test(
    text
  );
}

function isTrajectoryParam(param: MotionParam): boolean {
  const text = paramText(param);
  if (!["range", "number", "position", "transform"].includes(param.type)) return false;
  if (isDimensionText(text)) return false;

  return /(midx|midy|endx|endy|startx|starty|offsetx|offsety|translate|distance|slidedistance|x$|y$|轨迹|位移|滑动|距离|起点|终点|中途)/.test(
    text
  );
}

function isRhythmParam(param: MotionParam): boolean {
  const text = paramText(param);
  if (!["duration", "range", "number"].includes(param.type)) return false;
  return /(delay|interval|stagger|loop|cycle|repeat|hold|pause|startdelay|loopinterval|节奏|延迟|间隔|循环|停顿|错峰)/.test(
    text
  );
}

function isSpeedParam(param: MotionParam): boolean {
  const text = paramText(param);
  return (
    param.type === "duration" &&
    /(duration|transitionduration|animationduration|时长|速度)/.test(text) &&
    !isRhythmParam(param)
  );
}

function isEasingParam(param: MotionParam): boolean {
  if (param.type === "easing") return true;
  if (param.type !== "select") return false;
  return Boolean(
    param.constraints?.options?.some((option) => /ease|spring|bezier/.test(normalize(String(option.value))))
  );
}

function isIntensityParam(param: MotionParam): boolean {
  const text = paramText(param);
  if (!["range", "number"].includes(param.type)) return false;
  if (isDimensionText(text) || isTrajectoryParam(param)) return false;
  return /(scale|opacity|dimopacity|blur|glow|shadow|强度|透明度|缩放|模糊|发光)/.test(text);
}

function isLayerParam(param: MotionParam): boolean {
  return param.type === "image" || param.type === "text";
}

export function paramConceptIds(param: MotionParam): ParamConceptId[] {
  const concepts: ParamConceptId[] = [];
  if (isSpeedParam(param)) concepts.push("speed");
  if (isEasingParam(param)) concepts.push("easing");
  if (isIntensityParam(param)) concepts.push("intensity");
  if (isTrajectoryParam(param)) concepts.push("trajectory");
  if (isRhythmParam(param)) concepts.push("rhythm");
  if (isLayerParam(param)) concepts.push("layer");
  return concepts;
}

export function describeParamConcepts(param: MotionParam): ParamConcept[] {
  return paramConceptIds(param).map((id) => ({ id, label: CONCEPT_LABELS[id] }));
}

export function paramsForConcept(params: MotionParam[], concept: ParamConceptId): MotionParam[] {
  return params.filter((param) => paramConceptIds(param).includes(concept));
}
