import { useMemo, useState } from "react";
import {
  confirmValidParams,
  importMotionSourceFromFiles,
  recommendComponents,
  scanSourceForParams,
  suggestParams,
  type BriefParseResult,
  type MotionComponent,
  type MotionManifest,
  type MotionParam,
  type MotionSource,
  type Recommendation
} from "@motion-tool/core";
import { BriefPanel } from "./features/brief/BriefPanel";
import { ParameterPanel } from "./features/editor/ParameterPanel";
import { PreviewFrame } from "./features/editor/PreviewFrame";
import { ExportPanel } from "./features/export/ExportPanel";
import { ConfirmParamsPanel } from "./features/import/ConfirmParamsPanel";
import { ImportPanel } from "./features/import/ImportPanel";
import { ComponentCandidates } from "./features/library/ComponentCandidates";
import { ComponentFeed } from "./features/library/ComponentFeed";
import { createEmptyPatch, type MotionProject } from "./state/projectStore";
import { workEasyComponents } from "./data/workeasyComponents";
import { parseBrief } from "./services/briefParserClient";

const heroManifest: MotionManifest = {
  version: "1.0",
  id: "hero-text-reveal",
  name: "Hero Text Reveal",
  sourceKind: "builtin-component",
  runtime: { engine: "html", entry: "source/index.html", sandbox: "iframe" },
  capabilities: ["builtin", "editable", "export-html"],
  params: [
    {
      id: "headline",
      label: "Headline",
      type: "text",
      default: "Build motion faster",
      status: "confirmed",
      targets: [{ kind: "html-text", file: "source/index.html", selector: "[data-motion=headline]" }]
    },
    {
      id: "accentColor",
      label: "Accent color",
      type: "color",
      default: "#38bdf8",
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--accent-color" }]
    },
    {
      id: "duration",
      label: "Reveal duration",
      type: "duration",
      default: 800,
      constraints: { min: 200, max: 2000, step: 50, unit: "ms" },
      status: "confirmed",
      targets: [{ kind: "css-variable", file: "source/style.css", selector: ":root", name: "--reveal-duration" }]
    }
  ],
  groups: [
    { id: "content", label: "Content", params: ["headline"] },
    { id: "style", label: "Style", params: ["accentColor"] },
    { id: "motion", label: "Motion", params: ["duration"] }
  ]
};

const heroComponent: MotionComponent = {
  id: "hero-text-reveal",
  name: "Hero Text Reveal",
  category: "text",
  tags: ["hero", "text", "reveal", "saas"],
  useCases: ["landing-page", "banner"],
  moods: ["subtle", "premium", "clean"],
  manifest: heroManifest,
  source: {
    id: "hero-text-reveal",
    origin: "builtin",
    kind: "builtin-component",
    entry: "source/index.html",
    files: [
      {
        path: "source/index.html",
        kind: "html",
        content: `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main class="hero">
      <p data-motion="eyebrow">AI Motion Tool</p>
      <h1 data-motion="headline">Build motion faster</h1>
    </main>
    <script src="./script.js"></script>
  </body>
</html>`
      },
      {
        path: "source/style.css",
        kind: "css",
        content: `:root {
  --background-color: #111827;
  --text-color: #f8fafc;
  --accent-color: #38bdf8;
  --reveal-duration: 800ms;
  --reveal-distance: 18px;
}

body {
  margin: 0;
  background: var(--background-color);
  color: var(--text-color);
  font-family: Inter, system-ui, sans-serif;
}

.hero {
  display: grid;
  min-height: 100vh;
  place-content: center;
  gap: 16px;
  padding: 48px;
}

[data-motion="eyebrow"] {
  color: var(--accent-color);
  font-size: 14px;
  letter-spacing: 0;
  margin: 0;
  opacity: 0;
  transform: translateY(var(--reveal-distance));
  animation: reveal var(--reveal-duration) ease-out forwards;
}

[data-motion="headline"] {
  font-size: 72px;
  line-height: 1;
  margin: 0;
  opacity: 0;
  transform: translateY(var(--reveal-distance));
  animation: reveal var(--reveal-duration) ease-out 120ms forwards;
}

@keyframes reveal {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}`
      },
      {
        path: "source/script.js",
        kind: "js",
        content: `window.motionReplay = function motionReplay() {
  for (const element of document.querySelectorAll("[data-motion]")) {
    element.style.animation = "none";
    element.offsetHeight;
    element.style.animation = "";
  }
};`
      }
    ]
  }
};

const components = [heroComponent, ...workEasyComponents];

