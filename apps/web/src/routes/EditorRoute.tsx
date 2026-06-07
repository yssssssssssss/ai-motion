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
import { LayerReplacementPanel } from "../features/editor/LayerReplacementPanel";
import { MotionRecipePanel } from "../features/editor/MotionRecipePanel";
import { ReadinessDiagnosisPanel } from "../features/editor/ReadinessDiagnosisPanel";
import { PreviewFrame, type PreviewPlaybackState } from "../features/editor/PreviewFrame";
import { ExportPanel } from "../features/export/ExportPanel";
import type { MotionProject } from "../state/projectStore";

type EditorRouteProps = {
  project: MotionProject | null;
  onBack: () => void;
  onParamChange: (paramId: string, value: unknown) => void;
  onReplay: () => void;
  onResetParams?: () => void;
  variant?: "page" | "modal";
  onSave?: () => void;
  saveLabel?: string;
  recipeTargetComponents?: MotionComponent[];
  onApplyRecipeToTarget?: (targetComponentId: string, targetLayerId: string) => void;
};

export function EditorRoute({
  project,
  onBack,
  onParamChange,
  onReplay,
  onResetParams,
  variant = "page",
  onSave,
  saveLabel = "保存组件",
  recipeTargetComponents = [],
  onApplyRecipeToTarget
}: EditorRouteProps) {
  const [playbackState, setPlaybackState] = useState<PreviewPlaybackState>("playing");
  const [parameterMode, setParameterMode] = useState<ParameterMode>("plus");
  const [plusValues, setPlusValues] = useState<PlusPatchValues>({});
  const [replayToken, setReplayToken] = useState(0);
  const isReadOnly = Boolean(project && project.manifest.params.length === 0);
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
    setPlaybackState("playing");
    setParameterMode("plus");
    setPlusValues({});
  }, [project?.id]);

  function replayFromStart() {
    setPlaybackState("playing");
    setReplayToken((current) => current + 1);
    onReplay();
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
        {onSave ? (
          <button className="primary-action editor-save-button" type="button" onClick={onSave}>
            {saveLabel}
          </button>
        ) : null}
      </header>
      <section className="editor-preview" aria-label="动效预览">
        <PreviewFrame
          source={project?.source ?? null}
          manifest={project?.manifest ?? null}
          patch={project?.patch ?? null}
          playbackState={playbackState}
          replayToken={replayToken}
        />
        <div className="preview-controls" aria-label="播放和导出控制">
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
            <div className="panel-header">
              <p className="eyebrow">参数调节</p>
              <h2>{activeParameterMode === "plus" ? "简化控制" : "可调参数"}</h2>
            </div>
            <ParameterModeTabs
              mode={activeParameterMode}
              plusDisabled={plusControls.length === 0}
              onChange={setParameterMode}
            />
            <MotionRecipePanel
              manifest={project?.manifest ?? null}
              targetComponents={recipeTargetComponents}
              {...(onApplyRecipeToTarget ? { onApplyToTarget: onApplyRecipeToTarget } : {})}
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
            <LayerReplacementPanel
              manifest={project?.manifest ?? null}
              patch={project?.patch ?? null}
              onChange={updateProParam}
            />
            <ReadinessDiagnosisPanel
              component={
                project
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
                  : null
              }
            />
          </>
        )}
      </aside>
    </main>
  );
}
