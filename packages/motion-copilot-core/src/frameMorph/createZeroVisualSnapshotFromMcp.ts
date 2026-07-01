import { normalizeZeroVisualSnapshot } from "./normalizeZeroVisualSnapshot";
import type { Bounds, FrameElementKind, ZeroVisualAsset, ZeroVisualNode, ZeroVisualSnapshot } from "./schema";

export type ZeroMcpVisualSnapshotInput = {
  nodeId: string;
  designContext: unknown;
  designMetadata: unknown;
  screenshot: unknown;
};

type AssetDeclaration = {
  variable: string;
  url: string;
};

type MetadataNode = {
  nodeId: string;
  name: string;
  kind: FrameElementKind;
  bounds: Bounds;
  borderRadius?: number;
};

type ScreenshotInfo = {
  url: string;
  width?: number;
  height?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textFromMcpPayload(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (isRecord(item) && typeof item.text === "string") return item.text;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  if (isRecord(value)) {
    if (typeof value.text === "string") return value.text;
    if (Array.isArray(value.content)) return textFromMcpPayload(value.content);
    if (Array.isArray(value.result)) return textFromMcpPayload(value.result);
  }
  return "";
}

function screenshotInfoFromMcpPayload(value: unknown): ScreenshotInfo {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^https?:\/\//.test(trimmed)) return { url: trimmed };
    try {
      return screenshotInfoFromMcpPayload(JSON.parse(trimmed) as unknown);
    } catch {
      const match = trimmed.match(/https?:\/\/[^\s"')]+/);
      return { url: match?.[0] ?? "" };
    }
  }
  if (Array.isArray(value)) {
    let textInfo: ScreenshotInfo | undefined;
    let imageUrl = "";
    for (const item of value) {
      if (isRecord(item) && typeof item.text === "string") {
        const next = screenshotInfoFromMcpPayload(item.text);
        if (next.url || next.width != null || next.height != null) textInfo = { ...(textInfo ?? { url: "" }), ...next };
      }
      if (
        isRecord(item) &&
        item.type === "image" &&
        typeof item.data === "string" &&
        item.data.trim().length > 0
      ) {
        const mimeType = typeof item.mimeType === "string" ? item.mimeType : "image/png";
        imageUrl = `data:${mimeType};base64,${item.data}`;
      }
    }
    if (imageUrl || textInfo) return { ...(textInfo ?? { url: "" }), ...(imageUrl ? { url: imageUrl } : {}) };
    return screenshotInfoFromMcpPayload(textFromMcpPayload(value));
  }
  if (isRecord(value)) {
    const url =
      typeof value.image_url === "string"
        ? value.image_url
        : typeof value.imageUrl === "string"
          ? value.imageUrl
          : "";
    if (url) {
      return {
        url,
        ...(typeof value.width === "number" && Number.isFinite(value.width) ? { width: value.width } : {}),
        ...(typeof value.height === "number" && Number.isFinite(value.height) ? { height: value.height } : {})
      };
    }
    if (Array.isArray(value.content)) {
      const fromText = screenshotInfoFromMcpPayload(textFromMcpPayload(value.content));
      const fromImage = screenshotInfoFromMcpPayload(value.content);
      const result: ScreenshotInfo = { ...fromText, ...fromImage };
      const width = fromText.width ?? fromImage.width;
      const height = fromText.height ?? fromImage.height;
      if (width != null) result.width = width;
      if (height != null) result.height = height;
      return result;
    }
  }
  return { url: "" };
}

function decodeHtmlEntities(value: string): string {
  return value
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function cssEscape(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}

function extractAssetDeclarations(context: string): AssetDeclaration[] {
  return [...context.matchAll(/\bconst\s+(\w+)\s*=\s*["']([^"']+)["']\s*;/g)].map((match) => ({
    variable: match[1] ?? "",
    url: match[2] ?? ""
  }));
}

function radiusByAssetUrl(declarations: AssetDeclaration[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const declaration of declarations) {
    const decoded = (() => {
      try {
        return decodeURIComponent(declaration.url);
      } catch {
        return declaration.url;
      }
    })();
    const match = decoded.match(/<rect\b[^>]*\brx="([^"]+)"/i);
    if (!match) continue;
    const radius = Number(match[1]);
    if (Number.isFinite(radius) && radius > 0) result.set(declaration.url, radius);
  }
  return result;
}

function extractReturnJsx(context: string): string {
  const start = context.indexOf("return (");
  if (start < 0) return "";

  const bodyStart = context.indexOf("(", start);
  if (bodyStart < 0) return "";

  let depth = 0;
  for (let index = bodyStart; index < context.length; index += 1) {
    const char = context[index];
    if (char === "(") depth += 1;
    if (char === ")") {
      depth -= 1;
      if (depth === 0) return context.slice(bodyStart + 1, index).trim();
    }
  }

  return "";
}

function styleDeclaration(name: string, value: string): string {
  return `${name}:${value}`;
}

function styleFromClassToken(token: string): string | undefined {
  if (token === "absolute") return styleDeclaration("position", "absolute");
  if (token === "relative") return styleDeclaration("position", "relative");
  if (token === "fixed") return styleDeclaration("position", "fixed");
  if (token === "sticky") return styleDeclaration("position", "sticky");
  if (token === "static") return styleDeclaration("position", "static");
  if (token === "block") return styleDeclaration("display", "block");
  if (token === "inline-block") return styleDeclaration("display", "inline-block");
  if (token === "inline") return styleDeclaration("display", "inline");
  if (token === "flex") return styleDeclaration("display", "flex");
  if (token === "inline-flex") return styleDeclaration("display", "inline-flex");
  if (token === "grid") return styleDeclaration("display", "grid");
  if (token === "hidden") return styleDeclaration("display", "none");
  if (token === "contents") return styleDeclaration("display", "contents");
  if (token === "max-w-none") return styleDeclaration("max-width", "none");
  if (token === "size-full") return "width:100%;height:100%";
  if (token === "w-full") return styleDeclaration("width", "100%");
  if (token === "h-full") return styleDeclaration("height", "100%");
  if (token === "w-auto") return styleDeclaration("width", "auto");
  if (token === "h-auto") return styleDeclaration("height", "auto");
  if (token === "whitespace-nowrap") return styleDeclaration("white-space", "nowrap");
  if (token === "whitespace-normal") return styleDeclaration("white-space", "normal");
  if (token === "overflow-hidden") return styleDeclaration("overflow", "hidden");
  if (token === "overflow-auto") return styleDeclaration("overflow", "auto");
  if (token === "overflow-visible") return styleDeclaration("overflow", "visible");
  if (token === "truncate") return "overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
  if (token === "font-bold") return styleDeclaration("font-weight", "700");
  if (token === "font-semibold") return styleDeclaration("font-weight", "600");
  if (token === "font-medium") return styleDeclaration("font-weight", "500");
  if (token === "font-normal") return styleDeclaration("font-weight", "400");
  if (token === "font-light") return styleDeclaration("font-weight", "300");
  if (token === "italic") return styleDeclaration("font-style", "italic");
  if (token === "not-italic") return styleDeclaration("font-style", "normal");
  if (token === "leading-[normal]") return styleDeclaration("line-height", "normal");
  if (token === "leading-none") return styleDeclaration("line-height", "1");
  if (token === "leading-tight") return styleDeclaration("line-height", "1.25");
  if (token === "leading-normal") return styleDeclaration("line-height", "1.5");
  if (token === "text-left") return styleDeclaration("text-align", "left");
  if (token === "text-center") return styleDeclaration("text-align", "center");
  if (token === "text-right") return styleDeclaration("text-align", "right");
  if (token === "text-black") return styleDeclaration("color", "#000");
  if (token === "text-white") return styleDeclaration("color", "#fff");
  if (token === "text-transparent") return styleDeclaration("color", "transparent");
  if (token === "bg-black") return styleDeclaration("background", "#000");
  if (token === "bg-white") return styleDeclaration("background", "#fff");
  if (token === "bg-transparent") return styleDeclaration("background", "transparent");
  if (token === "border") return styleDeclaration("border", "1px solid currentColor");
  if (token === "border-none") return styleDeclaration("border", "none");

  const textSize: Record<string, string> = {
    "text-xs": "12px", "text-sm": "14px", "text-base": "16px", "text-lg": "18px",
    "text-xl": "20px", "text-2xl": "24px", "text-3xl": "30px", "text-4xl": "36px"
  };
  if (textSize[token]) return styleDeclaration("font-size", textSize[token]!);

  const shadowMap: Record<string, string> = {
    "shadow-sm": "0 1px 2px rgba(0,0,0,0.05)",
    "shadow": "0 1px 3px rgba(0,0,0,0.1),0 1px 2px rgba(0,0,0,0.06)",
    "shadow-md": "0 4px 6px rgba(0,0,0,0.1),0 2px 4px rgba(0,0,0,0.06)",
    "shadow-lg": "0 10px 15px rgba(0,0,0,0.1),0 4px 6px rgba(0,0,0,0.05)",
    "shadow-xl": "0 20px 25px rgba(0,0,0,0.1),0 10px 10px rgba(0,0,0,0.04)",
    "shadow-2xl": "0 25px 50px rgba(0,0,0,0.25)",
    "shadow-none": "none"
  };
  if (shadowMap[token]) return styleDeclaration("box-shadow", shadowMap[token]!);

  if (token === "rounded") return styleDeclaration("border-radius", "4px");
  if (token === "rounded-none") return styleDeclaration("border-radius", "0");
  if (token === "rounded-sm") return styleDeclaration("border-radius", "2px");
  if (token === "rounded-md") return styleDeclaration("border-radius", "6px");
  if (token === "rounded-lg") return styleDeclaration("border-radius", "8px");
  if (token === "rounded-xl") return styleDeclaration("border-radius", "12px");
  if (token === "rounded-2xl") return styleDeclaration("border-radius", "16px");
  if (token === "rounded-3xl") return styleDeclaration("border-radius", "24px");
  if (token === "rounded-full") return styleDeclaration("border-radius", "9999px");

  if (token === "items-start") return styleDeclaration("align-items", "flex-start");
  if (token === "items-center") return styleDeclaration("align-items", "center");
  if (token === "items-end") return styleDeclaration("align-items", "flex-end");
  if (token === "items-stretch") return styleDeclaration("align-items", "stretch");
  if (token === "items-baseline") return styleDeclaration("align-items", "baseline");
  if (token === "justify-start") return styleDeclaration("justify-content", "flex-start");
  if (token === "justify-center") return styleDeclaration("justify-content", "center");
  if (token === "justify-end") return styleDeclaration("justify-content", "flex-end");
  if (token === "justify-between") return styleDeclaration("justify-content", "space-between");
  if (token === "justify-around") return styleDeclaration("justify-content", "space-around");
  if (token === "justify-evenly") return styleDeclaration("justify-content", "space-evenly");
  if (token === "flex-row") return styleDeclaration("flex-direction", "row");
  if (token === "flex-col") return styleDeclaration("flex-direction", "column");
  if (token === "flex-wrap") return styleDeclaration("flex-wrap", "wrap");
  if (token === "flex-nowrap") return styleDeclaration("flex-wrap", "nowrap");
  if (token === "flex-1") return styleDeclaration("flex", "1 1 0%");
  if (token === "flex-auto") return styleDeclaration("flex", "1 1 auto");
  if (token === "flex-none") return styleDeclaration("flex", "none");
  if (token === "grow") return styleDeclaration("flex-grow", "1");
  if (token === "grow-0") return styleDeclaration("flex-grow", "0");
  if (token === "shrink") return styleDeclaration("flex-shrink", "1");
  if (token === "shrink-0") return styleDeclaration("flex-shrink", "0");
  if (token === "self-start") return styleDeclaration("align-self", "flex-start");
  if (token === "self-center") return styleDeclaration("align-self", "center");
  if (token === "self-end") return styleDeclaration("align-self", "flex-end");
  if (token === "self-stretch") return styleDeclaration("align-self", "stretch");
  if (token === "place-items-center") return styleDeclaration("place-items", "center");

  const arbitrary = token.match(/^\[([a-z-]+):(.+)]$/);
  if (arbitrary) return styleDeclaration(arbitrary[1] ?? "", arbitrary[2] ?? "");

  const bracketValue = token.match(/^(left|top|right|bottom|w|h|text|rounded|bg|border|gap|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|min-w|max-w|min-h|max-h|opacity|z)-\[(.+)]$/);
  if (bracketValue) {
    const property = bracketValue[1] ?? "";
    const value = bracketValue[2] ?? "";
    if (property === "w") return styleDeclaration("width", value);
    if (property === "h") return styleDeclaration("height", value);
    if (property === "min-w") return styleDeclaration("min-width", value);
    if (property === "max-w") return styleDeclaration("max-width", value);
    if (property === "min-h") return styleDeclaration("min-height", value);
    if (property === "max-h") return styleDeclaration("max-height", value);
    if (property === "text" && /^#/.test(value)) return styleDeclaration("color", value);
    if (property === "text") return styleDeclaration("font-size", value);
    if (property === "rounded") return styleDeclaration("border-radius", value);
    if (property === "bg") return styleDeclaration("background", value);
    if (property === "border") return styleDeclaration("border-color", value);
    if (property === "gap") return styleDeclaration("gap", value);
    if (property === "p") return styleDeclaration("padding", value);
    if (property === "px") return `padding-left:${value};padding-right:${value}`;
    if (property === "py") return `padding-top:${value};padding-bottom:${value}`;
    if (property === "pt") return styleDeclaration("padding-top", value);
    if (property === "pb") return styleDeclaration("padding-bottom", value);
    if (property === "pl") return styleDeclaration("padding-left", value);
    if (property === "pr") return styleDeclaration("padding-right", value);
    if (property === "m") return styleDeclaration("margin", value);
    if (property === "mx") return `margin-left:${value};margin-right:${value}`;
    if (property === "my") return `margin-top:${value};margin-bottom:${value}`;
    if (property === "mt") return styleDeclaration("margin-top", value);
    if (property === "mb") return styleDeclaration("margin-bottom", value);
    if (property === "ml") return styleDeclaration("margin-left", value);
    if (property === "mr") return styleDeclaration("margin-right", value);
    if (property === "opacity") return styleDeclaration("opacity", value);
    if (property === "z") return styleDeclaration("z-index", value);
    return styleDeclaration(property, value);
  }

  const numericSpacing = token.match(/^(gap|gap-x|gap-y|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr)-(\d+(?:\.\d+)?)$/);
  if (numericSpacing) {
    const prefix = numericSpacing[1] ?? "";
    const px = `${Number(numericSpacing[2]) * 4}px`;
    const spacingMap: Record<string, string> = {
      gap: `gap:${px}`, "gap-x": `column-gap:${px}`, "gap-y": `row-gap:${px}`,
      p: `padding:${px}`, px: `padding-left:${px};padding-right:${px}`,
      py: `padding-top:${px};padding-bottom:${px}`,
      pt: `padding-top:${px}`, pb: `padding-bottom:${px}`,
      pl: `padding-left:${px}`, pr: `padding-right:${px}`,
      m: `margin:${px}`, mx: `margin-left:${px};margin-right:${px}`,
      my: `margin-top:${px};margin-bottom:${px}`,
      mt: `margin-top:${px}`, mb: `margin-bottom:${px}`,
      ml: `margin-left:${px}`, mr: `margin-right:${px}`
    };
    if (spacingMap[prefix]) return spacingMap[prefix];
  }

  const numericWH = token.match(/^(w|h)-(\d+(?:\.\d+)?)$/);
  if (numericWH) {
    const prop = numericWH[1] === "w" ? "width" : "height";
    return styleDeclaration(prop, `${Number(numericWH[2]) * 4}px`);
  }

  const opacityNumeric = token.match(/^opacity-(\d+)$/);
  if (opacityNumeric) return styleDeclaration("opacity", String(Number(opacityNumeric[1]) / 100));

  const zNumeric = token.match(/^z-(\d+)$/);
  if (zNumeric) return styleDeclaration("z-index", zNumeric[1]!);

  const zeroValue = token.match(/^(left|top|right|bottom)-0$/);
  if (zeroValue) return styleDeclaration(zeroValue[1] ?? "", "0");

  const leadingBracket = token.match(/^leading-\[(.+)]$/);
  if (leadingBracket) return styleDeclaration("line-height", leadingBracket[1]!);

  if (token.startsWith("font-[")) return 'font-family:"PingFang SC","PingFang-SC",Arial,sans-serif';
  return undefined;
}

type StyleFromClassNameResult = { css: string; unknownTokens: string[] };

function styleFromClassName(className: string): StyleFromClassNameResult {
  const tokens = className.split(/\s+/).map((t) => t.trim()).filter(Boolean);
  const cssParts: string[] = [];
  const unknownTokens: string[] = [];
  for (const token of tokens) {
    const result = styleFromClassToken(token);
    if (result) {
      cssParts.push(result);
    } else {
      unknownTokens.push(token);
    }
  }
  return { css: cssParts.join(";"), unknownTokens };
}

function normalizeStyleObject(value: string): string {
  return value.replace(/style=\{\{\s*fontVariationSettings:\s*"([^"]+)"\s*\}\}/g, (_match, settings) => {
    return `style="font-variation-settings:${settings}"`;
  });
}

// Zero exports wrap positioned groups in `display:contents` (Tailwind `contents`). A
// contents box generates no principal box, so it can neither apply its own left/top nor act
// as the containing block for its absolutely-positioned children — the children bubble up to
// the nearest real ancestor and lose the group's offset. When a node is BOTH `display:contents`
// and explicitly positioned, rewrite it to `display:block` so offsets resolve against it.
function resolvePositionedContents(style: string): string {
  const parts = style.split(";");
  if (!parts.some((part) => part.trim() === "display:contents")) return style;
  const positioned = parts.some((part) =>
    /^position:\s*(absolute|relative|fixed|sticky)$/.test(part.trim())
  );
  if (!positioned) return style;
  return parts.map((part) => (part.trim() === "display:contents" ? "display:block" : part)).join(";");
}

let _unknownTokenCollector: Map<string, string[]> | undefined;

function transformOpeningTag(tagName: string, rawAttributes: string, isSelfClosing: boolean): string {
  let attributes = rawAttributes.trim();
  const classMatch = attributes.match(/\bclassName="([^"]*)"/);
  const styleMatch = attributes.match(/\bstyle="([^"]*)"/);
  const className = classMatch?.[1] ?? "";
  const existingStyle = styleMatch?.[1] ?? "";
  const { css: computedStyle, unknownTokens } = styleFromClassName(className);

  if (unknownTokens.length > 0 && _unknownTokenCollector) {
    const nodeIdMatch = attributes.match(/\bdata-node-id="([^"]+)"/);
    const nodeId = nodeIdMatch?.[1] ?? "_root";
    const existing = _unknownTokenCollector.get(nodeId) ?? [];
    _unknownTokenCollector.set(nodeId, [...existing, ...unknownTokens]);
  }
  const mergedStyle = resolvePositionedContents([computedStyle, existingStyle].filter(Boolean).join(";"));

  attributes = attributes
    .replace(/\s*\bclassName="[^"]*"/, "")
    .replace(/\s*\bstyle="[^"]*"/, "")
    .trim();

  const classAttribute = className ? ` class="${escapeHtml(className)}"` : "";
  const styleAttribute = mergedStyle ? ` style="${escapeHtml(mergedStyle)}"` : "";
  const rest = attributes ? ` ${attributes}` : "";
  const opening = `<${tagName}${classAttribute}${styleAttribute}${rest}>`;

  if (!isSelfClosing || tagName === "img") return opening;
  return `${opening}</${tagName}>`;
}