function createProject(source: MotionSource, manifest: MotionManifest): MotionProject {
  return {
    id: `${source.id}-project`,
    source,
    manifest,
    patch: createEmptyPatch(manifest)
  };
}

type View = "home" | "editor";

export function App() {
  const [view, setView] = useState<View>("home");
  const [brief, setBrief] = useState("subtle saas hero text");
  const [parseResult, setParseResult] = useState<BriefParseResult | null>(null);
  const [isRecommending, setIsRecommending] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [project, setProject] = useState<MotionProject | null>(null);
  const [pendingImport, setPendingImport] = useState<MotionSource | null>(null);
  const [suggestedParams, setSuggestedParams] = useState<MotionParam[]>([]);
  const [selectedParamIds, setSelectedParamIds] = useState<Set<string>>(new Set());

  const aiMatchIds = useMemo(() => new Set(recommendations.map((item) => item.componentId)), [recommendations]);

  function updateParam(paramId: string, value: unknown) {
    setProject((current) => {
      if (!current) return current;

      return {
        ...current,
        patch: {
          ...current.patch,
          values: { ...current.patch.values, [paramId]: value }
        }
      };
    });
  }

  async function runRecommend() {
    setIsRecommending(true);
    const result = await parseBrief(brief);
    setParseResult(result);
    setRecommendations(recommendComponents({ intent: result.intent, components }));
    setIsRecommending(false);
  }

  function selectComponent(componentId: string) {
    const component = components.find((item) => item.id === componentId);
    if (!component) return;

    setProject(createProject(component.source, component.manifest));
    setView("editor");
  }

  function importFiles(files: Record<string, string>) {
    const result = importMotionSourceFromFiles(files);
    const suggested = suggestParams(scanSourceForParams(result.source));
    setPendingImport(result.source);
    setSuggestedParams(suggested);
    setSelectedParamIds(new Set(suggested.map((param) => param.id)));
  }

  function toggleParam(id: string) {
    setSelectedParamIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function confirmImport() {
    if (!pendingImport) return;

    const selected = suggestedParams.filter((param) => selectedParamIds.has(param.id));
    const validation = confirmValidParams({ source: pendingImport, params: selected });
    const manifest: MotionManifest = {
      version: "1.0",
      id: `${pendingImport.id}-manifest`,
      name: "Imported Motion",
      sourceKind: pendingImport.kind,
      runtime: { engine: "html", entry: pendingImport.entry, sandbox: "iframe" },
      params: validation.confirmed,
      capabilities: ["imported", "editable", "export-html"]
    };

    setProject(createProject(pendingImport, manifest));
    setView("editor");
  }

  if (view === "editor") {
    return (
      <main className="editor-shell">
        <header className="editor-header">
          <button type="button" onClick={() => setView("home")}>
            Back to feed
          </button>
          <div>
            <p className="eyebrow">Editor</p>
            <h1>{project?.manifest.name ?? "Component Editor"}</h1>
          </div>
        </header>
        <section className="editor-preview" aria-label="Motion preview">
          <PreviewFrame source={project?.source ?? null} manifest={project?.manifest ?? null} patch={project?.patch ?? null} />
        </section>
        <aside className="editor-inspector" aria-label="Parameters">
          <div className="panel-header">
            <p className="eyebrow">Inspector</p>
            <h2>Parameters</h2>
          </div>
          <ParameterPanel manifest={project?.manifest ?? null} patch={project?.patch ?? null} onChange={updateParam} />
        </aside>
        <footer className="transport" aria-label="Playback and export controls">
          <button type="button" onClick={() => setProject((current) => (current ? { ...current } : current))}>
            Replay
          </button>
          <button type="button">Pause</button>
          <button type="button">Viewport</button>
          <ExportPanel project={project} />
        </footer>
      </main>
    );
  }

  return (
    <main className="home-shell">
      <div className="home-header">
        <p className="eyebrow">AI Motion Tool</p>
        <h1>Find editable motion components</h1>
      </div>
      <BriefPanel
        brief={brief}
        parseResult={parseResult}
        isLoading={isRecommending}
        onBriefChange={setBrief}
        onRecommend={runRecommend}
      />
      <ComponentCandidates recommendations={recommendations} components={components} onSelect={selectComponent} />
      <ImportPanel onImport={importFiles} />
      <ConfirmParamsPanel params={suggestedParams} selected={selectedParamIds} onToggle={toggleParam} onConfirm={confirmImport} />
      <ComponentFeed components={components} aiMatchIds={aiMatchIds} onSelect={selectComponent} />
    </main>
  );
}
