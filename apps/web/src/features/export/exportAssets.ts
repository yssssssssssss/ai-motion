import type { MotionProject } from "../../state/projectStore";

function isExternalAssetReference(content: string): boolean {
  return /^(?:\/assets\/|\/@fs\/|https?:\/\/)/.test(content);
}

export async function sourceFilesForExport(project: MotionProject): Promise<Record<string, string>> {
  const entries = await Promise.all(
    project.source.files.map(async (file) => {
      if (!isExternalAssetReference(file.content)) return [file.path, file.content] as const;

      const response = await fetch(file.content);
      if (!response.ok) {
        throw new Error(`Failed to load external asset: ${file.path}`);
      }
      return [file.path, await response.text()] as const;
    })
  );

  return Object.fromEntries(entries);
}
