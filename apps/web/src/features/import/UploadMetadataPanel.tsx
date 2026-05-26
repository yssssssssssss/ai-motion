import { useState } from "react";
import type { MotionComponentMetadata } from "@motion-tool/core";

type Props = {
  onSubmit: (metadata: MotionComponentMetadata) => void;
  onCancel: () => void;
};

const CATEGORIES: MotionComponentMetadata["category"][] = [
  "text",
  "media",
  "layout",
  "interaction",
  "background",
  "data"
];

const CATEGORY_LABELS: Record<MotionComponentMetadata["category"], string> = {
  text: "文字",
  media: "媒体",
  layout: "布局",
  interaction: "交互",
  background: "背景",
  data: "数据"
};

export function UploadMetadataPanel({ onSubmit, onCancel }: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<MotionComponentMetadata["category"]>("interaction");
  const [tagsInput, setTagsInput] = useState("");

  function handleSubmit() {
    if (!name.trim()) return;
    const tags = tagsInput
      .split(/[,，\s]+/)
      .map((tag) => tag.trim())
      .filter(Boolean);
    onSubmit({
      id: `uploaded-${Date.now()}`,
      name: name.trim(),
      category,
      tags,
      useCases: [],
      moods: []
    });
  }

  return (
    <section className="tool-section">
      <h2>补充案例信息</h2>
      <div className="field-list">
        <label className="text-field">
          <span>名称</span>
          <input
            type="text"
            value={name}
            placeholder="给你的案例起个名字"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="select-field">
          <span>分类</span>
          <select value={category} onChange={(event) => setCategory(event.target.value as MotionComponentMetadata["category"])}>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-field">
          <span>标签</span>
          <input
            type="text"
            value={tagsInput}
            placeholder="用逗号分隔，如：按钮，hover，营销"
            onChange={(event) => setTagsInput(event.target.value)}
          />
        </label>
      </div>
      <div className="action-row">
        <button className="primary-action" type="button" disabled={!name.trim()} onClick={handleSubmit}>
          入库
        </button>
        <button className="secondary-action" type="button" onClick={onCancel}>
          取消
        </button>
      </div>
    </section>
  );
}