function staticHtmlFromContext(
  context: string,
  assets: AssetDeclaration[],
  width: number,
  height: number,
  viewportWidth = width,
  viewportHeight = height,
  offsetX = 0,
  offsetY = 0
): string {
  const assetByVariable = new Map(assets.map((asset) => [asset.variable, asset.url]));
  const jsx = normalizeStyleObject(extractReturnJsx(context))
    .replace(/\bsrc=\{(\w+)\}/g, (_match, variable: string) => {
      const url = assetByVariable.get(variable) ?? "";
      return `src="${escapeHtml(url)}"`;
    })
    .replace(/\{["']([^"']*)["']\}/g, (_match, value: string) => escapeHtml(value));

  const html = jsx.replace(/<([A-Za-z][\w-]*)([^<>]*?)(\/?)>/g, (_match, tagName, attributes, slash) =>
    transformOpeningTag(tagName, attributes, slash === "/")
  );

  return `<div class="zero-visual-stage" style="position:relative;width:${viewportWidth}px;height:${viewportHeight}px;overflow:visible;"><div class="zero-visual-content" style="position:absolute;left:${offsetX}px;top:${offsetY}px;width:${width}px;height:${height}px;">${html}</div></div>`;
}

function attributesFromMetadataTag(line: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of line.matchAll(/\b([a-zA-Z][\w-]*)="([^"]*)"/g)) {
    const key = match[1];
    const value = match[2];
    if (key && value != null) attributes[key] = value;
  }
  return attributes;
}

