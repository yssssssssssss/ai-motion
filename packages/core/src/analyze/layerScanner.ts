import type { MotionSource } from "../library/componentLibrary";
import type { MotionLayer, MotionLayerKind } from "../manifest/types";

function labelFromId(id: string): string {
  return id
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
}

function layerKind(id: string, tagName?: string): MotionLayerKind {
  if (
    tagName === "h1" ||
    tagName === "h2" ||
    tagName === "p" ||
    /(headline|title|text|copy|label)/i.test(id)
  ) {
    return "text";
  }
  if (tagName === "img" || /(image|poster|frame|screen|card|media|popup|shell|content)/i.test(id)) {
    return "image";
  }
  return "structure";
}

function isLayerToken(token: string): boolean {
  if (token.length < 3 || token.length > 48) return false;
  if (/^(active|hidden|visible|root|main)$/i.test(token)) return false;
  return /(layer|frame|card|screen|poster|image|media|popup|shell|content|headline|title)/i.test(token);
}

function upsertLayer(layers: Map<string, MotionLayer>, layer: MotionLayer): void {
  if (!layers.has(layer.id)) layers.set(layer.id, layer);
}

function scanHtmlLayers(source: MotionSource, layers: Map<string, MotionLayer>): void {
  for (const file of source.files.filter((item) => item.kind === "html")) {
    for (const match of file.content.matchAll(
      /<([a-z0-9-]+)\b[^>]*\bdata-motion-layer=["']([^"']+)["'][^>]*>/gi
    )) {
      const tagName = match[1]?.toLowerCase();
      const id = match[2]?.trim();
      if (!id) continue;

      upsertLayer(layers, {
        id,
        label: id,
        kind: layerKind(id, tagName),
        replaceable: true,
        required: false,
        targets: []
      });
    }

    for (const match of file.content.matchAll(/class=["']([^"']+)["']/g)) {
      const classList = match[1];
      if (!classList) continue;
      for (const className of classList.split(/\s+/).filter(isLayerToken)) {
        upsertLayer(layers, {
          id: className,
          label: labelFromId(className),
          kind: layerKind(className),
          replaceable: false,
          required: false,
          targets: []
        });
      }
    }
  }
}

function scanCssLayers(source: MotionSource, layers: Map<string, MotionLayer>): void {
  for (const file of source.files.filter((item) => item.kind === "css")) {
    for (const match of file.content.matchAll(
      /\.([A-Za-z_-][\w-]*)\s*{[^}]*background(?:-image)?:\s*var\(/g
    )) {
      const className = match[1];
      if (!className || !isLayerToken(className)) continue;

      upsertLayer(layers, {
        id: className,
        label: labelFromId(className),
        kind: layerKind(className),
        replaceable: false,
        required: false,
        targets: []
      });
    }
  }
}

export function scanSourceForLayers(source: MotionSource): MotionLayer[] {
  const layers = new Map<string, MotionLayer>();
  scanHtmlLayers(source, layers);
  scanCssLayers(source, layers);
  return [...layers.values()];
}
