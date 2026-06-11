import { loadMotionComponentFromFiles, type MotionComponent } from "@motion-tool/core";

type GlobPattern = string | readonly string[];
type GlobOptions = { query?: string; import?: string; eager?: boolean };
declare global {
  interface ImportMeta {
    glob: (
      pattern: GlobPattern,
      options?: GlobOptions
    ) => Record<string, string> | Record<string, () => Promise<string>>;
  }
}

const rawFileLoaders = import.meta.glob(
  [
    "../*/**/*",
    "!../src/**",
    "!../jd-horizontal-switch/source/assets.css",
    "!../jd-product-transition-video/source/assets.css"
  ],
  {
    query: "?raw",
    import: "default"
  }
) as Record<string, () => Promise<string>>;

const urlFileLoaders = import.meta.glob(
  ["../jd-horizontal-switch/source/assets.css", "../jd-product-transition-video/source/assets.css"],
  {
    query: "?url",
    import: "default"
  }
) as Record<string, () => Promise<string>>;

const metadataLoaders = import.meta.glob(["../*/metadata.json", "../*/motion.manifest.json"], {
  query: "?raw",
  import: "default"
}) as Record<string, () => Promise<string>>;

const externalizedSourceFileLoaders = {
  ...rawFileLoaders,
  ...urlFileLoaders
};

function groupLoaders(
  loaders: Record<string, () => Promise<string>>
): Record<string, Record<string, () => Promise<string>>> {
  const groups: Record<string, Record<string, () => Promise<string>>> = {};
  for (const [absolutePath, load] of Object.entries(loaders)) {
    const match = absolutePath.match(/^\.\.\/([^/]+)\/(.+)$/);
    if (!match) continue;
    const [, componentId, relativePath] = match;
    if (!componentId || !relativePath) continue;
    (groups[componentId] ??= {})[relativePath] = load;
  }
  return groups;
}

async function loadFiles(loaders: Record<string, () => Promise<string>>): Promise<Record<string, string>> {
  return Object.fromEntries(
    await Promise.all(
      Object.entries(loaders).map(async ([relativePath, load]) => [relativePath, await load()] as const)
    )
  );
}

function sourcePlaceholder(component: MotionComponent): MotionComponent {
  return {
    ...component,
    source: {
      ...component.source,
      files: component.source.files.map((file) => ({ ...file, content: "" }))
    }
  };
}

export async function loadBuiltinComponent(componentId: string): Promise<MotionComponent | null> {
  const loaders = groupLoaders(externalizedSourceFileLoaders)[componentId];
  if (!loaders) return null;
  return loadMotionComponentFromFiles(await loadFiles(loaders));
}

export async function loadBuiltinComponents(): Promise<MotionComponent[]> {
  const groups = groupLoaders(metadataLoaders);
  return Promise.all(
    Object.values(groups).map(async (loaders) => {
      const files = await loadFiles(loaders);
      const manifest = JSON.parse(files["motion.manifest.json"] ?? "{}") as {
        runtime?: { entry?: string };
      };
      if (manifest.runtime?.entry) files[manifest.runtime.entry] = "";
      return sourcePlaceholder(loadMotionComponentFromFiles(files));
    })
  );
}
