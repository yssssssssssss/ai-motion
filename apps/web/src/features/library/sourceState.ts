import type { MotionComponent } from "@motion-tool/core";

export function hasRenderableSource(component: MotionComponent): boolean {
  const entry = component.source.files.find((file) => file.path === component.manifest.runtime.entry);
  return Boolean(entry?.content.trim());
}
