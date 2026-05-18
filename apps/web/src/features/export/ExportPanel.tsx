import { composeEditablePackageFiles } from "@motion-tool/core";
import type { MotionProject } from "../../state/projectStore";

type Props = {
  project: MotionProject | null;
};

export function ExportPanel({ project }: Props) {
  function exportJson() {
    if (!project) return;

    const sourceFiles = Object.fromEntries(project.source.files.map((file) => [file.path, file.content]));
    const files = composeEditablePackageFiles({
      sourceFiles,
      manifest: project.manifest,
      metadata: { id: project.id, sourceId: project.source.id },
      patch: project.patch
    });
    const blob = new Blob([JSON.stringify(files, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.id}.motion-package.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button className="primary-action compact" type="button" disabled={!project} onClick={exportJson}>
      Export editable package
    </button>
  );
}
