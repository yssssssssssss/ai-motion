import type { MotionParam } from "@motion-tool/core";

type Props = {
  params: MotionParam[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onConfirm: () => void;
};

const PARAM_TYPE_LABELS: Record<MotionParam["type"], string> = {
  color: "颜色",
  duration: "时长",
  easing: "缓动",
  image: "图片",
  number: "数字",
  position: "位置",
  range: "范围",
  select: "选项",
  text: "文本",
  toggle: "开关",
  transform: "变换"
};

export function paramTypeLabel(type: MotionParam["type"]): string {
  return PARAM_TYPE_LABELS[type];
}

export function ConfirmParamsPanel({ params, selected, onToggle, onConfirm }: Props) {
  if (params.length === 0) return null;

  return (
    <section className="tool-section">
      <h2>确认可调参数</h2>
      <div className="field-list">
        {params.map((param) => (
          <label className="check-field" key={param.id}>
            <input type="checkbox" checked={selected.has(param.id)} onChange={() => onToggle(param.id)} />
            <span>
              {param.label} <small>{paramTypeLabel(param.type)}</small>
            </span>
          </label>
        ))}
      </div>
      <button className="secondary-action" type="button" onClick={onConfirm}>
        使用已选参数
      </button>
    </section>
  );
}
