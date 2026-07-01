#!/usr/bin/env node

import { execFile } from "node:child_process";

function parseArgs(argv) {
  const args = {
    timeoutMs: Number(process.env.ZERO_MCP_BRIDGE_TIMEOUT_MS || 30000)
  };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--")) continue;
    if (value == null || value.startsWith("--")) {
      args[key.slice(2)] = true;
      continue;
    }
    args[key.slice(2)] = value;
    index += 1;
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/zero-mcp-layer-bridge.mjs --node-id 28:2

Required environment:
  ZERO_MCP_HTTP_URL       Zero MCP streamable HTTP endpoint, for example http://127.0.0.1:27618/mcp
                          OR
  ZERO_MCP_TOOL_COMMAND   External MCP-capable command executable.
  ZERO_MCP_TOOL_ARGS      Default argument template. Use {tool}, {nodeId}, and {script}.

Optional environment:
  ZERO_MCP_TOOL_ARGS_USE_DESIGN_SCRIPT
  ZERO_MCP_TOOL_ARGS_GET_SCREENSHOT
  ZERO_MCP_BRIDGE_TIMEOUT_MS  default 30000.
  ZERO_MCP_SCREENSHOT_MAX_DIMENSION  default 1024.
  ZERO_MCP_SCREENSHOT_BASE64  default false.

This bridge calls:
  use_design_script  Read Relay nodes as native layer facts.
  get_screenshot     Attach the current screenshot URL/base64 when available.`;
}

function splitArgs(value) {
  if (!value) return [];
  return (
    value.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map((item) => item.replace(/^(['"])(.*)\1$/, "$2")) ?? []
  );
}

function argsTemplateForTool(tool) {
  const specificName = `ZERO_MCP_TOOL_ARGS_${tool.toUpperCase()}`;
  return process.env[specificName]?.trim() || process.env.ZERO_MCP_TOOL_ARGS?.trim() || "";
}

function requiredToolArgsTemplate(tool) {
  const template = argsTemplateForTool(tool);
  if (!template) {
    throw new Error(
      `Missing argument template for ${tool}. Set ZERO_MCP_TOOL_ARGS or ZERO_MCP_TOOL_ARGS_${tool.toUpperCase()}.`
    );
  }
  return template;
}

function toolArgs(template, tool, nodeId, script) {
  return splitArgs(template).map((item) =>
    item.replaceAll("{tool}", tool).replaceAll("{nodeId}", nodeId).replaceAll("{script}", script)
  );
}

function runTool(command, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || error.message));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        resolve(stdout.trim());
      }
    });
  });
}

function parseSsePayload(raw) {
  const dataLines = String(raw)
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);
  const payload = dataLines.length > 0 ? dataLines.join("\n") : String(raw).trim();
  if (!payload) throw new Error("MCP HTTP response is empty.");
  return JSON.parse(payload);
}

function screenshotArguments(nodeId) {
  const maxDimension = Number(process.env.ZERO_MCP_SCREENSHOT_MAX_DIMENSION || 1024);
  const enableBase64Response = process.env.ZERO_MCP_SCREENSHOT_BASE64 === "true";
  return {
    nodeId,
    contentsOnly: true,
    enableBase64Response,
    ...(Number.isFinite(maxDimension) && maxDimension > 0 ? { maxDimension } : {})
  };
}

function toolArguments(tool, nodeId, script) {
  if (tool === "use_design_script") {
    return {
      code: script,
      description: `Read Zero native layer snapshot for node ${nodeId}.`
    };
  }
  if (tool === "get_screenshot") return screenshotArguments(nodeId);
  return { nodeId };
}

async function runHttpTool(url, tool, nodeId, script, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "Mcp-Protocol-Version": "2025-06-18"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `${tool}-${Date.now()}`,
        method: "tools/call",
        params: {
          name: tool,
          arguments: toolArguments(tool, nodeId, script)
        }
      })
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`MCP HTTP ${tool} failed: ${response.status} ${body}`);
    const message = parseSsePayload(body);
    if (message.error) throw new Error(message.error.message || `MCP HTTP ${tool} returned an error.`);
    return message.result;
  } finally {
    clearTimeout(timeout);
  }
}

function textFromContent(value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return undefined;
  const content = Array.isArray(value.content) ? value.content : undefined;
  const text = content?.find((item) => item?.type === "text" && typeof item.text === "string")?.text;
  if (text) return text;
  if (typeof value.text === "string") return value.text;
  return undefined;
}

function parseMaybeJson(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function extractPayload(value) {
  const text = textFromContent(value);
  return parseMaybeJson(text ?? value);
}

function screenshotUrlFrom(value) {
  const payload = extractPayload(value);
  if (typeof payload === "string") return payload;
  if (!payload || typeof payload !== "object") return "";
  if (typeof payload.image_url === "string") return payload.image_url;
  if (typeof payload.imageUrl === "string") return payload.imageUrl;
  if (typeof payload.url === "string") return payload.url;
  if (typeof payload.base64 === "string") return `data:image/png;base64,${payload.base64}`;
  const content = Array.isArray(payload.content) ? payload.content : [];
  for (const item of content) {
    if (typeof item?.image_url === "string") return item.image_url;
    if (typeof item?.imageUrl === "string") return item.imageUrl;
    if (typeof item?.data === "string" && item?.mimeType) return `data:${item.mimeType};base64,${item.data}`;
  }
  return "";
}

function kindForType(type) {
  const normalized = String(type || "").toUpperCase();
  if (normalized === "FRAME") return "frame";
  if (normalized === "GROUP") return "group";
  if (normalized === "RECTANGLE") return "rect";
  if (normalized === "TEXT") return "text";
  if (normalized === "VECTOR") return "vector";
  if (normalized === "BOOLEAN_OPERATION") return "boolean";
  if (normalized === "ELLIPSE") return "ellipse";
  if (normalized === "LINE") return "line";
  if (normalized === "POLYGON") return "polygon";
  if (normalized === "STAR") return "star";
  if (normalized === "SECTION") return "section";
  if (normalized === "COMPONENT") return "component";
  if (normalized === "INSTANCE") return "instance";
  return "unknown";
}

const layerScript = String.raw`
const target = await relay.getNodeByIdAsync("__NODE_ID__")
if (!target) throw new Error("Node __NODE_ID__ was not found.")
if ("skipInvisibleInstanceChildren" in relay) relay.skipInvisibleInstanceChildren = false

function kindForType(type) {
  const t = String(type || "").toUpperCase()
  if (t === "FRAME") return "frame"
  if (t === "GROUP") return "group"
  if (t === "RECTANGLE") return "rect"
  if (t === "TEXT") return "text"
  if (t === "VECTOR") return "vector"
  if (t === "BOOLEAN_OPERATION") return "boolean"
  if (t === "ELLIPSE") return "ellipse"
  if (t === "LINE") return "line"
  if (t === "POLYGON") return "polygon"
  if (t === "STAR") return "star"
  if (t === "SECTION") return "section"
  if (t === "COMPONENT") return "component"
  if (t === "INSTANCE") return "instance"
  return "unknown"
}

function colorToHex(color) {
  if (!color) return "#000000"
  const part = (value) => Math.max(0, Math.min(255, Math.round((value || 0) * 255))).toString(16).padStart(2, "0")
  return "#" + part(color.r) + part(color.g) + part(color.b)
}

function fillsFor(node) {
  if (!("fills" in node) || node.fills === relay.mixed || !Array.isArray(node.fills)) return undefined
  return node.fills.filter((paint) => paint && paint.visible !== false).map((paint, index) => {
    if (paint.type === "SOLID") {
      return { type: "solid", color: colorToHex(paint.color), ...(paint.opacity != null ? { opacity: paint.opacity } : {}) }
    }
    if (String(paint.type || "").includes("GRADIENT")) {
      return { type: "gradient", opacity: paint.opacity ?? 1 }
    }
    if (paint.type === "IMAGE") {
      return { type: "image", assetId: paint.imageHash ? "image-" + paint.imageHash : "image-" + node.id + "-" + index, opacity: paint.opacity ?? 1 }
    }
    return undefined
  }).filter(Boolean)
}

function strokesFor(node) {
  if (!("strokes" in node) || node.strokes === relay.mixed || !Array.isArray(node.strokes)) return undefined
  const width = "strokeWeight" in node && typeof node.strokeWeight === "number" ? node.strokeWeight : undefined
  return node.strokes.filter((paint) => paint && paint.visible !== false && paint.type === "SOLID").map((paint) => ({
    color: colorToHex(paint.color),
    ...(paint.opacity != null ? { opacity: paint.opacity } : {}),
    ...(width != null ? { width } : {})
  }))
}

function effectsFor(node) {
  if (!("effects" in node) || !Array.isArray(node.effects)) return undefined
  return node.effects.filter((effect) => effect && effect.visible !== false).map((effect) => {
    if (effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW") {
      const color = effect.color || { r: 0, g: 0, b: 0, a: 0.2 }
      const x = effect.offset?.x || 0
      const y = effect.offset?.y || 0
      const radius = effect.radius || 0
      const spread = effect.spread || 0
      const css = (effect.type === "INNER_SHADOW" ? "inset " : "") + x + "px " + y + "px " + radius + "px " + spread + "px rgba(" + Math.round((color.r || 0) * 255) + "," + Math.round((color.g || 0) * 255) + "," + Math.round((color.b || 0) * 255) + "," + (color.a ?? 1) + ")"
      return { type: effect.type === "INNER_SHADOW" ? "inner-shadow" : "drop-shadow", css: "box-shadow:" + css }
    }
    if (effect.type === "LAYER_BLUR" || effect.type === "BACKGROUND_BLUR") {
      return { type: "blur", css: "filter:blur(" + (effect.radius || 0) + "px)" }
    }
    return { type: "unknown" }
  })
}

function textStyleFor(node) {
  if (node.type !== "TEXT") return undefined
  const style = {}
  if (node.fontName && node.fontName !== relay.mixed) style.fontFamily = node.fontName.family
  if (typeof node.fontSize === "number") style.fontSize = node.fontSize
  if (typeof node.fontWeight === "number") style.fontWeight = node.fontWeight
  if (node.lineHeight && node.lineHeight !== relay.mixed && typeof node.lineHeight.value === "number") style.lineHeight = node.lineHeight.value
  if (node.textAlignHorizontal === "CENTER") style.textAlign = "center"
  else if (node.textAlignHorizontal === "RIGHT") style.textAlign = "right"
  else style.textAlign = "left"
  return style
}

function cornerRadiusFor(node) {
  if ("cornerRadius" in node && node.cornerRadius !== relay.mixed && typeof node.cornerRadius === "number") return node.cornerRadius
  const corners = ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"]
    .map((key) => (key in node ? node[key] : undefined))
    .filter((value) => typeof value === "number")
  if (corners.length === 4 && corners.every((value) => value === corners[0])) return corners[0]
  return undefined
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value)
}

