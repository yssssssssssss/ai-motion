import type {
  AtomicMotionToken,
  DesignerMotionRow,
  MotionSkillElement,
  MotionSkillPack,
  MotionSkillRecipe,
  MotionSkillRegistry
} from "./types";
import {
  normalizeDesignerMotionRows,
  parseCssEasing,
  parseKeyframes,
  parseMilliseconds,
  propertyFromAnimationType,
  slugMotionId
} from "./normalize";

export type MotionSkillLock = {
  version: "1.0";
  families: Record<
    string,
    {
      latestVersion: string;
      tokens: Record<string, { fingerprint: string; status: "active" | "archived" }>;
    }
  >;
};

export type CompileMotionSkillsResult = {
  registry: MotionSkillRegistry;
  lock: MotionSkillLock;
  packs: Record<string, MotionSkillPack>;
  report: string;
};

type FamilyCompile = {
  element: string;
  family: string;
  tokens: AtomicMotionToken[];
  recipes: MotionSkillRecipe[];
  incomplete: boolean;
};

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function targetRoleForElement(element: string): AtomicMotionToken["targetRole"] {
  if (/弹窗|弹层|modal|popup/i.test(element)) return "modal";
  if (/卡片|card/i.test(element)) return "card";
  if (/前后|横向|页面|screen|page/i.test(element)) return "screen";
  if (/容器|container/i.test(element)) return "container";
  return "unknown";
}

function isCompleteTokenRow(row: DesignerMotionRow): boolean {
  return Boolean(
    row.element &&
    row.variant &&
    row.value &&
    row.delay &&
    row.animationType &&
    row.propertyChange &&
    row.cssValue
  );
}

const REQUIRED_TOKEN_FIELDS: Array<{ key: keyof DesignerMotionRow; label: string }> = [
  { key: "value", label: "Value" },
  { key: "delay", label: "Delay" },
  { key: "animationType", label: "动画类型" },
  { key: "propertyChange", label: "关键属性变化" },
  { key: "cssValue", label: "CSS Value" }
];

function incompleteReason(rows: DesignerMotionRow[]): string {
  const missing = new Set<string>();

  for (const row of rows) {
    for (const field of REQUIRED_TOKEN_FIELDS) {
      if (!row[field.key]) missing.add(field.label);
    }
  }

  if (missing.size === 0) return "缺少完整 token 行";
  return `缺少完整 token 行：${[...missing].join(" / ")}`;
}

function tokenFromRow(row: DesignerMotionRow): AtomicMotionToken {
  const family = slugMotionId(row.element);
  const variant = slugMotionId(row.variant);
  const property = propertyFromAnimationType(row.animationType);
  return {
    id: `${family}.${variant}.${property}`,
    family,
    sourceElement: row.element,
    variant,
    sourceVariant: row.variant,
    targetRole: targetRoleForElement(row.element),
    targetLayer: row.targetLayer || "前景层",
    token: row.token,
    property,
    durationMs: parseMilliseconds(row.value),
    delayMs: parseMilliseconds(row.delay),
    easing: parseCssEasing(row.cssValue),
    keyframes: parseKeyframes(row.propertyChange, property),
    metadata: {
      animationType: row.animationType,
      sourceChange: row.propertyChange,
      sourceValue: row.value,
      sourceDelay: row.delay,
      sourceCssValue: row.cssValue
    }
  };
}

function fingerprint(token: AtomicMotionToken): string {
  return JSON.stringify({
    property: token.property,
    durationMs: token.durationMs,
    delayMs: token.delayMs,
    easing: token.easing,
    keyframes: token.keyframes
  });
}

function bumpMinor(version: string): string {
  const [majorRaw = "1", minorRaw = "0"] = version.split(".");
  const major = Number(majorRaw);
  const minor = Number(minorRaw);
  return `${Number.isFinite(major) ? major : 1}.${Number.isFinite(minor) ? minor + 1 : 1}.0`;
}

function compileFamily(element: string, rows: DesignerMotionRow[]): FamilyCompile {
  const family = slugMotionId(element);
  const completeRows = rows.filter(isCompleteTokenRow);
  const tokensById = new Map<string, AtomicMotionToken>();

  for (const row of completeRows) {
    const token = tokenFromRow(row);
    tokensById.set(token.id, token);
  }

  const tokens = [...tokensById.values()];
  const tokenIdsByVariant = new Map<string, string[]>();
  for (const token of tokens) {
    tokenIdsByVariant.set(token.variant, [...(tokenIdsByVariant.get(token.variant) ?? []), token.id]);
  }

  const sourceVariantByVariant = new Map(tokens.map((token) => [token.variant, token.sourceVariant]));
  const targetRoleByVariant = new Map(tokens.map((token) => [token.variant, token.targetRole]));
  const targetLayerByVariant = new Map(tokens.map((token) => [token.variant, token.targetLayer]));
  const recipes: MotionSkillRecipe[] = [...tokenIdsByVariant.entries()].map(([variant, tokenIds]) => ({
    id: `${family}.${variant}.enter`,
    name: `${element} / ${sourceVariantByVariant.get(variant) ?? variant}`,
    family,
    sourceElement: element,
    variant,
    sourceVariant: sourceVariantByVariant.get(variant) ?? variant,
    targetRole: targetRoleByVariant.get(variant) ?? "unknown",
    targetLayer: targetLayerByVariant.get(variant) ?? "前景层",
    trigger: "load",
    tokenIds
  }));

  return {
    element,
    family,
    tokens,
    recipes,
    incomplete: tokens.length === 0 || recipes.length === 0
  };
}

