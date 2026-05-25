import { ParameterPanel } from "../features/editor/ParameterPanel";
import { PreviewFrame } from "../features/editor/PreviewFrame";
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
        />
      </section>
      <aside className="editor-inspector" aria-label="参数面板">
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
      </aside>
      <footer className="transport" aria-label="播放和导出控制">
        <button type="button" onClick={onReplay}>
          重播
        </button>
        <ExportPanel project={project} />
      </footer>
    </main>
  );
}