function kindFromMetadataTag(tag: string): FrameElementKind {
  if (tag === "text") return "text";
  if (tag === "rounded-rectangle" || tag === "rectangle") return "rect";
  if (tag === "group") return "group";
  return "vector";
}

function parseNumber(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseMetadataNodes(metadata: string): MetadataNode[] {
  const nodes: MetadataNode[] = [];
  const stack: Array<{ indent: number; absX: number; absY: number }> = [];

  for (const line of metadata.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("</")) continue;

    const tagMatch = line.match(/^(\s*)<([a-z-]+)\b/);
    if (!tagMatch) continue;

    const indent = tagMatch[1]?.length ?? 0;
    const tag = tagMatch[2] ?? "";
    const attributes = attributesFromMetadataTag(line);
    const nodeId = attributes.id;
    if (!nodeId) continue;

    while (stack.length > 0 && (stack.at(-1)?.indent ?? 0) >= indent) stack.pop();

    const parent = stack.at(-1);
    const localX = parseNumber(attributes.x);
    const localY = parseNumber(attributes.y);
    const isRoot = nodes.length === 0;
    const absX = isRoot ? 0 : (parent?.absX ?? 0) + localX;
    const absY = isRoot ? 0 : (parent?.absY ?? 0) + localY;
    const width = parseNumber(attributes.width);
    const height = parseNumber(attributes.height);
    const radiusAttr = attributes.cornerRadius ?? attributes.radius ?? attributes.rx ?? attributes.ry;
    const borderRadius = radiusAttr != null ? Number(radiusAttr) : NaN;

    const node: MetadataNode = {
      nodeId,
      name: attributes.name ?? nodeId,
      kind: kindFromMetadataTag(tag),
      bounds: { x: absX, y: absY, w: width, h: height }
    };
    if (Number.isFinite(borderRadius) && borderRadius > 0) node.borderRadius = borderRadius;
    nodes.push(node);

    if (!line.trim().endsWith("/>")) stack.push({ indent, absX, absY });
  }

  return nodes;
}

