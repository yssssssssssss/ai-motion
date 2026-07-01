import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  compilePlusPatch,
  derivePlusControls,
  type PlusControlKind,
  type PlusControlValue,
  type PlusPatchValues
} from "@motion-tool/core";
import type { MotionComponent } from "@motion-tool/core";
import { ParameterPanel } from "../features/editor/ParameterPanel";
import { ParameterModeTabs, type ParameterMode } from "../features/editor/ParameterModeTabs";
import { PlusControlPanel } from "../features/editor/PlusControlPanel";
import { AtomicMotionInspectorPanel } from "../features/editor/AtomicMotionInspectorPanel";
import { LayerReplacementPanel } from "../features/editor/LayerReplacementPanel";
import { MotionRecipePanel } from "../features/editor/MotionRecipePanel";
import { ReadinessDiagnosisPanel } from "../features/editor/ReadinessDiagnosisPanel";
import { PreviewFrame, type PreviewPlaybackState } from "../features/editor/PreviewFrame";
import { shouldPreviewAutoplay } from "../features/editor/PreviewFrame";
import { ExportPanel } from "../features/export/ExportPanel";
import type { MotionProject } from "../state/projectStore";

type EditorRouteProps = {
  project: MotionProject | null;
  onBack: () => void;
  onParamChange: (paramId: string, value: unknown) => void;
  onReplay: () => void;
  onResetParams?: () => void;
  onResetParamIds?: (paramIds: string[]) => void;
  variant?: "page" | "modal";
  onDelete?: () => void;
  onSave?: () => void;
  saveLabel?: string;
  recipeTargetComponents?: MotionComponent[];
  onApplyRecipeToTarget?: (targetComponentId: string, targetLayerId: string) => void;
};

type InspectorTab = "info" | "params" | "layers" | "related";

const inspectorTabs: Array<{ id: InspectorTab; label: string }> = [
  { id: "info", label: "信息" },
  { id: "params", label: "参数" },
  { id: "layers", label: "图层" },
  { id: "related", label: "其他" }
];

function ComponentInfoPanel({ project }: { project: MotionProject | null }) {
  if (!project) return null;

  const { manifest } = project;
  const confirmedParamCount = manifest.params.filter((param) => param.status === "confirmed").length;
  const layerCount = manifest.layers?.length ?? 0;
  const recipeCount = manifest.motionRecipes?.length ?? 0;

  return (
    <section className="component-info-panel" aria-label="组件信息">
      <div className="panel-header compact-panel-header">
        <p className="eyebrow">组件信息</p>
        <h2>{manifest.name}</h2>
      </div>
      <dl className="component-info-summary">
        <div>
          <dt>运行时</dt>
          <dd>{manifest.runtime.engine}</dd>
        </div>
        <div>
          <dt>来源</dt>
          <dd>{manifest.sourceKind}</dd>
        </div>
        <div>
          <dt>可调参数</dt>
          <dd>
            {confirmedParamCount}/{manifest.params.length}
          </dd>
        </div>
        <div>
          <dt>图层 / Recipe</dt>
          <dd>
            {layerCount} / {recipeCount}
          </dd>
        </div>
      </dl>
    </section>
  );
}

