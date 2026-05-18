import { motionManifestSchema } from "../manifest/schema";
import type { MotionManifest } from "../manifest/types";

export type SourceFile = {
  path: string;
  content: string;
  kind: "html" | "css" | "js" | "json" | "asset";
};

export type MotionSource = {
  id: string;
  origin: "builtin" | "imported" | "generated";
  kind: "builtin-component" | "single-html" | "html-package" | "css-svg" | "component-lite";
  files: SourceFile[];
  entry: string;
};

export type MotionComponentMetadata = {
  id: string;
  name: string;
  category: "text" | "media" | "layout" | "interaction" | "background" | "data";
  tags: string[];
  useCases: string[];
  moods: string[];
};

export type MotionComponent = MotionComponentMetadata & {
  source: MotionSource;
  manifest: MotionManifest;
};

function fileKind(path: string): SourceFile["kind"] {
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".js")) return "js";
  if (path.endsWith(".json")) return "json";
  return "asset";
}

export function loadMotionComponentFromFiles(files: Record<string, string>): MotionComponent {
  const metadataRaw = files["metadata.json"];
  const manifestRaw = files["motion.manifest.json"];

  if (!metadataRaw) throw new Error("metadata.json is required");
  if (!manifestRaw) throw new Error("motion.manifest.json is required");

  const metadata = JSON.parse(metadataRaw) as MotionComponentMetadata;
  const manifest = motionManifestSchema.parse(JSON.parse(manifestRaw)) as MotionManifest;

  const sourceFiles = Object.entries(files)
    .filter(([path]) => path.startsWith("source/"))
    .map(([path, content]) => ({ path, content, kind: fileKind(path) }));

  if (!sourceFiles.some((file) => file.path === manifest.runtime.entry)) {
    throw new Error(`Runtime entry ${manifest.runtime.entry} is missing`);
  }

  return {
    ...metadata,
    manifest,
    source: {
      id: metadata.id,
      origin: "builtin",
      kind: "builtin-component",
      files: sourceFiles,
      entry: manifest.runtime.entry
    }
  };
}