function textByNodeIdFromHtml(html: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const match of html.matchAll(/<(?:p|span)\b[^>]*\bdata-node-id="([^"]+)"[^>]*>([\s\S]*?)<\/(?:p|span)>/g)) {
    const nodeId = match[1];
    const rawText = match[2];
    if (!nodeId || rawText == null) continue;
    result.set(nodeId, decodeHtmlEntities(rawText.replace(/<[^>]+>/g, "").trim()));
  }
  return result;
}

function nodeIdByAssetUrlFromHtml(html: string, assets: AssetDeclaration[]): Map<string, string> {
  const result = new Map<string, string>();
  for (const asset of assets) {
    const srcIndex = html.indexOf(`src="${escapeHtml(asset.url)}"`);
    if (srcIndex < 0) continue;

    const before = html.slice(0, srcIndex);
    const matches = [...before.matchAll(/\bdata-node-id="([^"]+)"/g)];
    const last = matches.at(-1)?.[1];
    if (last) result.set(asset.url, last);
  }
  return result;
}

function assetTypeFromUrl(url: string): ZeroVisualAsset["type"] {
  const lower = url.toLowerCase();
  if (lower.includes(".png")) return "png";
  if (lower.includes(".jpg") || lower.includes(".jpeg")) return "jpg";
  if (lower.includes(".webp")) return "webp";
  return "svg";
}

