import type { DesignElementKind } from "@motion-lens/core";

export type ManualAnnotationKind =
  | "button"
  | "card"
  | "content"
  | "modal"
  | "feedback"
  | "form"
  | "nav"
  | "list"
  | "media"
  | "unknown";

export type ManualAnnotationOption = {
  kind: ManualAnnotationKind;
  label: string;
  elementKind: DesignElementKind;
  defaultLabel: string;
};

export const manualAnnotationOptions: ManualAnnotationOption[] = [
  { kind: "button", label: "按钮/CTA", elementKind: "button", defaultLabel: "主按钮" },
  { kind: "card", label: "卡片组", elementKind: "card", defaultLabel: "卡片组" },
  { kind: "content", label: "内容区", elementKind: "content", defaultLabel: "内容区" },
  { kind: "modal", label: "弹窗/浮层", elementKind: "modal", defaultLabel: "弹窗" },
  { kind: "feedback", label: "反馈/状态", elementKind: "feedback", defaultLabel: "反馈区" },
  { kind: "form", label: "表单/输入", elementKind: "form", defaultLabel: "表单区" },
  { kind: "nav", label: "导航/标签", elementKind: "nav", defaultLabel: "导航区" },
  { kind: "list", label: "列表/信息流", elementKind: "card", defaultLabel: "列表区" },
  { kind: "media", label: "图片/媒体", elementKind: "content", defaultLabel: "媒体区" },
  { kind: "unknown", label: "其他/AI 判断", elementKind: "unknown", defaultLabel: "待判断区域" }
];

export function manualAnnotationOptionFor(kind: ManualAnnotationKind): ManualAnnotationOption {
  return manualAnnotationOptions.find((option) => option.kind === kind) ?? manualAnnotationOptions.at(-1)!;
}
