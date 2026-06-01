import { useCallback, useEffect, useState } from "react";
import { HomeRoute } from "./routes/HomeRoute";
import { EditorRoute } from "./routes/EditorRoute";
import { useProject } from "./state/useProject";
import { useImportFlow } from "./state/useImportFlow";
import type { MotionComponent } from "@motion-tool/core";
import { hasRenderableSource } from "./features/library/sourceState";

async function loadInitialComponents(): Promise<MotionComponent[]> {
  const [{ loadBuiltinComponents }, { workEasyComponents }] = await Promise.all([
    import("@motion-tool/components-builtin/src/lazy"),
    import("./data/workeasyComponents")
  ]);
  const builtinComponents = await loadBuiltinComponents();
  return [...builtinComponents, ...workEasyComponents];
}

async function hydrateBuiltinComponent(component: MotionComponent): Promise<MotionComponent> {
  if (component.source.origin !== "builtin" || hasRenderableSource(component)) return component;
  const { loadBuiltinComponent } = await import("@motion-tool/components-builtin/src/lazy");
  return (await loadBuiltinComponent(component.id)) ?? component;
}

function mergeComponents(base: MotionComponent[], additions: MotionComponent[]): MotionComponent[] {
  const seen = new Set(base.map((component) => component.id));
  return [...base, ...additions.filter((component) => !seen.has(component.id))];
}

type View = "home" | "editor";

export function App() {
  const [view, setView] = useState<View>("home");
  const [components, setComponents] = useState<MotionComponent[]>([]);
  const [isLibraryLoading, setIsLibraryLoading] = useState(true);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [restoreComponentId, setRestoreComponentId] = useState<string | null>(null);
  const { project, startProject, updateParam, replay, resetParams } = useProject();
  const importFlow = useImportFlow();

  useEffect(() => {
    let ignore = false;
    loadInitialComponents()
      .then((initialComponents) => {
        if (ignore) return;
        setComponents((current) => mergeComponents(initialComponents, current));
      })
      .finally(() => {
        if (!ignore) setIsLibraryLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const hydrateComponent = useCallback(async (component: MotionComponent) => {
    const hydrated = await hydrateBuiltinComponent(component);
    if (hydrated !== component) {
      setComponents((current) => current.map((item) => (item.id === hydrated.id ? hydrated : item)));
    }
    return hydrated;
  }, []);

  async function selectComponent(componentId: string) {
    const component = components.find((item) => item.id === componentId);
    if (!component) return;
    const hydrated = await hydrateComponent(component);
    setSelectedComponentId(componentId);
    setRestoreComponentId(null);
    startProject(hydrated.source, hydrated.manifest);
    setView("editor");
  }

  function backToHome() {
    setRestoreComponentId(selectedComponentId);
    setView("home");
  }

  const clearRestoreComponentId = useCallback(() => {
    setRestoreComponentId(null);
  }, []);

  // 上传组件入库：追加到组件库 + 进入编辑
  function handleComponentAdded(component: MotionComponent) {
    setComponents((prev) => [...prev, component]);
    setSelectedComponentId(component.id);
    setRestoreComponentId(null);
    startProject(component.source, component.manifest);
    setView("editor");
  }

  if (view === "editor") {
    return (
      <EditorRoute
        project={project}
        onBack={backToHome}
        onParamChange={updateParam}
        onReplay={replay}
        onResetParams={resetParams}
      />
    );
  }

  return (
    <HomeRoute
      components={components}
      isLibraryLoading={isLibraryLoading}
      restoreComponentId={restoreComponentId}
      onSelectComponent={selectComponent}
      onLoadComponentSource={hydrateComponent}
      onRestoreComplete={clearRestoreComponentId}
      importFlow={importFlow}
      onComponentAdded={handleComponentAdded}
    />
  );
}