function createAssets(
  declarations: AssetDeclaration[],
  nodes: MetadataNode[],
  assetNodeIds: Map<string, string>
): ZeroVisualAsset[] {
  const nodeById = new Map(nodes.map((node) => [node.nodeId, node]));
  return declarations.map((declaration) => {
    const nodeId = assetNodeIds.get(declaration.url);
    const node = nodeId ? nodeById.get(nodeId) : undefined;
    return {
      id: nodeId ? `asset-${nodeId}` : `asset-${declaration.variable}`,
      type: assetTypeFromUrl(declaration.url),
      url: declaration.url,
      ...(nodeId ? { nodeId } : {}),
      ...(node ? { width: node.bounds.w, height: node.bounds.h } : {})
    };
  });
}

function enrichNodes(
  nodes: MetadataNode[],
  textByNodeId: Map<string, string>,
  assetByNodeId: Map<string, string>,
  offsetX: number,
  offsetY: number
): ZeroVisualNode[] {
  return nodes.map((node) => {
    const visualNode: ZeroVisualNode = {
      ...node,
      bounds: { ...node.bounds, x: node.bounds.x + offsetX, y: node.bounds.y + offsetY }
    };
    const text = textByNodeId.get(node.nodeId);
    if (text != null) visualNode.text = text;
    const assetId = assetByNodeId.get(node.nodeId);
    if (assetId != null) visualNode.assetId = assetId;
    return visualNode;
  });
}