function absoluteBoundsFor(node) {
  const box = node.absoluteBoundingBox
  if (box && finiteNumber(box.x) && finiteNumber(box.y)) return box
  const transform = node.absoluteTransform
  if (Array.isArray(transform) && transform.length >= 2 && finiteNumber(transform[0]?.[2]) && finiteNumber(transform[1]?.[2])) {
    return { x: transform[0][2], y: transform[1][2] }
  }
  return undefined
}

function relativePosition(node) {
  if (node.id === target.id) return { x: 0, y: 0 }
  const targetBounds = absoluteBoundsFor(target)
  const nodeBounds = absoluteBoundsFor(node)
  if (targetBounds && nodeBounds) return { x: nodeBounds.x - targetBounds.x, y: nodeBounds.y - targetBounds.y }
  return { x: (node.x || 0) - (target.x || 0), y: (node.y || 0) - (target.y || 0) }
}

function layerFor(node) {
  const fills = fillsFor(node)
  const strokes = strokesFor(node)
  const effects = effectsFor(node)
  const textStyle = textStyleFor(node)
  const cornerRadius = cornerRadiusFor(node)
  const position = relativePosition(node)
  const layer = {
    nodeId: node.id,
    ...(node.id !== target.id && node.parent && "id" in node.parent ? { parentId: node.parent.id } : {}),
    name: node.name || node.id,
    kind: kindForType(node.type),
    bounds: { x: position.x, y: position.y, w: node.width || 0, h: node.height || 0 },
    opacity: typeof node.opacity === "number" ? node.opacity : 1,
    visible: node.visible !== false,
    ...("clipsContent" in node ? { clipsContent: Boolean(node.clipsContent) } : {}),
    ...(cornerRadius != null ? { cornerRadius } : {}),
    ...(fills && fills.length ? { fills } : {}),
    ...(strokes && strokes.length ? { strokes } : {}),
    ...(effects && effects.length ? { effects } : {}),
    ...(node.type === "TEXT" ? { text: node.characters || "" } : {}),
    ...(textStyle ? { textStyle } : {}),
    ...("children" in node && Array.isArray(node.children) ? { children: node.children.map((child) => child.id) } : {})
  }
  return layer
}

