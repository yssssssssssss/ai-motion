import { loadMotionComponentFromFiles, type MotionComponent } from "@motion-tool/core";

// 局部声明 import.meta.glob 类型，避免本包依赖 vite/client 全局类型。
// 该 API 仅在 Vite 环境下生效；本包预期被 Vite 应用消费。
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

// 把每个组件目录下的源码文件按相对路径注入。
// 路径键形如 '../<component-id>/<relative-path>'
const rawFiles = import.meta.glob(
  [
    "../*/**/*",
    "!../src/**",
    "!../jd-horizontal-switch/source/assets.css",
    "!../jd-product-transition-video/source/assets.css"
  ],
  {
    query: "?raw",
    import: "default",
    eager: true
  }
) as Record<string, string>;

const urlFiles = import.meta.glob(
  ["../jd-horizontal-switch/source/assets.css", "../jd-product-transition-video/source/assets.css"],
  {
    query: "?url",
    import: "default",
    eager: true
  }
) as Record<string, string>;

const componentFiles = {
  ...rawFiles,
  ...urlFiles
};

// 按组件 id 分组：{ [componentId]: { [fileRelative]: content } }
function groupByComponent(): Record<string, Record<string, string>> {
  const groups: Record<string, Record<string, string>> = {};
  for (const [absolutePath, content] of Object.entries(componentFiles)) {
    const match = absolutePath.match(/^\.\.\/([^/]+)\/(.+)$/);
    if (!match) continue;
    const [, componentId, relativePath] = match;
    if (!componentId || !relativePath) continue;
    (groups[componentId] ??= {})[relativePath] = content;
  }
  return groups;
}

function loadAll(): MotionComponent[] {
  const groups = groupByComponent();
  return Object.values(groups).map((files) => loadMotionComponentFromFiles(files));
}

export const builtinComponents: MotionComponent[] = loadAll();
