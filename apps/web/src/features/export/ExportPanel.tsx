import JSZip from "jszip";
import { composeEditablePackageFiles, composeStandaloneHtmlFile } from "@motion-tool/core";
import type { MotionProject } from "../../state/projectStore";

type Props = {
  project: MotionProject | null;
};

export function ExportPanel({ project }: Props) {
  function sourceFilesForProject(project: MotionProject): Record<string, string> {
    return Object.fromEntries(project.source.files.map((file) => [file.path, file.content]));
  }

  function exportSingleHtml() {
    if (!project) return;

    const html = composeStandaloneHtmlFile({
      sourceFiles: sourceFilesForProject(project),
      manifest: project.manifest,
      patch: project.patch
    });
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.id}.html`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function exportProjectZip() {
    if (!project) return;

    const files = composeEditablePackageFiles({
      sourceFiles: sourceFilesForProject(project),
      manifest: project.manifest,
      metadata: {
        id: project.id,
        name: project.manifest.name,
        sourceKind: project.manifest.sourceKind
      },
      patch: project.patch
    });
    const zip = new JSZip();

    for (const [path, content] of Object.entries(files)) {
      zip.file(path, content);
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.id}.zip`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="export-actions compact" aria-label="导出选项">
      <button className="secondary-action" type="button" disabled={!project} onClick={exportSingleHtml}>
        导出 HTML
      </button>
      <button className="primary-action" type="button" disabled={!project} onClick={() => void exportProjectZip()}>
        导出 ZIP 工程
      </button>
    </div>
  );
}
