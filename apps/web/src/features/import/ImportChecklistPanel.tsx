type ImportPhase = "idle" | "confirm-params" | "confirm-layers" | "fill-metadata";

export type ImportChecklistItem = {
  id: "preview-playable" | "layers-recognized" | "params-confirmed" | "spec-selected";
  label: string;
  done: boolean;
};

export function importChecklistItems(input: {
  phase: ImportPhase;
  hasPreview: boolean;
  layerCount: number;
  confirmedParamCount: number;
  selectedDesignSpecId: string | null;
}): ImportChecklistItem[] {
  return [
    { id: "preview-playable", label: "预览可播放", done: input.hasPreview },
    { id: "layers-recognized", label: "图层可识别", done: input.layerCount > 0 },
    {
      id: "params-confirmed",
      label: "参数已确认",
      done: input.confirmedParamCount > 0 && input.phase !== "idle"
    },
    { id: "spec-selected", label: "规范已选择", done: Boolean(input.selectedDesignSpecId) }
  ];
}

export function ImportChecklistPanel(props: {
  phase: ImportPhase;
  hasPreview: boolean;
  layerCount: number;
  confirmedParamCount: number;
  selectedDesignSpecId: string | null;
}) {
  const items = importChecklistItems(props);

  return (
    <section className="import-checklist" aria-label="入库检查清单">
      <h3>入库检查清单</h3>
      <div className="import-checklist__items">
        {items.map((item) => (
          <span className={item.done ? "is-done" : undefined} key={item.id}>
            {item.label}
            <small>{item.done ? "已确认" : "待确认"}</small>
          </span>
        ))}
      </div>
    </section>
  );
}
