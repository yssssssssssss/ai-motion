import type { MotionManifest, MotionParam, MotionPatch, MotionTarget } from "../manifest/types";

type ApplyPatchInput = {
  files: Record<string, string>;
  manifest: MotionManifest;
  patch: MotionPatch;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtmlText(value: unknown): string {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeHtmlAttribute(value: unknown): string {
  return escapeHtmlText(value).replaceAll('"', "&quot;");
}

function applyHtmlText(content: string, selector: string, value: unknown): string {
  const motionMatch = selector.match(/^\[data-motion=([^\]]+)\]$/);
  if (!motionMatch) return content;

  const key = motionMatch[1]?.replace(/^["']|["']$/g, "");
  if (!key) return content;

  const pattern = new RegExp(
    `(<[^>]+data-motion=["']${escapeRegExp(key)}["'][^>]*>)([\\s\\S]*?)(<\\/[^>]+>)`
  );
  return content.replace(pattern, `$1${escapeHtmlText(value)}$3`);
}

function applyAttribute(content: string, selector: string, attribute: string, value: unknown): string {
  const motionMatch = selector.match(/^\[data-motion=([^\]]+)\]$/);
  if (!motionMatch) return content;

  const key = motionMatch[1]?.replace(/^["']|["']$/g, "");
  if (!key) return content;

  const elementPattern = new RegExp(`<[^>]*data-motion=["']${escapeRegExp(key)}["'][^>]*>`);
  return content.replace(elementPattern, (element) => {
    const attributePattern = new RegExp(`\\s${escapeRegExp(attribute)}\\s*=\\s*(["'])`, "i");
    const match = attributePattern.exec(element);
    const escapedValue = escapeHtmlAttribute(value);

    if (!match) {
      return element.replace(/\/?>$/, (end) => ` ${attribute}="${escapedValue}"${end}`);
    }

    const quote = match[1];
    if (!quote) return element;
    const valueStart = match.index + match[0].length;
    const valueEnd = element.indexOf(quote, valueStart);
    if (valueEnd === -1) return element;

    return `${element.slice(0, valueStart)}${escapedValue}${element.slice(valueEnd)}`;
  });
}

function formatCssValue(param: MotionParam, value: unknown): string {
  if (param.type === "image") {
    const rawValue = String(value).trim();
    if (!rawValue) return "";
    if (/^url\(/i.test(rawValue)) return rawValue;
    return `url("${rawValue.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}")`;
  }

  if (typeof value === "number" && param.constraints?.unit) {
    return `${value}${param.constraints.unit}`;
  }

  return String(value);
}

function findCssDeclarationEnd(content: string, start: number): number {
  let quote: string | null = null;
  let parenthesisDepth = 0;

  for (let index = start; index < content.length; index += 1) {
    const char = content[index];

    if (quote) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = null;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === "(") {
      parenthesisDepth += 1;
      continue;
    }

    if (char === ")") {
      parenthesisDepth = Math.max(0, parenthesisDepth - 1);
      continue;
    }

    if (char === ";" && parenthesisDepth === 0) return index;
  }

  return -1;
}

function applyCssVariable(content: string, name: string, value: string): string {
  const pattern = new RegExp(`${escapeRegExp(name)}\\s*:\\s*`);
  const match = pattern.exec(content);
  if (!match) return `:root { ${name}: ${value}; }\n${content}`;

  const valueStart = match.index + match[0].length;
  const valueEnd = findCssDeclarationEnd(content, valueStart);
  if (valueEnd === -1) return content;

  return `${content.slice(0, valueStart)}${value}${content.slice(valueEnd)}`;
}

function applyCssProperty(content: string, selector: string, property: string, value: string): string {
  // 重复 selector（如 WorkEasy 多份 .button { ... }）每一处都要改
  const pattern = new RegExp(
    `(${escapeRegExp(selector)}\\s*\\{[^}]*?${escapeRegExp(property)}\\s*:\\s*)[^;]+`,
    "gm"
  );
  return content.replace(pattern, `$1${value}`);
}

function applyTarget(content: string, target: MotionTarget, param: MotionParam, value: unknown): string {
  if (/^(?:\/assets\/|\/@fs\/|https?:\/\/)/.test(content.trim())) return content;

  if (target.kind === "html-text") return applyHtmlText(content, target.selector, value);
  if (target.kind === "html-attribute")
    return applyAttribute(content, target.selector, target.attribute, value);
  if (target.kind === "svg-attribute")
    return applyAttribute(content, target.selector, target.attribute, value);
  if (target.kind === "css-variable")
    return applyCssVariable(content, target.name, formatCssValue(param, value));
  if (target.kind === "css-property") {
    return applyCssProperty(content, target.selector, target.property, formatCssValue(param, value));
  }
  return content;
}

export function applyPatchToFiles(input: ApplyPatchInput): Record<string, string> {
  const output = { ...input.files };

  for (const param of input.manifest.params) {
    if (!(param.id in input.patch.values)) continue;

    const value = input.patch.values[param.id];
    for (const target of param.targets) {
      const filePath = "file" in target ? target.file : undefined;
      if (!filePath || output[filePath] === undefined) continue;
      output[filePath] = applyTarget(output[filePath], target, param, value);
    }
  }

  return output;
}