export function createZeroVisualSnapshotFromMcp(input: ZeroMcpVisualSnapshotInput): ZeroVisualSnapshot {
  const nodeId = input.nodeId.trim();
  const context = textFromMcpPayload(input.designContext);
  const metadata = textFromMcpPayload(input.designMetadata);
  const metadataNodes = parseMetadataNodes(metadata);
  const rootNode = metadataNodes[0];
  const screenshot = screenshotInfoFromMcpPayload(input.screenshot);
  const assets = extractAssetDeclarations(context);
  const assetRadius = radiusByAssetUrl(assets);
  const rightExtent = metadataNodes.reduce(
    (max, node) => Math.max(max, node.bounds.x + node.bounds.w),
    0
  );
  const bottomExtent = metadataNodes.reduce(
    (max, node) => Math.max(max, node.bounds.y + node.bounds.h),
    0
  );
  const contentWidth = Math.max(rootNode?.bounds.w ?? 1, rightExtent, 1);
  const contentHeight = Math.max(rootNode?.bounds.h ?? 1, bottomExtent, 1);
  const width = Math.max(contentWidth, screenshot.width ?? 0, 1);
  const height = Math.max(contentHeight, screenshot.height ?? 0, 1);
  const offsetX = Math.max(0, (width - contentWidth) / 2);
  const offsetY = Math.max(0, (height - contentHeight) / 2);
  _unknownTokenCollector = new Map();
  const html = staticHtmlFromContext(context, assets, contentWidth, contentHeight, width, height, offsetX, offsetY);
  const unknownStyleTokens: Array<{ nodeId?: string; tokens: string[] }> = [];
  for (const [id, tokens] of _unknownTokenCollector) {
    if (tokens.length > 0) unknownStyleTokens.push({ ...(id !== "_root" ? { nodeId: id } : {}), tokens });
  }
  _unknownTokenCollector = undefined;
  const textByNodeId = textByNodeIdFromHtml(html);
  const assetNodeIds = nodeIdByAssetUrlFromHtml(html, assets);
  const visualAssets = createAssets(assets, metadataNodes, assetNodeIds);
  const assetByNodeId = new Map(
    visualAssets
      .map((asset) => (asset.nodeId ? ([asset.nodeId, asset.id] as const) : undefined))
      .filter((item): item is readonly [string, string] => Boolean(item))
  );

  const radiusByNodeId = new Map<string, number>();
  for (const node of metadataNodes) {
    if (node.borderRadius != null) radiusByNodeId.set(node.nodeId, node.borderRadius);
  }
  for (const [assetUrl, radius] of assetRadius) {
    const ownerNodeId = assetNodeIds.get(assetUrl);
    if (ownerNodeId && !radiusByNodeId.has(ownerNodeId)) radiusByNodeId.set(ownerNodeId, radius);
  }
  const radiusCssLines = [...radiusByNodeId.entries()].map(
    ([id, radius]) => `.zero-visual-stage [data-node-id="${cssEscape(id)}"]{border-radius:${radius}px;}`
  );

  return normalizeZeroVisualSnapshot({
    schemaVersion: "motion-copilot.zero-visual-snapshot.v1",
    frameId: rootNode?.nodeId ?? nodeId,
    nodeId,
    name: rootNode?.name ?? nodeId,
    width,
    height,
    screenshotUrl: screenshot.url,
    html,
    css: [
      '.zero-visual-stage,.zero-visual-stage *{box-sizing:border-box;}',
      '.zero-visual-stage{font-family:"PingFang SC","PingFang-SC",Arial,sans-serif;font-size:12px;color:#000;}',
      ".zero-visual-stage p{margin:0;display:flex;align-items:center;}",
      ".zero-visual-stage img{display:block;}",
      ".zero-visual-stage [data-node-id] > img{margin:auto;}",
      `.zero-visual-stage [data-node-id="${cssEscape(rootNode?.nodeId ?? nodeId)}"]{position:relative;width:100%;height:100%;}`,
      ...radiusCssLines
    ].join("\n"),
    assets: visualAssets,
    nodes: enrichNodes(metadataNodes, textByNodeId, assetByNodeId, offsetX, offsetY),
    ...(unknownStyleTokens.length > 0 ? { unknownStyleTokens } : {})
  });
}

export function normalizeZeroVisualSnapshotOrCreateFromMcp(input: unknown): ZeroVisualSnapshot {
  try {
    return normalizeZeroVisualSnapshot(input);
  } catch (snapshotError) {
    if (isRecord(input) && typeof input.nodeId === "string") {
      const designContext = input.designContext ?? input.context;
      const designMetadata = input.designMetadata ?? input.metadata;
      const screenshot = input.screenshot ?? input.screenshotUrl;
      if (designContext == null || designMetadata == null || screenshot == null) throw snapshotError;
      return createZeroVisualSnapshotFromMcp({
        nodeId: input.nodeId,
        designContext,
        designMetadata,
        screenshot
      });
    }
    throw snapshotError;
  }
}
