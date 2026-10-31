import { useCallback, useEffect, useRef, useState } from "react";
import { HomeRoute } from "./routes/HomeRoute";
import { EditorRoute } from "./routes/EditorRoute";
import type { BriefPanelMode } from "./features/brief/BriefPanel";
import { createComponentStore } from "./state/componentStore";
import { useProject } from "./state/useProject";
import { useImportFlow } from "./state/useImportFlow";
import {
  applyMotionRecipeToComponent,
  applyPatchToFiles,
  type MotionComponent,
  type MotionPatch
} from "@motion-tool/core";
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

export function componentWithUniqueId(
  component: MotionComponent,
  components: MotionComponent[],
  now: number
): MotionComponent {
  const ids = new Set(components.map((item) => item.id));
  if (!ids.has(component.id)) return component;
  let timestamp = now;
  let id = `${component.id}-copy-${timestamp}`;
  while (ids.has(id)) id = `${component.id}-copy-${++timestamp}`;
  return {
    ...component,
    id,
    source: { ...component.source, id },
    manifest: { ...component.manifest, id: `${id}-manifest` }
  };
}

export function removeComponentById(components: MotionComponent[], componentId: string): MotionComponent[] {
  if (!components.some((component) => component.id === componentId)) return components;
  return components.filter((component) => component.id !== componentId);
}

export function componentFromProject(component: MotionComponent, project: MotionProject): MotionComponent {
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
        param.id in project.patch.values
          ? { ...param, default: project.patch.values[param.id], value: project.patch.values[param.id] }
          : param
      )
    }
  };
}

type View = "home" | "editor";

export function App() {
  const [store] = useState(createComponentStore);
  const [notice, setNotice] = useState("");
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
  const drafts = useRef<Record<string, MotionPatch>>({});
  const [projectComponentId, setProjectComponentId] = useState<string | null>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const persistDraft = useCallback(
    (componentId: string, patch: MotionPatch) => {
      drafts.current[componentId] = patch;
      void store.saveDraft(componentId, patch).catch(() => setNotice("保存到本地失败，刷新后可能丢失"));
    },
    [store]
  );

  useEffect(() => {
    const componentId = projectComponentId;
    if (!project || !componentId || generatedDraftComponent) return;
    drafts.current[componentId] = project.patch;
    draftTimer.current = setTimeout(() => persistDraft(componentId, project.patch), 300);
    return () => clearTimeout(draftTimer.current);
  }, [project, projectComponentId, generatedDraftComponent, persistDraft]);

  function flushCurrentDraft() {
    clearTimeout(draftTimer.current);
    if (project && projectComponentId && !generatedDraftComponent) {
      persistDraft(projectComponentId, project.patch);
    }
  }

  useEffect(() => {
    let ignore = false;
    Promise.all([
      loadInitialComponents(),
      store.load().catch(() => {
        if (!ignore) setNotice("读取本地组件失败，本次编辑仍可继续");
        return { components: [], drafts: {} };
      })
    ])
      .then(([bundledComponents, stored]) => {
        const initialComponents = mergeComponents(bundledComponents, stored.components);
        if (ignore) return;
        drafts.current = { ...stored.drafts, ...drafts.current };
        setComponents((current) => mergeComponents(initialComponents, current));
      })
      .catch(() => {
        if (!ignore) setNotice("组件库加载失败，请刷新重试");
      })
      .finally(() => {
        if (!ignore) setIsLibraryLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [store]);

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
    flushCurrentDraft();
    setProjectComponentId(componentId);
    setSelectedComponentId(componentId);
    setRestoreComponentId(null);
    startProject(hydrated.source, hydrated.manifest, drafts.current[componentId]);
    setView("editor");
  }

  function backToHome() {
    flushCurrentDraft();
    setProjectComponentId(null);
    setRestoreComponentId(selectedComponentId);
    setView("home");
  }

  const clearRestoreComponentId = useCallback(() => {
    setRestoreComponentId(null);
  }, []);

  function persistComponent(component: MotionComponent) {
    void store.saveComponent(component).catch(() => setNotice("保存到本地失败，刷新后可能丢失"));
  }

  // 上传组件入库：追加到组件库 + 进入编辑
  function handleComponentAdded(component: MotionComponent) {
    const addedComponent = componentWithUniqueId(component, components, Date.now());
    flushCurrentDraft();
    setProjectComponentId(addedComponent.id);
    setComponents((prev) => [...prev, addedComponent]);
    persistComponent(addedComponent);
    setSelectedComponentId(addedComponent.id);
    setRestoreComponentId(null);
    startProject(addedComponent.source, addedComponent.manifest);
    setView("editor");
  }

  function closeGeneratedEditor() {
    setIsGeneratedEditorOpen(false);
    setGeneratedDraftComponent(null);
  }

  function saveGeneratedComponent() {
    if (!generatedDraftComponent || !project) return;

    const savedComponent = componentFromProject(generatedDraftComponent, project);
    persistComponent(savedComponent);
    setComponents((current) => mergeComponents(current, [savedComponent]));
    setSelectedComponentId(savedComponent.id);
    setRestoreComponentId(savedComponent.id);
    closeGeneratedEditor();
  }

  function handleGeneratedComponentReady(component: MotionComponent) {
    flushCurrentDraft();
    setProjectComponentId(null);
    setGeneratedDraftComponent(component);
    setRestoreComponentId(null);
    startProject(component.source, component.manifest);
    setIsGeneratedEditorOpen(true);
  }

  function deleteComponent(componentId: string) {
    delete drafts.current[componentId];
    if (projectComponentId === componentId) {
      clearTimeout(draftTimer.current);
      setProjectComponentId(null);
    }
    void store.deleteComponent(componentId).catch(() => setNotice("删除本地组件失败，刷新后可能恢复"));
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
    setNotice("");
    try {
      const targetComponent = await hydrateComponent(targetComponentBase);
      const generated = applyMotionRecipeToComponent({
        sourceComponent,
        targetComponent,
        targetLayerId,
        id: `generated-recipe-${sourceComponent.id}-to-${targetComponent.id}-${Date.now()}`
      });
      handleGeneratedComponentReady(generated);
      if (view === "editor") setSelectedComponentId(null);
      setView("home");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "应用动效配方失败，请重试");
    }
  }

  const noticeElement = notice ? (
    <div className="app-notice" role="alert">
      {notice}
    </div>
  ) : null;

  if (view === "editor") {
    return (
      <>
        {noticeElement}
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
      </>
    );
  }

  return (
    <>
      {noticeElement}
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
