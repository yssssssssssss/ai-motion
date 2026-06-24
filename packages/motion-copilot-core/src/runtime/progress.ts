import { type EasingSpec } from "../schema/document";

export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function easedProgress(easing: EasingSpec, progress: number): number {
  const p = clampProgress(progress);
  if (easing.type === "spring") {
    return 1 - Math.pow(1 - p, 3);
  }
  if (easing.preset === "accelerate") return p * p;
  if (easing.preset === "sharp") return Math.min(1, p * 1.12);
  return 1 - Math.pow(1 - p, 2);
}