function collectNodes(root) {
  const result = []
  const seen = new Set()
  function visit(node) {
    if (!node || !("id" in node) || seen.has(node.id) || node.visible === false) return
    seen.add(node.id)
    result.push(node)
    const children = "children" in node && Array.isArray(node.children) ? node.children : []
    for (const child of children) visit(child)
  }
  visit(root)
  return result
}

const nodes = collectNodes(target)
return {
  schemaVersion: "motion-copilot.zero-layer-snapshot.v1",
  frameId: target.id,
  nodeId: target.id,
  name: target.name || target.id,
  width: target.width || 0,
  height: target.height || 0,
  screenshotUrl: "",
  assets: [],
  layers: nodes.map(layerFor)
}
`;

function scriptForNode(nodeId) {
  return layerScript.replaceAll("__NODE_ID__", nodeId.replaceAll("\\", "\\\\").replaceAll('"', '\\"'));
}

function payloadSummary(value) {
  if (typeof value === "string") return value.trim().slice(0, 1000);
  try {
    return JSON.stringify(value).slice(0, 1000);
  } catch {
    return String(value).slice(0, 1000);
  }
}

function normalizeSnapshotPayload(value, nodeId, screenshotUrl) {
  const payload = extractPayload(value);
  const snapshot =
    payload &&
    typeof payload === "object" &&
    payload.schemaVersion === "motion-copilot.zero-layer-snapshot.v1"
      ? payload
      : undefined;
  if (!snapshot) {
    throw new Error(
      `use_design_script did not return a ZeroLayerSnapshot payload. Raw response: ${payloadSummary(payload)}`
    );
  }
  const layers = Array.isArray(snapshot.layers)
    ? snapshot.layers.map((layer) => ({
        ...layer,
        kind: layer.kind || kindForType(layer.type)
      }))
    : [];
  return {
    ...snapshot,
    schemaVersion: "motion-copilot.zero-layer-snapshot.v1",
    frameId: snapshot.frameId || nodeId,
    nodeId: snapshot.nodeId || nodeId,
    name: snapshot.name || nodeId,
    screenshotUrl: screenshotUrl || snapshot.screenshotUrl || "",
    assets: Array.isArray(snapshot.assets) ? snapshot.assets : [],
    layers
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const nodeId = typeof args["node-id"] === "string" ? args["node-id"].trim() : "";
  const httpUrl = process.env.ZERO_MCP_HTTP_URL?.trim();
  const command = process.env.ZERO_MCP_TOOL_COMMAND?.trim();
  const timeoutMs = Number.isFinite(args.timeoutMs) && args.timeoutMs > 0 ? args.timeoutMs : 30000;

  if (!nodeId) throw new Error("Missing --node-id.");
  if (!httpUrl && !command) {
    throw new Error(
      "Zero MCP is not configured. Set ZERO_MCP_HTTP_URL or ZERO_MCP_TOOL_COMMAND/ZERO_MCP_TOOL_ARGS."
    );
  }

  const script = scriptForNode(nodeId);
  const [scriptResult, screenshotResult] = httpUrl
    ? await Promise.all([
        runHttpTool(httpUrl, "use_design_script", nodeId, script, timeoutMs),
        runHttpTool(httpUrl, "get_screenshot", nodeId, script, timeoutMs)
      ])
    : await (async () => {
        const scriptArgs = toolArgs(
          requiredToolArgsTemplate("use_design_script"),
          "use_design_script",
          nodeId,
          script
        );
        const screenshotArgs = toolArgs(
          requiredToolArgsTemplate("get_screenshot"),
          "get_screenshot",
          nodeId,
          script
        );
        return Promise.all([
          runTool(command, scriptArgs, timeoutMs),
          runTool(command, screenshotArgs, timeoutMs)
        ]);
      })();

  const snapshot = normalizeSnapshotPayload(scriptResult, nodeId, screenshotUrlFrom(screenshotResult));
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
