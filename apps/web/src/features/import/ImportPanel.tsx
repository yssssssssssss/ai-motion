type Props = {
  onImport: (files: Record<string, string>) => void;
};

export function ImportPanel({ onImport }: Props) {
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
      <input type="file" multiple onChange={(event) => void handleFiles(event.target.files)} />
    </section>
  );
}
