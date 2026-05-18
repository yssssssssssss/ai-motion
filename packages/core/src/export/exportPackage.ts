import type { MotionManifest, MotionPatch } from "../manifest/types";

export function composeEditablePackageFiles(input: {
  sourceFiles: Record<string, string>;
  manifest: MotionManifest;
  metadata: Record<string, unknown>;
  patch: MotionPatch;
}): Record<string, string> {
  return {
    ...input.sourceFiles,
    "motion.manifest.json": JSON.stringify(input.manifest, null, 2),
    "metadata.json": JSON.stringify(input.metadata, null, 2),
    "motion.patch.json": JSON.stringify(input.patch, null, 2)
  };
}