export function EditorRoute({
  project,
  onBack,
  onParamChange,
  onReplay,
  onResetParams,
  onResetParamIds,
  variant = "page",
  onDelete,
  onSave,
  saveLabel = "保存组件",
  recipeTargetComponents = [],
  onApplyRecipeToTarget
}: EditorRouteProps) {
  const [playbackState, setPlaybackState] = useState<PreviewPlaybackState>("playing");
  const [parameterMode, setParameterMode] = useState<ParameterMode>("pro");
  const [plusValues, setPlusValues] = useState<PlusPatchValues>({});
  const [replayToken, setReplayToken] = useState(0);
  const [resetToken, setResetToken] = useState(0);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("info");
  const isAtomicMotion = Boolean(project?.manifest.motionSkill);
  const isReadOnly = Boolean(project && project.manifest.params.length === 0 && !isAtomicMotion);
  const canAutoplayPreview = shouldPreviewAutoplay(project?.manifest ?? null);
  const plusControls = useMemo(() => (project ? derivePlusControls(project.manifest) : []), [project]);
  const plusPatchResult = useMemo(
    () =>
      project
        ? compilePlusPatch({
            manifest: project.manifest,
            plusValues,
            baseValues: project.patch.values
          })
        : { values: {}, affectedParamIds: [] },
    [plusValues, project]
  );
  const activeParameterMode: ParameterMode =
    parameterMode === "plus" && plusControls.length === 0 ? "pro" : parameterMode;

  useLayoutEffect(() => {
    window.scrollTo({ left: 0, top: 0 });
  }, [project?.id]);

  useEffect(() => {
    setPlaybackState(canAutoplayPreview ? "playing" : "paused");
    setParameterMode(isAtomicMotion ? "plus" : "pro");
    setPlusValues({});
    setInspectorTab("info");
  }, [canAutoplayPreview, isAtomicMotion, project?.id]);

  function replayFromStart() {
    setPlaybackState("playing");
    setReplayToken((current) => current + 1);
    onReplay();
  }

  function resetInteractionPreview() {
    setPlaybackState("paused");
    setResetToken((current) => current + 1);
  }

  function updatePlusControl(controlId: PlusControlKind, value: PlusControlValue) {
    if (!project) return;

    const nextPlusValues = { ...plusValues, [controlId]: value };
    const compiled = compilePlusPatch({
      manifest: project.manifest,
      plusValues: nextPlusValues,
      baseValues: project.patch.values
    });

    setPlusValues(nextPlusValues);
    for (const paramId of compiled.affectedParamIds) {
      onParamChange(paramId, compiled.values[paramId]);
    }
  }

  function updateProParam(paramId: string, value: unknown) {
    setPlusValues({});
    onParamChange(paramId, value);
  }

  function resetAllParams() {
    setPlusValues({});
    onResetParams?.();
  }

  const shellClassName = variant === "modal" ? "editor-shell is-modal" : "editor-shell";
  const previewClassName = canAutoplayPreview ? "editor-preview" : "editor-preview is-interaction-preview";
  const readinessComponent: MotionComponent | null = project
    ? {
        id: project.manifest.id,
        name: project.manifest.name,
        category: "layout",
        tags: [],
        useCases: [],
        moods: [],
        manifest: project.manifest,
        source: project.source
      }
    : null;

  return (
    <main className={shellClassName}>
      <header className="editor-header">
        <button type="button" onClick={onBack}>
          {variant === "modal" ? "关闭" : "返回组件库"}
        </button>
        <div>
          <p className="eyebrow">{variant === "modal" ? "生成结果" : "参数编辑器"}</p>
          <h1>{project?.manifest.name ?? "组件编辑"}</h1>
        </div>
        {onDelete || onSave ? (
          <div className="editor-header-actions">
            {onDelete ? (
              <button
                className="editor-delete-button"
                type="button"
                aria-label={`删除 ${project?.manifest.name ?? "当前动效"}`}
                onClick={onDelete}
              >
                删除组件
              </button>
            ) : null}
            {onSave ? (
              <button className="primary-action editor-save-button" type="button" onClick={onSave}>
                {saveLabel}
              </button>
            ) : null}
          </div>
        ) : null}
      </header>
      <section className={previewClassName} aria-label="动效预览">
        <PreviewFrame
          source={project?.source ?? null}
          manifest={project?.manifest ?? null}
          patch={project?.patch ?? null}
          playbackState={playbackState}
          replayToken={replayToken}
          resetToken={resetToken}
        />
        <div className="preview-controls" aria-label="播放和导出控制">
          {canAutoplayPreview ? (
            <>
              <button
                type="button"
                onClick={() => setPlaybackState("playing")}
                disabled={playbackState === "playing"}
              >
                播放
              </button>
              <button
                type="button"
                onClick={() => setPlaybackState("paused")}
                disabled={playbackState === "paused"}
              >
                暂停
              </button>
              <button type="button" onClick={replayFromStart}>
                重播
              </button>
            </>
          ) : (
            <button className="preview-reset-button" type="button" onClick={resetInteractionPreview}>
              重置
            </button>
          )}
          <ExportPanel project={project} />
        </div>
      </section>
      <aside className="editor-inspector" aria-label="参数面板">
        {isReadOnly ? (
          <div className="read-only-notice">
            <p className="eyebrow">只读预览</p>
            <h2>暂不支持可视化编辑</h2>
            <p>该组件当前仅支持代码预览，暂无可调参数。你可以在预览区查看效果，或导出源码。</p>
          </div>
        ) : (
          <>
            <div className="inspector-tabs" role="tablist" aria-label="检查器内容分类">
              {inspectorTabs.map((tab) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={inspectorTab === tab.id}
                  className={inspectorTab === tab.id ? "is-active" : undefined}
                  key={tab.id}
                  onClick={() => setInspectorTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="inspector-tab-panel" role="tabpanel">
              {inspectorTab === "info" ? (
                <>
                  <ComponentInfoPanel project={project} />
                  {isAtomicMotion ? (
                    <AtomicMotionInspectorPanel
                      section="summary"
                      manifest={project?.manifest ?? null}
                      patch={project?.patch ?? null}
                      onChange={updateProParam}
                    />
                  ) : null}
                  <MotionRecipePanel
                    manifest={project?.manifest ?? null}
                    targetComponents={recipeTargetComponents}
                    {...(onApplyRecipeToTarget ? { onApplyToTarget: onApplyRecipeToTarget } : {})}
                  />
                </>
              ) : null}
              {inspectorTab === "params" ? (
                <>
                  {isAtomicMotion ? (
                    <AtomicMotionInspectorPanel
                      section="params"
                      manifest={project?.manifest ?? null}
                      patch={project?.patch ?? null}
                      onChange={updateProParam}
                      {...(onResetParams ? { onReset: resetAllParams } : {})}
                    />
                  ) : (
                    <>
                      <div className="panel-header">
                        <p className="eyebrow">参数调节</p>
                        <h2>{activeParameterMode === "plus" ? "简化控制" : "可调参数"}</h2>
                      </div>
                      <ParameterModeTabs
                        mode={activeParameterMode}
                        plusDisabled={plusControls.length === 0}
                        onChange={setParameterMode}
                      />
                      {activeParameterMode === "plus" ? (
                        <PlusControlPanel
                          controls={plusControls}
                          values={plusValues}
                          affectedParamIds={plusPatchResult.affectedParamIds}
                          onChange={updatePlusControl}
                          {...(onResetParams ? { onReset: resetAllParams } : {})}
                        />
                      ) : (
                        <ParameterPanel
                          manifest={project?.manifest ?? null}
                          patch={project?.patch ?? null}
                          onChange={updateProParam}
                          {...(onResetParams ? { onReset: resetAllParams } : {})}
                        />
                      )}
                    </>
                  )}
                </>
              ) : null}
              {inspectorTab === "layers" ? (
                <LayerReplacementPanel
                  manifest={project?.manifest ?? null}
                  patch={project?.patch ?? null}
                  onChange={updateProParam}
                  {...(onResetParamIds ? { onReset: onResetParamIds } : {})}
                />
              ) : null}
              {inspectorTab === "related" ? <ReadinessDiagnosisPanel component={readinessComponent} /> : null}
            </div>
          </>
        )}
      </aside>
    </main>
  );
}
