import { useState } from "react";
import type { MotionComponentMetadata } from "@motion-tool/core";

type Props = {
  initialMetadata?: MotionComponentMetadata | undefined;
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

export function createUploadMetadata(input: {
  name: string;
  category: MotionComponentMetadata["category"];
  tagsInput: string;
  initialMetadata?: MotionComponentMetadata | undefined;
  createId?: () => string;
}): MotionComponentMetadata {
  const tags = input.tagsInput
    .split(/[,，\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);

  return {
    id: input.createId ? input.createId() : `uploaded-${Date.now()}`,
    name: input.name.trim(),
    category: input.category,
    tags,
    useCases: input.initialMetadata?.useCases ?? [],
    moods: input.initialMetadata?.moods ?? []
  };
}

export function UploadMetadataPanel({ initialMetadata, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initialMetadata?.name ?? "");
  const [category, setCategory] = useState<MotionComponentMetadata["category"]>(
    initialMetadata?.category ?? "interaction"
  );
  const [tagsInput, setTagsInput] = useState(initialMetadata?.tags.join("，") ?? "");

  function handleSubmit() {
    if (!name.trim()) return;
    onSubmit(createUploadMetadata({ name, category, tagsInput, initialMetadata }));
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
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as MotionComponentMetadata["category"])}
          >
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
