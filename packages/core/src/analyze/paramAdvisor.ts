import type { MotionParam } from "../manifest/types";

function prettifyLabel(label: string): string {
  return label.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

export function suggestParams(detected: MotionParam[], maxParams = 10): MotionParam[] {
  return detected.slice(0, maxParams).map((param) => ({
    ...param,
    label: prettifyLabel(param.label),
    status: "suggested" as const,
    confidence: Math.min(1, param.confidence ?? 0.7)
  }));
}