function hasTokenChanges(
  previous: MotionSkillLock["families"][string] | undefined,
  nextTokens: AtomicMotionToken[]
): boolean {
  if (!previous) return true;

  const nextIds = new Set(nextTokens.map((token) => token.id));
  for (const token of nextTokens) {
    const previousToken = previous.tokens[token.id];
    if (
      !previousToken ||
      previousToken.status !== "active" ||
      previousToken.fingerprint !== fingerprint(token)
    )
      return true;
  }
  for (const [tokenId, previousToken] of Object.entries(previous.tokens)) {
    if (previousToken.status === "active" && !nextIds.has(tokenId)) return true;
  }
  return false;
}

function nextLockTokens(
  previous: MotionSkillLock["families"][string] | undefined,
  nextTokens: AtomicMotionToken[]
): MotionSkillLock["families"][string]["tokens"] {
  const tokens: MotionSkillLock["families"][string]["tokens"] = { ...(previous?.tokens ?? {}) };
  const nextIds = new Set(nextTokens.map((token) => token.id));

  for (const token of nextTokens) {
    tokens[token.id] = { fingerprint: fingerprint(token), status: "active" };
  }
  for (const [tokenId, previousToken] of Object.entries(previous?.tokens ?? {})) {
    if (previousToken.status === "active" && !nextIds.has(tokenId)) {
      tokens[tokenId] = { ...previousToken, status: "archived" };
    }
  }
  return tokens;
}

export function compileMotionSkillsFromRows(input: {
  rows: Record<string, unknown>[];
  previousLock: MotionSkillLock | null;
}): CompileMotionSkillsResult {
  const normalized = normalizeDesignerMotionRows(input.rows).filter((row) => row.element);
  const rowsByElement = new Map<string, DesignerMotionRow[]>();
  const elementOrder: string[] = [];

  for (const row of normalized) {
    if (!rowsByElement.has(row.element)) {
      rowsByElement.set(row.element, []);
      elementOrder.push(row.element);
    }
    rowsByElement.get(row.element)?.push(row);
  }

  const previousLock = input.previousLock ?? { version: "1.0" as const, families: {} };
  const lock: MotionSkillLock = { version: "1.0", families: { ...previousLock.families } };
  const elements: MotionSkillElement[] = [];
  const packs: Record<string, MotionSkillPack> = {};
  const reportLines: string[] = [];

  for (const element of elementOrder) {
    const compiled = compileFamily(element, rowsByElement.get(element) ?? []);
    const previousFamily = previousLock.families[compiled.family];

    if (compiled.incomplete) {
      const rows = rowsByElement.get(element) ?? [];
      elements.push({
        id: compiled.family,
        label: element,
        latestVersion: previousFamily?.latestVersion ?? "0.0.0",
        active: false,
        variants: unique(rows.map((row) => row.variant).filter(Boolean)),
        packPath: "",
        status: "incomplete",
        reason: incompleteReason(rows)
      });
      reportLines.push(`不完整元素: ${element}`);
      continue;
    }

    const changed = hasTokenChanges(previousFamily, compiled.tokens);
    const version = previousFamily
      ? changed
        ? bumpMinor(previousFamily.latestVersion)
        : previousFamily.latestVersion
      : "1.0.0";
    const variants = unique(compiled.recipes.map((recipe) => recipe.sourceVariant));

    lock.families[compiled.family] = {
      latestVersion: version,
      tokens: nextLockTokens(previousFamily, compiled.tokens)
    };
    elements.push({
      id: compiled.family,
      label: element,
      latestVersion: version,
      active: true,
      variants,
      packPath: `${compiled.family}/manifest.json`,
      status: "active"
    });
    packs[compiled.family] = {
      manifest: {
        id: compiled.family,
        name: element,
        version,
        source: "designer-csv",
        variants,
        defaultVariant: compiled.recipes[0]?.variant ?? variants[0] ?? "default",
        tokenFile: "tokens.json",
        recipeFile: "recipes.json",
        skillFile: "skill.md"
      },
      tokens: compiled.tokens,
      recipes: compiled.recipes
    };

    if (!previousFamily) reportLines.push(`新增元素: ${element}@${version}`);
    else if (changed) reportLines.push(`更新元素: ${element} ${previousFamily.latestVersion} -> ${version}`);
    else reportLines.push(`无变化: ${element}@${version}`);
  }

  return {
    registry: { version: "1.0", elements },
    lock,
    packs,
    report: reportLines.join("\n")
  };
}
