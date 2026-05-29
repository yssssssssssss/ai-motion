import type { MotionManifest, MotionParam, MotionPatch } from "../manifest/types";

export type PlusControlKind = "speed" | "easing" | "intensity" | "trajectory" | "rhythm";

export type PlusControlOption = {
  id: string;
  label: string;
  value: string;
};

export type PlusControl = {
  id: PlusControlKind;
  label: string;
  options: PlusControlOption[];
  defaultOption: string;
  sliderLabel: string;
  defaultAmount: number;
  confidence: number;
  mappedParamIds: string[];
};

export type PlusControlValue = {
  option: string;
  amount: number;
};

export type PlusPatchValues = Partial<Record<PlusControlKind, PlusControlValue>>;

export type CompilePlusPatchInput = {
  manifest: MotionManifest;
  plusValues: PlusPatchValues;
  baseValues?: MotionPatch["values"];
};

export type CompilePlusPatchResult = {
  values: MotionPatch["values"];
  affectedParamIds: string[];
};

const SPEED_OPTIONS: PlusControlOption[] = [
  { id: "slow", label: "慢", value: "slow" },
  { id: "normal", label: "标准", value: "normal" },
  { id: "fast", label: "快", value: "fast" }
];

const EASING_OPTIONS: PlusControlOption[] = [
  { id: "soft", label: "柔和", value: "soft" },
  { id: "crisp", label: "利落", value: "crisp" },
  { id: "elastic", label: "弹性", value: "elastic" },
  { id: "ease-out", label: "快入慢出", value: "ease-out" },
  { id: "ease-in", label: "慢入快出", value: "ease-in" }
];

const INTENSITY_OPTIONS: PlusControlOption[] = [
  { id: "subtle", label: "克制", value: "subtle" },
  { id: "normal", label: "标准", value: "normal" },
  { id: "expressive", label: "强表现", value: "expressive" }
];

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function confirmedParams(manifest: MotionManifest): MotionParam[] {
  return manifest.params.filter((param) => param.status === "confirmed");
}

function paramText(param: MotionParam): string {
  return normalize(`${param.id} ${param.label} ${param.type}`);
}

function isSpeedParam(param: MotionParam): boolean {
  const text = paramText(param);
  return (
    param.type === "duration" &&
    /(duration|transitionduration|cycleduration|animationduration|时长|速度)/.test(text) &&
    !/(delay|startdelay|loopdelay|repeatdelay|停顿|延迟)/.test(text)
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
  if (/(width|height|x$|y$|popup|endwidth|endheight|宽度|高度)/.test(text)) return false;

  return /(scale|opacity|dimopacity|blur|glow|强度|透明度|缩放)/.test(text);
}

function buildControl(
  id: PlusControlKind,
  label: string,
  options: PlusControlOption[],
  sliderLabel: string,
  mappedParamIds: string[],
  confidence: number
): PlusControl | null {
  if (mappedParamIds.length === 0) return null;

  return {
    id,
    label,
    options,
    defaultOption: options.find((option) => option.id === "normal")?.value ?? options[0]?.value ?? "",
    sliderLabel,
    defaultAmount: 50,
    confidence,
    mappedParamIds
  };
}

export function derivePlusControls(manifest: MotionManifest): PlusControl[] {
  const params = confirmedParams(manifest);
  const controls = [
    buildControl("speed", "速度", SPEED_OPTIONS, "速度感", params.filter(isSpeedParam).map((param) => param.id), 0.85),
    buildControl("easing", "进出效果", EASING_OPTIONS, "曲线强度", params.filter(isEasingParam).map((param) => param.id), 0.85),
    buildControl(
      "intensity",
      "动效强度",
      INTENSITY_OPTIONS,
      "表现强度",
      params.filter(isIntensityParam).map((param) => param.id),
      0.75
    )
  ];

  return controls.filter((control): control is PlusControl => Boolean(control));
}

function clamp(value: number, param: MotionParam): number {
  const min = param.constraints?.min ?? Number.NEGATIVE_INFINITY;
  const max = param.constraints?.max ?? Number.POSITIVE_INFINITY;
  const step = param.constraints?.step;
  const bounded = Math.min(max, Math.max(min, value));

  if (!step) return Math.round(bounded * 1000) / 1000;

  const rounded = Math.round(bounded / step) * step;
  return Math.round(Math.min(max, Math.max(min, rounded)) * 1000) / 1000;
}

function defaultNumber(param: MotionParam): number {
  const value = param.default;

  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const match = value.trim().match(/^-?\d+(?:\.\d+)?/);
    if (match?.[0]) return Number(match[0]);
  }

  return 0;
}

function speedFactor(value: PlusControlValue): number {
  const optionFactor = value.option === "fast" ? 0.78 : value.option === "slow" ? 1.22 : 1;
  const fineTune = 1 - ((value.amount - 50) / 50) * 0.18;
  return optionFactor * fineTune;
}

function intensityFactor(value: PlusControlValue): number {
  const optionFactor = value.option === "expressive" ? 1.25 : value.option === "subtle" ? 0.72 : 1;
  const fineTune = 1 + ((value.amount - 50) / 50) * 0.2;
  return optionFactor * fineTune;
}

function easingValue(value: PlusControlValue): string {
  if (value.option === "crisp") return "ease-out";
  if (value.option === "elastic") return "cubic-bezier(0.34, 1.56, 0.64, 1)";
  if (value.option === "ease-in") return "ease-in";
  if (value.option === "ease-out") return "ease-out";

  return "ease-in-out";
}

function supportedEasingValue(param: MotionParam, value: PlusControlValue): string {
  const desired = easingValue(value);
  if (param.type !== "select") return desired;

  const optionValues = param.constraints?.options?.map((option) => String(option.value)) ?? [];
  if (optionValues.includes(desired)) return desired;
  if (typeof param.default === "string" && optionValues.includes(param.default)) return param.default;
  return optionValues[0] ?? desired;
}

export function compilePlusPatch(input: CompilePlusPatchInput): CompilePlusPatchResult {
  const paramsById = new Map(input.manifest.params.map((param) => [param.id, param]));
  const values: MotionPatch["values"] = { ...(input.baseValues ?? {}) };
  const affectedParamIds: string[] = [];

  for (const control of derivePlusControls(input.manifest)) {
    const plusValue = input.plusValues[control.id];
    if (!plusValue) continue;

    for (const paramId of control.mappedParamIds) {
      const param = paramsById.get(paramId);
      if (!param) continue;

      if (control.id === "speed") {
        values[param.id] = clamp(defaultNumber(param) * speedFactor(plusValue), param);
        affectedParamIds.push(param.id);
      }

      if (control.id === "easing") {
        values[param.id] = supportedEasingValue(param, plusValue);
        affectedParamIds.push(param.id);
      }

      if (control.id === "intensity") {
        values[param.id] = clamp(defaultNumber(param) * intensityFactor(plusValue), param);
        affectedParamIds.push(param.id);
      }
    }
  }

  return { values, affectedParamIds: [...new Set(affectedParamIds)] };
}
