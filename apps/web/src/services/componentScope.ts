import type { MotionComponent } from "@motion-tool/core";

export function isAtomicMotionComponent(component: MotionComponent): boolean {
  return Boolean(
    component.manifest.motionSkill ||
      component.tags.includes("atomic-motion") ||
      component.useCases.includes("atomic-motion")
  );
}

export function isNonAtomicMotionComponent(component: MotionComponent): boolean {
  return !isAtomicMotionComponent(component);
}
