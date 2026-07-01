import { useEffect, useMemo, useState } from "react";
import type { MotionComponent, MotionManifest } from "@motion-tool/core";
import { isNonAtomicMotionComponent } from "../../services/componentScope";

type Props = {
  manifest: MotionManifest | null;
  targetComponents?: MotionComponent[];
  onApplyToTarget?: (targetComponentId: string, targetLayerId: string) => void;
};

const categoryLabels: Record<string, string> = {
  entrance: "入场",
  feedback: "反馈",
  transition: "转场",
  loop: "循环"
};

const triggerLabels: Record<string, string> = {
  load: "加载",
  hover: "悬停",
  click: "点击",
  loop: "循环",
  swipe: "滑动"
};

function layerLabels(manifest: MotionManifest, layerIds: string[]): string {
  const labels = layerIds.flatMap((id) => {
    const layer = manifest.layers?.find((item) => item.id === id);
    return layer ? [layer.label] : [];
  });
  return labels.length > 0 ? labels.join(" / ") : "未绑定图层";
}

function replaceableLayers(component: MotionComponent) {
  const layers = component.manifest.layers ?? [];
  const paramBoundLayers = layers.filter((layer) => layer.replaceable && layer.paramId);
  return paramBoundLayers.length > 0 ? paramBoundLayers : layers.filter((layer) => layer.replaceable);
}

export function MotionRecipePanel({ manifest, targetComponents = [], onApplyToTarget }: Props) {
  const recipes = manifest?.motionRecipes ?? [];
  const eligibleTargets = useMemo(
    () =>
      targetComponents.filter(
        (component) => isNonAtomicMotionComponent(component) && replaceableLayers(component).length > 0
      ),
    [targetComponents]
  );
  const [targetComponentId, setTargetComponentId] = useState(eligibleTargets[0]?.id ?? "");
  const activeTarget = eligibleTargets.find((component) => component.id === targetComponentId) ?? eligibleTargets[0];
  const layers = activeTarget ? replaceableLayers(activeTarget) : [];
  const [targetLayerId, setTargetLayerId] = useState(layers[0]?.id ?? "");
  const activeLayerId = layers.some((layer) => layer.id === targetLayerId) ? targetLayerId : (layers[0]?.id ?? "");
  useEffect(() => {
    if (!eligibleTargets.length) return;
    const nextTarget = eligibleTargets.find((component) => component.id === targetComponentId) ?? eligibleTargets[0];
    if (!nextTarget) return;
    if (nextTarget.id !== targetComponentId) setTargetComponentId(nextTarget.id);
    const nextLayers = replaceableLayers(nextTarget);
    if (!nextLayers.some((layer) => layer.id === targetLayerId)) {
      setTargetLayerId(nextLayers[0]?.id ?? "");
    }
  }, [eligibleTargets, targetComponentId, targetLayerId]);
  if (!manifest || recipes.length === 0) return null;

  return (
    <section className="motion-recipe-panel" aria-label="动效 Recipe">
      <div className="panel-header compact-panel-header">
        <p className="eyebrow">Motion Recipe</p>
        <h2>可迁移动效</h2>
      </div>
      <div className="motion-recipe-list">
        {recipes.map((recipe) => (
          <article className="motion-recipe-item" key={recipe.recipeId}>
            <header>
              <strong>{recipe.recipeName ?? recipe.recipeId}</strong>
              <span>{categoryLabels[recipe.category ?? ""] ?? recipe.category ?? "动效"}</span>
            </header>
            <dl>
              <div>
                <dt>触发</dt>
                <dd>{triggerLabels[recipe.trigger] ?? recipe.trigger}</dd>
              </div>
              <div>
                <dt>目标图层</dt>
                <dd>{layerLabels(manifest, recipe.targetLayerIds)}</dd>
              </div>
              <div>
                <dt>参数</dt>
                <dd>{recipe.paramIds.length} 个</dd>
              </div>
              <div>
                <dt>来源</dt>
                <dd>{recipe.source ?? "builtin"}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      {onApplyToTarget && eligibleTargets.length > 0 ? (
        <div className="motion-recipe-apply">
          <strong>将此动效应用到其他组件</strong>
          <label>
            <span>目标组件</span>
            <select
              value={activeTarget?.id ?? ""}
              onChange={(event) => {
                const nextComponentId = event.target.value;
                const nextComponent = eligibleTargets.find((component) => component.id === nextComponentId);
                const fallbackComponent = eligibleTargets[0];
                setTargetComponentId(nextComponentId);
                const selectedComponent = nextComponent ?? fallbackComponent;
                setTargetLayerId(selectedComponent ? replaceableLayers(selectedComponent).at(0)?.id ?? "" : "");
              }}
            >
              {eligibleTargets.map((component) => (
                <option value={component.id} key={component.id}>
                  {component.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>目标图层</span>
            <select value={activeLayerId} onChange={(event) => setTargetLayerId(event.target.value)}>
              {layers.map((layer) => (
                <option value={layer.id} key={layer.id}>
                  {layer.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="secondary-action"
            type="button"
            disabled={!activeTarget || !activeLayerId}
            onClick={() => {
              if (!activeTarget || !activeLayerId) return;
              onApplyToTarget(activeTarget.id, activeLayerId);
            }}
          >
            应用动效
          </button>
        </div>
      ) : null}
    </section>
  );
}
