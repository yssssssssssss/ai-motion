import { useEffect, useLayoutEffect, useState } from "react";
import { ParameterPanel } from "../features/editor/ParameterPanel";
import { PreviewFrame, type PreviewPlaybackState } from "../features/editor/PreviewFrame";
import { ExportPanel } from "../features/export/ExportPanel";
import type { MotionProject } from "../state/projectStore";

type EditorRouteProps = {
  project: MotionProject | null;
  onBack: () => void;
  onParamChange: (paramId: string, value: unknown) => void;
  onReplay: () => void;
  onResetParams?: () => void;
};

export function EditorRoute({ project, onBack, onParamChange, onReplay, onResetParams }: EditorRouteProps) {
  const [playbackState, setPlaybackState] = useState<PreviewPlaybackState>("playing");
  const isReadOnly = Boolean(project && project.manifest.params.length === 0);

  useLayoutEffect(() => {
    window.scrollTo({ left: 0, top: 0 });
  }, [project?.id]);

  useEffect(() => {
    setPlaybackState("playing");
  }, [project?.id]);

  function replayFromStart() {
    setPlaybackState("playing");
    onReplay();
  }

  return (
    <main className="editor-shell">
      <header className="editor-header">
        <button type="button" onClick={onBack}>
          返回组件库
        </button>
        <div>
          <p className="eyebrow">参数编辑器</p>
          <h1>{project?.manifest.name ?? "组件编辑"}</h1>
        </div>
      </header>
      <section className="editor-preview" aria-label="动效预览">
        <PreviewFrame
          source={project?.source ?? null}
          manifest={project?.manifest ?? null}
          patch={project?.patch ?? null}
          playbackState={playbackState}
        />
        <div className="preview-controls" aria-label="播放和导出控制">
          <button type="button" onClick={() => setPlaybackState("playing")} disabled={playbackState === "playing"}>
            播放
          </button>
          <button type="button" onClick={() => setPlaybackState("paused")} disabled={playbackState === "paused"}>
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
              <h2>可调参数</h2>
            </div>
            <ParameterPanel
              manifest={project?.manifest ?? null}
              patch={project?.patch ?? null}
              onChange={onParamChange}
              {...(onResetParams ? { onReset: onResetParams } : {})}
            />
          </>
        )}
      </aside>
    </main>
  );
}
