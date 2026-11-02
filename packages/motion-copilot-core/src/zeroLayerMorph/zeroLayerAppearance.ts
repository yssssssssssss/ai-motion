import type { ZeroLayerAsset, ZeroLayerNode, ZeroLayerNodeOverride } from "./schema";

export const ZERO_LAYER_SKIN_CROSSFADE = {
  start: 0.4,
  end: 0.6
} as const;

export type ZeroLayerSkinMix = {
  from: number;
  to: number;
};

export type ZeroLayerRenderFrame = "from" | "to";

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Returns complementary skin weights for a matched layer's local track progress. */
export function sampleZeroLayerSkinMix(progress: number): ZeroLayerSkinMix {
  const { start, end } = ZERO_LAYER_SKIN_CROSSFADE;
  const to = clamp((progress - start) / (end - start));
  return { from: 1 - to, to };
}

/** Applies the persisted editor override used by preview, export, reports, and recommendation scoring. */
export function resolveZeroLayerNodeOverride(
  node: ZeroLayerNode,
  overrides: ZeroLayerNodeOverride[] | undefined,
  frame: ZeroLayerRenderFrame
): ZeroLayerNode {
  const override = overrides?.find(
    (item) => item.nodeId === node.nodeId && (item.frame === frame || item.frame === "both")
  );
  if (!override) return node;
  return {
    ...node,
    bounds: {
      x: override.x ?? node.bounds.x,
      y: override.y ?? node.bounds.y,
      w: override.width ?? node.bounds.w,
      h: override.height ?? node.bounds.h
    },
    opacity: override.opacity ?? node.opacity,
    ...(override.cornerRadius != null ? { cornerRadius: override.cornerRadius } : {})
  };
}

/** Discrete appearance changes need two skins; geometry, alpha, radius, and rotation do not. */
export function zeroLayerAppearanceDiffers(
  from: ZeroLayerNode,
  to: ZeroLayerNode,
  fromAssets: ReadonlyMap<string, ZeroLayerAsset>,
  toAssets: ReadonlyMap<string, ZeroLayerAsset>
): boolean {
  const fromAsset = from.assetId ? fromAssets.get(from.assetId) : undefined;
  const toAsset = to.assetId ? toAssets.get(to.assetId) : undefined;
  if ((fromAsset?.type ?? from.assetId) !== (toAsset?.type ?? to.assetId)) return true;
  if ((fromAsset?.url ?? from.assetId) !== (toAsset?.url ?? to.assetId)) return true;
  if (from.kind !== to.kind || from.text !== to.text) return true;
  if (from.renderMode !== to.renderMode || from.blendMode !== to.blendMode) return true;
  const paintSignature = (node: ZeroLayerNode, assets: ReadonlyMap<string, ZeroLayerAsset>) =>
    JSON.stringify([
      node.fills?.map((fill) =>
        fill.type === "image" && fill.assetId
          ? { ...fill, assetUrl: assets.get(fill.assetId)?.url ?? null }
          : fill
      ),
      node.strokes,
      node.effects,
      node.textStyle
    ]);
  return paintSignature(from, fromAssets) !== paintSignature(to, toAssets);
}
