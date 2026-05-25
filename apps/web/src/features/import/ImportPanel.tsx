type Props = {
  onImport: (files: Record<string, string>) => void;
};

export function ImportPanel({ onImport }: Props) {
  const inputId = "motion-source-file-input";

  async function handleFiles(fileList: FileList | null) {
    if (!fileList) return;

    const entries: Record<string, string> = {};
    for (const file of Array.from(fileList)) {
      entries[file.name] = await file.text();
    }

    onImport(entries);
  }

  return (
    <section className="tool-section" id="import">
      <h2>导入动效</h2>
      <input
        id={inputId}
        className="file-input"
        type="file"
        multiple
        onChange={(event) => void handleFiles(event.target.files)}
      />
      <label className="secondary-action file-import-button" htmlFor={inputId}>
        选择文件
      </label>
    </section>
  );
}
