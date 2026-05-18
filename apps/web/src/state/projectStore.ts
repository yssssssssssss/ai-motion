import type { MotionManifest, MotionPatch, MotionSource } from "@motion-tool/core";

export type MotionProject = {
  id: string;
  source: MotionSource;
  manifest: MotionManifest;
  patch: MotionPatch;
};

export function createEmptyPatch(manifest: MotionManifest): MotionPatch {
  return {
    id: `${manifest.id}-patch`,
    sourceManifestId: manifest.id,
    values: {}
  };
}
