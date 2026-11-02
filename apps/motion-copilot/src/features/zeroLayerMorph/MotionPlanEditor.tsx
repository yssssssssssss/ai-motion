import { useState } from "react";
import {
  compileZeroLayerMotionComposition,
  normalizeMotionPlan,
  patchMotionPlanTrack,
  physicsFromPersonality,
  type MotionKeyframe,
  type MotionPhysics,
  type MotionTrackKind,
  type ZeroLayerMorphSource
} from "@motion-copilot/core";
import { generateZeroMotionPlanViaService } from "../../services/generateZeroMotionPlanClient";

type MotionPlanEditorProps = {
  source: ZeroLayerMorphSource;
  selectedNodeId?: string | undefined;
  onChange: (source: ZeroLayerMorphSource) => void;
};

const trackKindOptions: Array<{ value: MotionTrackKind; label: string }> = [
  { value: "morph", label: "形变" },
  { value: "enter", label: "进入" },
  { value: "exit", label: "退出" },
  { value: "emphasis", label: "强调" },
  { value: "path", label: "路径" }
];

const physicsOptions: Array<{ value: string; label: string; physics: MotionPhysics }> = [
  { value: "linear", label: "线性", physics: { type: "ease", curve: [0, 0, 1, 1] } },
  { value: "standard", label: "标准", physics: { type: "ease", curve: [0.35, 0, 0.25, 1] } },
  { value: "decelerate", label: "减速", physics: { type: "ease", curve: [0.18, 0.86, 0.22, 1] } },
  { value: "spring", label: "弹簧", physics: { type: "spring", stiffness: 170, damping: 14 } }
];

const keyframeFields: Array<{
  key: Exclude<keyof MotionKeyframe, "offset" | "easing">;
  label: string;
  step: string;
}> = [
  { key: "x", label: "X", step: "1" },
  { key: "y", label: "Y", step: "1" },
  { key: "width", label: "宽", step: "1" },
  { key: "height", label: "高", step: "1" },
  { key: "scale", label: "缩放", step: "0.01" },
  { key: "rotation", label: "旋转", step: "1" },
  { key: "opacity", label: "透明", step: "0.01" }
];

function physicsValue(physics: MotionPhysics | undefined): string {
  if (physics?.type === "spring") return "spring";
  return (
    physicsOptions.find(
      (option) =>
        option.physics.type === "ease" &&
        physics?.type === "ease" &&
        option.physics.curve.every((value, index) => value === physics.curve[index])
    )?.value ?? "standard"
  );
}

function finiteNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function MotionPlanEditor({ source, selectedNodeId, onChange }: MotionPlanEditorProps) {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationMessage, setGenerationMessage] = useState<string | undefined>(undefined);
  const persistedPlan = normalizeMotionPlan(source.motionPlan);
  const fallbackDocument =
    persistedPlan.tracks.length > 0
      ? undefined
      : compileZeroLayerMotionComposition({
          from: source.from,
          to: source.to,
          bindingResult: source.bindingResult,
          ...(source.diagnosticReport ? { diagnosticReport: source.diagnosticReport } : {})
        }).document;
  const fallbackPlan =
    fallbackDocument?.visualSource?.kind === "zero-layer-morph"
      ? fallbackDocument.visualSource.motionPlan
      : undefined;
  const plan = persistedPlan.tracks.length > 0 ? persistedPlan : normalizeMotionPlan(fallbackPlan);
  const track =
    plan.tracks.find((item) => item.nodeId === selectedNodeId) ??
    plan.tracks.find((item) => item.layerId === selectedNodeId) ??
    plan.tracks[0];
  if (!track) return null;

  const first = track.keyframes[0]!;
  const last = track.keyframes.at(-1)!;
  const update = (patch: Parameters<typeof patchMotionPlanTrack>[2]) => {
    onChange({ ...source, motionPlan: patchMotionPlanTrack(plan, track.layerId, patch) });
  };
  const updateKeyframe = (
    endpoint: "first" | "last",
    key: Exclude<keyof MotionKeyframe, "offset" | "easing">,
    value: number
  ) => {
    const keyframes = track.keyframes.map((frame, index, frames) =>
      (endpoint === "first" ? index === 0 : index === frames.length - 1) ? { ...frame, [key]: value } : frame
    );
    update({ keyframes });
  };
  const personality = track.personality ?? { energy: 0.5, bounce: 0.3, sharpness: 0.5 };
  const generateFromPrompt = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    const result = await generateZeroMotionPlanViaService({ prompt, source });
    setGenerationMessage(result.message);
    if (result.mode === "llm") onChange({ ...source, motionPlan: result.motionPlan });
    setIsGenerating(false);
  };

  return (
    <section className="motion-plan-editor" aria-label="单轨动效编辑器">
      <div className="motion-plan-editor-header">
        <div>
          <p className="eyebrow">单轨动效</p>
          <strong>{track.layerId}</strong>
        </div>
        <span>{track.source === "user" ? "已编辑" : "规则生成"}</span>
      </div>
      <div className="motion-plan-generate">
        <input
          aria-label="AI 动效意图"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="例如：更轻快地展开，重点突出内容"
        />
        <button
          type="button"
          className="small-action"
          disabled={isGenerating || !prompt.trim()}
          onClick={() => void generateFromPrompt()}
        >
          {isGenerating ? "编排中…" : "AI 编排"}
        </button>
      </div>
      {generationMessage ? <p className="motion-plan-generation-message">{generationMessage}</p> : null}
      <div className="field-row">
        <label className="field">
          <span>类型</span>
          <select
            value={track.kind}
            onChange={(event) => update({ kind: event.target.value as MotionTrackKind })}
          >
            {trackKindOptions.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>曲线</span>
          <select
            value={physicsValue(track.physics)}
            onChange={(event) =>
              update({
                physics: physicsOptions.find((option) => option.value === event.target.value)!.physics
              })
            }
          >
            {physicsOptions.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          <span>延迟 ms</span>
          <input
            aria-label="动效延迟 ms"
            type="number"
            min="0"
            step="10"
            value={track.timing.delayMs}
            onChange={(event) =>
              update({
                timing: {
                  ...track.timing,
                  delayMs: Math.max(0, finiteNumber(event.target.value, track.timing.delayMs))
                }
              })
            }
          />
        </label>
        <label className="field">
          <span>时长 ms</span>
          <input
            aria-label="动效时长 ms"
            type="number"
            min="1"
            step="10"
            value={track.timing.durationMs}
            onChange={(event) =>
              update({
                timing: {
                  ...track.timing,
                  durationMs: Math.max(1, finiteNumber(event.target.value, track.timing.durationMs))
                }
              })
            }
          />
        </label>
      </div>
      <div className="motion-plan-keyframes">
        <div className="motion-plan-keyframes-header">
          <span>关键帧</span>
          <strong>起始</strong>
          <strong>结束</strong>
        </div>
        {keyframeFields.map(({ key, label, step }) => (
          <div className="motion-plan-keyframe-row" key={key}>
            <span>{label}</span>
            <input
              aria-label={`起始 ${label}`}
              type="number"
              step={step}
              value={first[key] ?? (key === "scale" || key === "opacity" ? 1 : 0)}
              onChange={(event) =>
                updateKeyframe("first", key, finiteNumber(event.target.value, first[key] ?? 0))
              }
            />
            <input
              aria-label={`结束 ${label}`}
              type="number"
              step={step}
              value={last[key] ?? (key === "scale" || key === "opacity" ? 1 : 0)}
              onChange={(event) =>
                updateKeyframe("last", key, finiteNumber(event.target.value, last[key] ?? 0))
              }
            />
          </div>
        ))}
      </div>
      <div className="motion-plan-personality">
        {(["energy", "bounce", "sharpness"] as const).map((key) => (
          <label className="field" key={key}>
            <span>{key === "energy" ? "能量" : key === "bounce" ? "回弹" : "利落"}</span>
            <input
              aria-label={`动效${key}`}
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={personality[key]}
              disabled={track.physics?.type === "spring" ? key === "sharpness" : key !== "sharpness"}
              onChange={(event) => {
                const next = { ...personality, [key]: finiteNumber(event.target.value, personality[key]) };
                update({
                  personality: next,
                  physics: physicsFromPersonality(track.physics?.type ?? "ease", next),
                  keyframes: track.keyframes.map(({ easing: _easing, ...frame }) => frame)
                });
              }}
            />
            {(track.physics?.type === "spring" ? key === "sharpness" : key !== "sharpness") ? (
              <small>{key === "sharpness" ? "仅适用于缓动曲线" : "仅适用于弹簧曲线"}</small>
            ) : null}
          </label>
        ))}
      </div>
    </section>
  );
}
