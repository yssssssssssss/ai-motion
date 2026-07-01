#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const schemaVersion = "motion-copilot.frame-snapshot.v1";
const morphSchemaVersion = "motion-copilot.frame-morph.v1";

function usage() {
  return `Usage:
  pnpm motion-copilot:morph --from <frame.json> --to <frame.json> --out <plan.json>
  pnpm motion-copilot:morph --config <job.json>
`;
}

function args(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item?.startsWith("--")) continue;
    result[item.slice(2)] = argv[index + 1];
    index += 1;
  }
  return result;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function normalizeFrame(input, label) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error(`${label} must be an object`);
  if (input.schemaVersion !== schemaVersion)
    throw new Error(`${label}.schemaVersion must be ${schemaVersion}`);
  for (const key of ["frameId", "name"]) {
    if (typeof input[key] !== "string" || input[key].trim().length === 0)
      throw new Error(`${label}.${key} must be a non-empty string`);
  }
  for (const key of ["width", "height"]) {
    if (typeof input[key] !== "number" || !Number.isFinite(input[key]) || input[key] <= 0)
      throw new Error(`${label}.${key} must be a positive number`);
  }
  if (!Array.isArray(input.elements)) throw new Error(`${label}.elements must be an array`);
  return {
    ...input,
    elements: input.elements.map((element, index) => ({
      ...element,
      key: element.key || element.nodeId,
      opacity: typeof element.opacity === "number" ? element.opacity : 1,
      zIndex: typeof element.zIndex === "number" ? element.zIndex : index
    }))
  };
}

function textKey(value) {
  return (value || "").trim().toLowerCase();
}

function score(from, to) {
  if (from.kind !== to.kind) return 0;
  let value = 0;
  if (from.key === to.key) value += 70;
  if (textKey(from.text) && textKey(from.text) === textKey(to.text)) value += 34;
  if (textKey(from.name) === textKey(to.name)) value += 12;
  const widthBase = Math.max(from.w, to.w, 1);
  const heightBase = Math.max(from.h, to.h, 1);
  value += Math.round((1 - Math.min(1, Math.abs(from.w - to.w) / widthBase)) * 7);
  value += Math.round((1 - Math.min(1, Math.abs(from.h - to.h) / heightBase)) * 7);
  return Math.min(100, value);
}

function match(from, to) {
  const candidates = [];
  for (const fromElement of from.elements) {
    for (const toElement of to.elements) {
      const confidence = score(fromElement, toElement);
      if (confidence > 0)
        candidates.push({ fromKey: fromElement.key, toKey: toElement.key, confidence, reasons: ["cli"] });
    }
  }
  candidates.sort((left, right) => right.confidence - left.confidence);
  const usedFrom = new Set();
  const usedTo = new Set();
  const matches = [];
  for (const candidate of candidates) {
    if (candidate.confidence < 45 || usedFrom.has(candidate.fromKey) || usedTo.has(candidate.toKey)) continue;
    usedFrom.add(candidate.fromKey);
    usedTo.add(candidate.toKey);
    matches.push(candidate);
  }
  return {
    matches,
    enter: to.elements.filter((element) => !usedTo.has(element.key)).map((element) => element.key),
    exit: from.elements.filter((element) => !usedFrom.has(element.key)).map((element) => element.key),
    unresolved: []
  };
}

function applyPairs(result, pairs = []) {
  let next = result;
  for (const pair of pairs) {
    if (!pair?.from || !pair?.to) continue;
    next = {
      matches: [
        { fromKey: pair.from, toKey: pair.to, confidence: 100, reasons: ["manual"] },
        ...next.matches.filter((item) => item.fromKey !== pair.from && item.toKey !== pair.to)
      ],
      enter: next.enter.filter((key) => key !== pair.to),
      exit: next.exit.filter((key) => key !== pair.from),
      unresolved: next.unresolved
    };
  }
  return next;
}

function applyExclude(result, exclude = []) {
  const blocked = new Set(exclude);
  return {
    matches: result.matches.filter((item) => !blocked.has(item.fromKey) && !blocked.has(item.toKey)),
    enter: result.enter.filter((key) => !blocked.has(key)),
    exit: result.exit.filter((key) => !blocked.has(key)),
    unresolved: result.unresolved
  };
}

function state(element) {
  return {
    x: element.x,
    y: element.y,
    w: element.w,
    h: element.h,
    opacity: element.opacity,
    ...(typeof element.style?.radius === "number" ? { radius: element.style.radius } : {}),
    ...(element.style?.background ? { background: element.style.background } : {}),
    ...(element.style?.color ? { color: element.style.color } : {}),
    ...(element.text ? { text: element.text } : {}),
    ...(element.assetUrl ? { assetUrl: element.assetUrl } : {})
  };
}

function compile(from, to, result, options) {
  const fromByKey = new Map(from.elements.map((element) => [element.key, element]));
  const toByKey = new Map(to.elements.map((element) => [element.key, element]));
  const tracks = [];
  for (const item of result.matches) {
    const fromElement = fromByKey.get(item.fromKey);
    const toElement = toByKey.get(item.toKey);
    if (fromElement && toElement)
      tracks.push({
        id: `matched:${item.fromKey}->${item.toKey}`,
        role: "matched",
        from: state(fromElement),
        to: state(toElement)
      });
  }
  for (const key of result.enter) {
    const element = toByKey.get(key);
    if (!element) continue;
    const toState = state(element);
    tracks.push({
      id: `enter:${key}`,
      role: "enter",
      from: { ...toState, y: toState.y + 6, opacity: 0 },
      to: toState
    });
  }
  for (const key of result.exit) {
    const element = fromByKey.get(key);
    if (!element) continue;
    const fromState = state(element);
    tracks.push({ id: `exit:${key}`, role: "exit", from: fromState, to: { ...fromState, opacity: 0 } });
  }
  return {
    schemaVersion: morphSchemaVersion,
    fromFrameId: from.frameId,
    toFrameId: to.frameId,
    durationMs: Math.max(1, Math.round(options.durationMs || 320)),
    easing: options.easing || {
      type: "classic",
      preset: "decelerate",
      css: "cubic-bezier(0.18, 0.86, 0.22, 1)"
    },
    tracks,
    issues: []
  };
}

function main() {
  const parsed = args(process.argv.slice(2));
  let config = {};
  let baseDir = process.cwd();
  if (parsed.config) {
    const configPath = resolve(parsed.config);
    config = readJson(configPath);
    baseDir = dirname(configPath);
  }
  const fromPath = parsed.from || config.from;
  const toPath = parsed.to || config.to;
  const outPath = parsed.out || config.out;
  if (!fromPath || !toPath || !outPath) throw new Error(usage());

  const from = normalizeFrame(readJson(resolve(baseDir, fromPath)), "from");
  const to = normalizeFrame(readJson(resolve(baseDir, toPath)), "to");
  const result = applyExclude(applyPairs(match(from, to), config.pairs), config.exclude);
  const plan = compile(from, to, result, {
    durationMs: Number(parsed.durationMs || config.durationMs || 320),
    easing: config.easing
  });
  writeFileSync(resolve(baseDir, outPath), `${JSON.stringify(plan, null, 2)}\n`);
  console.log(`Wrote ${resolve(baseDir, outPath)} (${plan.tracks.length} tracks)`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
