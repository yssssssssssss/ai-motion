import type { ZeroLayerAsset, ZeroLayerNode } from "./schema";

export type ZeroLayerPaintStyle = {
  background?: string;
  color?: string;
  border?: string;
  boxShadow?: string;
  filter?: string;
  rotation?: number;
  blendMode?: string;
};

function solidColor(color: string, opacity: number | undefined): string {
  if (opacity == null || opacity >= 1) return color;
  if (opacity <= 0) return "transparent";
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return color;
  const hex = match[1]!;
  return `rgba(${Number.parseInt(hex.slice(0, 2), 16)},${Number.parseInt(hex.slice(2, 4), 16)},${Number.parseInt(
    hex.slice(4, 6),
    16
  )},${opacity})`;
}

function cssUrl(url: string): string {
  return `url(${JSON.stringify(url)})`;
}

function backgroundLayer(
  fill: NonNullable<ZeroLayerNode["fills"]>[number],
  assets: Map<string, ZeroLayerAsset>
): string | undefined {
  if (fill.type === "solid") {
    const color = solidColor(fill.color, fill.opacity);
    return `linear-gradient(${color},${color})`;
  }
  if (fill.type === "gradient") return fill.css;
  if (fill.type === "image" && fill.assetId) {
    const asset = assets.get(fill.assetId);
    return asset ? `${cssUrl(asset.url)} center/cover no-repeat` : undefined;
  }
  return undefined;
}

function effectValues(node: ZeroLayerNode): { boxShadows: string[]; filters: string[] } {
  const boxShadows: string[] = [];
  const filters: string[] = [];
  for (const effect of node.effects ?? []) {
    const css = effect.css?.trim();
    if (!css) continue;
    if (css.startsWith("box-shadow:")) boxShadows.push(css.slice("box-shadow:".length).trim());
    if (css.startsWith("filter:")) filters.push(css.slice("filter:".length).trim());
  }
  return { boxShadows, filters };
}

/** Shared visual paint compilation for the Zero preview and standalone exporter. */
export function zeroLayerPaintStyle(
  node: ZeroLayerNode,
  assets: Map<string, ZeroLayerAsset>
): ZeroLayerPaintStyle {
  const fills = node.fills ?? [];
  const firstSolid = fills.find(
    (fill): fill is Extract<(typeof fills)[number], { type: "solid" }> => fill.type === "solid"
  );
  const background =
    node.kind === "text"
      ? undefined
      : fills.length === 1 && fills[0]?.type === "solid"
        ? solidColor(fills[0].color, fills[0].opacity)
        : fills
            .map((fill) => backgroundLayer(fill, assets))
            .filter(Boolean)
            .join(",");
  const strokes = node.strokes ?? [];
  const primaryStroke = strokes[0];
  const { boxShadows, filters } = effectValues(node);
  for (const stroke of strokes.slice(1)) {
    boxShadows.push(`inset 0 0 0 ${stroke.width ?? 1}px ${solidColor(stroke.color, stroke.opacity)}`);
  }
  return {
    ...(background ? { background } : {}),
    ...(node.kind === "text" && firstSolid
      ? { color: solidColor(firstSolid.color, firstSolid.opacity) }
      : {}),
    ...(primaryStroke
      ? {
          border: `${primaryStroke.width ?? 1}px solid ${solidColor(primaryStroke.color, primaryStroke.opacity)}`
        }
      : {}),
    ...(boxShadows.length ? { boxShadow: boxShadows.join(",") } : {}),
    ...(filters.length ? { filter: filters.join(" ") } : {}),
    ...(node.rotation ? { rotation: node.rotation } : {}),
    ...(node.blendMode && node.blendMode !== "normal" && node.blendMode !== "pass-through"
      ? { blendMode: node.blendMode }
      : {})
  };
}
