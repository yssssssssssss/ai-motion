import type { MotionLayer, MotionLayerKind } from "@motion-tool/core";

type Props = {
  layers: MotionLayer[];
  selectedReplaceableLayerIds: Set<string>;
  onToggle: (id: string) => void;
  onConfirm: () => void;
};

const LAYER_KIND_LABELS: Record<MotionLayerKind, string> = {
  image: "图片层",
  text: "文案层",
  structure: "结构层"
};

export function layerKindLabel(kind: MotionLayerKind): string {
  return LAYER_KIND_LABELS[kind];
}

export function ConfirmLayersPanel({ layers, selectedReplaceableLayerIds, onToggle, onConfirm }: Props) {
  return (
    <section className="tool-section">
      <h2>确认可替换图层</h2>
      {layers.length > 0 ? (
        <div className="field-list">
          {layers.map((layer) => (
            <label className="check-field" key={layer.id}>
              <input
                type="checkbox"
                checked={selectedReplaceableLayerIds.has(layer.id)}
                onChange={() => onToggle(layer.id)}
              />
              <span>
                {layer.label} <small>{layerKindLabel(layer.kind)}</small>
              </span>
            </label>
          ))}
        </div>
      ) : (
        <p className="muted">未识别到候选图层，后续仍可作为参数化组件入库。</p>
      )}
      <button className="secondary-action" type="button" onClick={onConfirm}>
        {layers.length > 0 ? "使用已确认图层" : "继续入库"}
      </button>
    </section>
  );
}
