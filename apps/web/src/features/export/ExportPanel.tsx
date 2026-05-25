import { composeStandaloneHtmlFile } from "@motion-tool/core";
import type { MotionProject } from "../../state/projectStore";

type Props = {
  project: MotionProject | null;
};

export function ExportPanel({ project }: Props) {
  function exportHtml() {
    if (!project) return;

    const sourceFiles = Object.fromEntries(project.source.files.map((file) => [file.path, file.content]));
    const html = composeStandaloneHtmlFile({
      sourceFiles,
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

  return (
    <button className="primary-action compact" type="button" disabled={!project} onClick={exportHtml}>
      导出 HTML 工程
    </button>
  );
}
