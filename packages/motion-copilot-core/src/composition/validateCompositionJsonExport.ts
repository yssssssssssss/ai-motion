import type { MotionCompositionJsonV1 } from "./exportCompositionJson";

export type CompositionJsonValidationIssue = {
  path: string;
  message: string;
};

export type CompositionJsonValidationResult = {
  valid: boolean;
  issues: CompositionJsonValidationIssue[];
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function issue(path: string, message: string): CompositionJsonValidationIssue {
  return { path, message };
}

function stringAt(value: Record<string, unknown>, key: string, path: string): CompositionJsonValidationIssue[] {
  return typeof value[key] === "string" ? [] : [issue(`${path}.${key}`, "必须是字符串")];
}

function numberAt(value: Record<string, unknown>, key: string, path: string): CompositionJsonValidationIssue[] {
  return typeof value[key] === "number" && Number.isFinite(value[key])
    ? []
    : [issue(`${path}.${key}`, "必须是有效数字")];
}

function booleanAt(value: Record<string, unknown>, key: string, path: string): CompositionJsonValidationIssue[] {
  return typeof value[key] === "boolean" ? [] : [issue(`${path}.${key}`, "必须是布尔值")];
}

function arrayAt(value: Record<string, unknown>, key: string, path: string): CompositionJsonValidationIssue[] {
  return Array.isArray(value[key]) ? [] : [issue(`${path}.${key}`, "必须是数组")];
}

function validateBinding(value: unknown, path: string): CompositionJsonValidationIssue[] {
  if (!record(value)) return [issue(path, "必须是对象")];
  const issues = stringAt(value, "type", path);
  if (value.type === "layer") {
    issues.push(...stringAt(value, "layerId", path), ...stringAt(value, "layerName", path));
  } else if (value.type === "unbound") {
    issues.push(...stringAt(value, "label", path), ...stringAt(value, "reason", path));
  } else {
    issues.push(issue(`${path}.type`, "必须是 layer 或 unbound"));
  }
  return issues;
}

function validateLayers(value: unknown, path: string): CompositionJsonValidationIssue[] {
  if (!Array.isArray(value)) return [issue(path, "必须是数组")];
  return value.flatMap((layer, index) => {
    const layerPath = `${path}[${index}]`;
    if (!record(layer)) return [issue(layerPath, "必须是对象")];
    return [
      ...stringAt(layer, "id", layerPath),
      ...stringAt(layer, "name", layerPath),
      ...stringAt(layer, "kind", layerPath),
      ...booleanAt(layer, "editable", layerPath),
      ...booleanAt(layer, "hidden", layerPath),
      ...booleanAt(layer, "locked", layerPath)
    ];
  });
}

function validateLanes(value: unknown, path: string): CompositionJsonValidationIssue[] {
  if (!Array.isArray(value)) return [issue(path, "必须是数组")];
  return value.flatMap((lane, index) => {
    const lanePath = `${path}[${index}]`;
    if (!record(lane)) return [issue(lanePath, "必须是对象")];
    const issues = [
      ...stringAt(lane, "id", lanePath),
      ...stringAt(lane, "label", lanePath),
      ...validateBinding(lane.binding, `${lanePath}.binding`),
      ...arrayAt(lane, "stepIds", lanePath)
    ];
    if (Array.isArray(lane.stepIds)) {
      lane.stepIds.forEach((stepId, stepIndex) => {
        if (typeof stepId !== "string") issues.push(issue(`${lanePath}.stepIds[${stepIndex}]`, "必须是字符串"));
      });
    }
    return issues;
  });
}

function validateSteps(value: unknown, path: string): CompositionJsonValidationIssue[] {
  if (!Array.isArray(value)) return [issue(path, "必须是数组")];
  return value.flatMap((step, index) => {
    const stepPath = `${path}[${index}]`;
    if (!record(step)) return [issue(stepPath, "必须是对象")];
    const issues = [
      ...stringAt(step, "id", stepPath),
      ...stringAt(step, "presetId", stepPath),
      ...stringAt(step, "label", stepPath),
      ...stringAt(step, "slot", stepPath),
      ...stringAt(step, "timing", stepPath),
      ...stringAt(step, "laneId", stepPath),
      ...numberAt(step, "startMs", stepPath),
      ...numberAt(step, "endMs", stepPath),
      ...numberAt(step, "durationMs", stepPath),
      ...validateBinding(step.binding, `${stepPath}.binding`)
    ];
    if (step.timing !== "sequential" && step.timing !== "parallel") {
      issues.push(issue(`${stepPath}.timing`, "必须是 sequential 或 parallel"));
    }
    if (
      typeof step.startMs === "number" &&
      typeof step.endMs === "number" &&
      typeof step.durationMs === "number"
    ) {
      if (step.startMs < 0) issues.push(issue(`${stepPath}.startMs`, "不能小于 0"));
      if (step.endMs < step.startMs) issues.push(issue(`${stepPath}.endMs`, "不能早于 startMs"));
      if (step.durationMs < 0) issues.push(issue(`${stepPath}.durationMs`, "不能小于 0"));
      if (step.endMs - step.startMs !== step.durationMs) {
        issues.push(issue(stepPath, "endMs - startMs 必须等于 durationMs"));
      }
    }
    return issues;
  });
}

function validateIssues(value: unknown, path: string): CompositionJsonValidationIssue[] {
  if (!Array.isArray(value)) return [issue(path, "必须是数组")];
  return value.flatMap((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!record(item)) return [issue(itemPath, "必须是对象")];
    return [
      ...stringAt(item, "id", itemPath),
      ...stringAt(item, "stepId", itemPath),
      ...stringAt(item, "severity", itemPath),
      ...stringAt(item, "title", itemPath),
      ...stringAt(item, "reason", itemPath)
    ];
  });
}

