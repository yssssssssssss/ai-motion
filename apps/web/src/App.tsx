import { useCallback, useEffect, useState } from "react";
import { HomeRoute } from "./routes/HomeRoute";
import { EditorRoute } from "./routes/EditorRoute";
import type { BriefPanelMode } from "./features/brief/BriefPanel";
import { useProject } from "./state/useProject";
import { useImportFlow } from "./state/useImportFlow";
import { applyMotionRecipeToComponent, applyPatchToFiles, type MotionComponent } from "@motion-tool/core";
import { hasRenderableSource } from "./features/library/sourceState";
import type { MotionProject } from "./state/projectStore";
import { atomicMotionFeedComponents } from "./services/atomicMotionGeneration";
import { isNonAtomicMotionComponent } from "./services/componentScope";

async function loadInitialComponents(): Promise<MotionComponent[]> {
  const [{ loadBuiltinComponents }, { workEasyComponents }] = await Promise.all([
    import("@motion-tool/components-builtin/src/lazy"),
    import("./data/workeasyComponents")
  ]);
  const builtinComponents = await loadBuiltinComponents();
  return [...builtinComponents, ...workEasyComponents, ...atomicMotionFeedComponents];
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

export function removeComponentById(components: MotionComponent[], componentId: string): MotionComponent[] {
  if (!components.some((component) => component.id === componentId)) return components;
  return components.filter((component) => component.id !== componentId);
}

function componentFromProject(component: MotionComponent, project: MotionProject): MotionComponent {
  const sourceFiles = Object.fromEntries(project.source.files.map((file) => [file.path, file.content]));
  const patchedFiles = applyPatchToFiles({
    files: sourceFiles,
    manifest: project.manifest,
    patch: project.patch
  });

  return {
    ...component,
    source: {
      ...project.source,
      files: project.source.files.map((file) => ({
        ...file,
        content: patchedFiles[file.path] ?? file.content
      }))
    },
    manifest: {
      ...project.manifest,
      params: project.manifest.params.map((param) =>
        param.id in project.patch.values ? { ...param, value: project.patch.values[param.id] } : param
      )
    }
  };
}

type View = "home" | "editor";

export function App() {
  const [view, setView] = useState<View>("home");
  const [components, setComponents] = useState<MotionComponent[]>([]);
  const [isLibraryLoading, setIsLibraryLoading] = useState(true);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [restoreComponentId, setRestoreComponentId] = useState<string | null>(null);
  const [generatedDraftComponent, setGeneratedDraftComponent] = useState<MotionComponent | null>(null);
  const [isGeneratedEditorOpen, setIsGeneratedEditorOpen] = useState(false);
  const [homeBriefMode, setHomeBriefMode] = useState<BriefPanelMode>("recommend");
  const { project, startProject, updateParam, replay, resetParams, resetParamIds } = useProject();
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

  function closeGeneratedEditor() {
    setIsGeneratedEditorOpen(false);
    setGeneratedDraftComponent(null);
  }

  function saveGeneratedComponent() {
    if (!generatedDraftComponent || !project) return;

    const savedComponent = componentFromProject(generatedDraftComponent, project);
    setComponents((current) => mergeComponents(current, [savedComponent]));
    setSelectedComponentId(savedComponent.id);
    setRestoreComponentId(savedComponent.id);
    closeGeneratedEditor();
  }

  function handleGeneratedComponentReady(component: MotionComponent) {
    setGeneratedDraftComponent(component);
    setRestoreComponentId(null);
    startProject(component.source, component.manifest);
    setIsGeneratedEditorOpen(true);
  }

  function deleteComponent(componentId: string) {
    setComponents((current) => removeComponentById(current, componentId));
    setSelectedComponentId((current) => (current === componentId ? null : current));
    setRestoreComponentId((current) => (current === componentId ? null : current));
    if (generatedDraftComponent?.id === componentId) {
      closeGeneratedEditor();
    }
  }

  function deleteSelectedComponent() {
    if (!selectedComponentId) return;
    deleteComponent(selectedComponentId);
    setView("home");
  }

  function currentProjectComponent(): MotionComponent | null {
    if (!project) return null;
    const base =
      generatedDraftComponent ?? components.find((component) => component.id === selectedComponentId) ?? null;
    if (!base) return null;
    return componentFromProject(base, project);
  }

  async function applyCurrentRecipeToTarget(targetComponentId: string, targetLayerId: string) {
    const sourceComponent = currentProjectComponent();
    const targetComponentBase = components.find((component) => component.id === targetComponentId);
    if (!sourceComponent || !targetComponentBase) return;
    const targetComponent = await hydrateComponent(targetComponentBase);
    const generated = applyMotionRecipeToComponent({
      sourceComponent,
      targetComponent,
      targetLayerId,
      id: `generated-recipe-${sourceComponent.id}-to-${targetComponent.id}-${Date.now()}`
    });
    handleGeneratedComponentReady(generated);
  }

  if (view === "editor") {
    return (
      <EditorRoute
        project={project}
        onBack={backToHome}
        onParamChange={updateParam}
        onReplay={replay}
        onResetParams={resetParams}
        onResetParamIds={resetParamIds}
        {...(selectedComponentId ? { onDelete: deleteSelectedComponent } : {})}
        recipeTargetComponents={components.filter(
          (component) => component.id !== selectedComponentId && isNonAtomicMotionComponent(component)
        )}
        onApplyRecipeToTarget={applyCurrentRecipeToTarget}
      />
    );
  }

  return (
    <>
      <HomeRoute
        components={components}
        isLibraryLoading={isLibraryLoading}
        restoreComponentId={restoreComponentId}
        briefMode={homeBriefMode}
        onBriefModeChange={setHomeBriefMode}
        onSelectComponent={selectComponent}
        onLoadComponentSource={hydrateComponent}
        onRestoreComplete={clearRestoreComponentId}
        importFlow={importFlow}
        onComponentAdded={handleComponentAdded}
        onGeneratedComponentReady={handleGeneratedComponentReady}
      />
      {isGeneratedEditorOpen ? (
        <div
          className="generated-editor-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="生成组件编辑器"
        >
          <div className="generated-editor-modal">
            <EditorRoute
              project={project}
              variant="modal"
              onBack={closeGeneratedEditor}
              onParamChange={updateParam}
              onReplay={replay}
              onResetParams={resetParams}
              onResetParamIds={resetParamIds}
              recipeTargetComponents={components.filter(
                (component) =>
                  component.id !== generatedDraftComponent?.id && isNonAtomicMotionComponent(component)
              )}
              onApplyRecipeToTarget={applyCurrentRecipeToTarget}
              onSave={saveGeneratedComponent}
              saveLabel="保存组件"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
