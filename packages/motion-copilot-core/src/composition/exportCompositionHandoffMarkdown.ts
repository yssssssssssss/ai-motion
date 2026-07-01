import type { CompositionTrack, EasingSpec, MotionDocument, MotionState } from "../schema/document";
import {
  createCompositionJsonExport,
  type MotionCompositionJsonV1,
  type MotionCompositionStepExport
} from "./exportCompositionJson";

type MarkdownValue = string | number | boolean | undefined;

const stateKeys: Array<keyof MotionState> = [
  "x",
  "y",
  "width",
  "height",
  "scale",
  "opacity",
  "blur",
  "rotate"
];

function cell(value: MarkdownValue): string {
  if (value === undefined || value === "") return "-";
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

function table(headers: string[], rows: MarkdownValue[][]): string {
  return [
    `| ${headers.map(cell).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(cell).join(" | ")} |`)
  ].join("\n");
}

function ms(value: number): string {
  return `${value}ms`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}

function stateField(key: keyof MotionState, value: number): string {
  if (key === "x" || key === "y" || key === "width" || key === "height" || key === "blur")
    return `${key}:${formatNumber(value)}px`;
  if (key === "rotate") return `${key}:${formatNumber(value)}deg`;
  return `${key}:${formatNumber(value)}`;
}

function stateSummary(state: MotionState | undefined): string {
  if (!state) return "沿用预设";
  const entries = stateKeys.flatMap((key) => {
    const value = state[key];
    return typeof value === "number" ? [stateField(key, value)] : [];
  });
  return entries.length > 0 ? entries.join(", ") : "沿用预设";
}

function easingSummary(easing: EasingSpec | undefined): string {
  if (!easing) return "沿用预设";
  if (easing.type === "classic") return `classic/${easing.preset} (${easing.css})`;

  const velocity = typeof easing.velocity === "number" ? `, velocity ${formatNumber(easing.velocity)}` : "";
  return `spring (stiffness ${formatNumber(easing.stiffness)}, damping ${formatNumber(easing.damping)}, mass ${formatNumber(easing.mass)}${velocity}; fallback ${easing.cssFallback})`;
}

function timingLabel(timing: MotionCompositionStepExport["timing"]): string {
  return timing === "parallel" ? "并行" : "串行";
}

function bindingLabel(step: MotionCompositionStepExport): string {
  return step.binding.type === "layer" ? step.binding.layerName : step.binding.label;
}

function layerContentSummary(layer: MotionCompositionJsonV1["layers"][number]): string {
  if (layer.content?.text) return `文本：${layer.content.text}`;
  if (layer.content?.src) return `图片：${layer.content.alt ?? "已配置"}`;
  if (layer.content?.icon) return `图标：${layer.content.icon}`;
  return "-";
}

function layerLayoutSummary(layer: MotionCompositionJsonV1["layers"][number]): string {
  if (!layer.layout) return "-";
  return `x:${layer.layout.x}, y:${layer.layout.y}, w:${layer.layout.width}, h:${layer.layout.height}`;
}

function layerStatusSummary(layer: MotionCompositionJsonV1["layers"][number]): string {
  const status = [layer.hidden ? "隐藏" : "显示", layer.locked ? "锁定" : "可编辑"];
  return status.join(" / ");
}

function stepIssueSummary(payload: MotionCompositionJsonV1, stepId: string): string {
  const issues = payload.timeline.issues.filter((issue) => issue.stepId === stepId);
  if (issues.length === 0) return "-";
  return issues.map((issue) => `${issue.severity}:${issue.title}`).join("; ");
}

function stageBackground(payload: MotionCompositionJsonV1): string {
  const { background, backgroundImage } = payload.stage;
  return backgroundImage ? `${background} + 背景图` : background;
}

export function exportCompositionHandoffMarkdown(document: MotionDocument, track: CompositionTrack): string {
  const payload = createCompositionJsonExport(document, track);
  const lines: string[] = [];

  lines.push("# Motion Copilot 编排参数表");
  lines.push("");
  lines.push("## 画布");
  lines.push(
    table(
      ["字段", "值"],
      [
        ["模式", payload.stage.mode],
        ["尺寸", `${payload.stage.width} x ${payload.stage.height}`],
        ["背景", stageBackground(payload)],
        ["文档版本", payload.source.documentVersion]
      ]
    )
  );
  lines.push("");
  lines.push("## 编排总览");
  lines.push(
    table(
      ["字段", "值"],
      [
        ["总时长", ms(payload.timeline.totalDurationMs)],
        ["片段数", payload.timeline.steps.length],
        ["轨道数", payload.timeline.lanes.length],
        ["导出协议", payload.schemaVersion]
      ]
    )
  );
  lines.push("");
  lines.push("## 图层清单");
  lines.push(
    table(
      ["图层", "类型", "位置尺寸", "状态", "内容"],
      payload.layers.map((layer) => [
        layer.name,
        layer.kind,
        layerLayoutSummary(layer),
        layerStatusSummary(layer),
        layerContentSummary(layer)
      ])
    )
  );
  lines.push("");
  lines.push("## 动效片段");
  lines.push(
    table(
      [
        "#",
        "图层",
        "动效",
        "Preset",
        "槽位",
        "关系",
        "开始",
        "结束",
        "时长",
        "缓动",
        "初始状态",
        "结束状态",
        "注意事项"
      ],
      payload.timeline.steps.map((step, index) => [
        index + 1,
        bindingLabel(step),
        step.label,
        step.presetId,
        step.slot,
        timingLabel(step.timing),
        ms(step.startMs),
        ms(step.endMs),
        ms(step.durationMs),
        easingSummary(step.easing),
        stateSummary(step.initial),
        stateSummary(step.animate),
        stepIssueSummary(payload, step.id)
      ])
    )
  );

  if (payload.timeline.issues.length > 0) {
    lines.push("");
    lines.push("## 规范提示");
    lines.push(
      table(
        ["级别", "片段", "标题", "原因"],
        payload.timeline.issues.map((issue) => {
          const step = payload.timeline.steps.find((item) => item.id === issue.stepId);
          return [issue.severity, step?.label ?? issue.stepId, issue.title, issue.reason];
        })
      )
    );
  }

  lines.push("");
  return lines.join("\n");
}