export function validateCompositionJsonExport(payload: unknown): CompositionJsonValidationResult {
  if (!record(payload)) {
    return { valid: false, issues: [issue("$", "必须是对象")] };
  }

  const issues: CompositionJsonValidationIssue[] = [];
  if (payload.schemaVersion !== "motion-copilot.composition.v1") {
    issues.push(issue("$.schemaVersion", "必须是 motion-copilot.composition.v1"));
  }

  if (!record(payload.source)) {
    issues.push(issue("$.source", "必须是对象"));
  } else {
    if (payload.source.app !== "motion-copilot") issues.push(issue("$.source.app", "必须是 motion-copilot"));
    issues.push(...stringAt(payload.source, "documentVersion", "$.source"));
  }

  if (!record(payload.stage)) {
    issues.push(issue("$.stage", "必须是对象"));
  } else {
    issues.push(
      ...stringAt(payload.stage, "mode", "$.stage"),
      ...numberAt(payload.stage, "width", "$.stage"),
      ...numberAt(payload.stage, "height", "$.stage"),
      ...stringAt(payload.stage, "background", "$.stage")
    );
    if (typeof payload.stage.width === "number" && payload.stage.width <= 0) {
      issues.push(issue("$.stage.width", "必须大于 0"));
    }
    if (typeof payload.stage.height === "number" && payload.stage.height <= 0) {
      issues.push(issue("$.stage.height", "必须大于 0"));
    }
  }

  issues.push(...validateLayers(payload.layers, "$.layers"));

  if (!record(payload.timeline)) {
    issues.push(issue("$.timeline", "必须是对象"));
  } else {
    issues.push(
      ...numberAt(payload.timeline, "totalDurationMs", "$.timeline"),
      ...validateLanes(payload.timeline.lanes, "$.timeline.lanes"),
      ...validateSteps(payload.timeline.steps, "$.timeline.steps"),
      ...validateIssues(payload.timeline.issues, "$.timeline.issues")
    );
    if (typeof payload.timeline.totalDurationMs === "number" && payload.timeline.totalDurationMs < 0) {
      issues.push(issue("$.timeline.totalDurationMs", "不能小于 0"));
    }
  }

  return { valid: issues.length === 0, issues };
}

export function isCompositionJsonExport(payload: unknown): payload is MotionCompositionJsonV1 {
  return validateCompositionJsonExport(payload).valid;
}
