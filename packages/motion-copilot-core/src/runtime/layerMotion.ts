import type { MotionLayerMotion } from "../schema/document";

/** Start offset shared by the layer preview and standalone export. */
export function layerMotionOffset(
  motion: MotionLayerMotion | undefined
): { x: number; y: number } | undefined {
  const preset = motion?.preset;
  if (preset !== "lift" && preset !== "slide-left" && preset !== "slide-right") return undefined;
  const fallback = preset === "lift" ? 18 : 28;
  const distance =
    typeof motion?.distance === "number" && Number.isFinite(motion.distance)
      ? Math.min(2400, Math.max(0, motion.distance))
      : fallback;
  const direction =
    motion?.direction ?? (preset === "lift" ? "down" : preset === "slide-left" ? "left" : "right");
  if (direction === "up") return { x: 0, y: -distance };
  if (direction === "left") return { x: -distance, y: 0 };
  if (direction === "right") return { x: distance, y: 0 };
  return { x: 0, y: distance };
}
