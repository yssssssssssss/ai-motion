import { designSpecSkills } from "@motion-tool/core";

type Props = {
  value: string | null;
  onChange: (value: string | null) => void;
};

export function DesignSpecSelect({ value, onChange }: Props) {
  return (
    <label className="select-field">
      <span>设计规范 Skill</span>
      <select value={value ?? ""} onChange={(event) => onChange(event.target.value || null)}>
        <option value="">暂不选择</option>
        {designSpecSkills.map((skill) => (
          <option key={skill.id} value={skill.id}>
            {skill.label}
          </option>
        ))}
      </select>
    </label>
  );
}
