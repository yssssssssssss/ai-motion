import { join, extname, resolve, normalize, sep } from "node:path";
import { statSync, createReadStream } from "node:fs";
import { createServer } from "node:http";
import { execFile as execFile$1 } from "node:child_process";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
const DEFAULT_MAX_BODY_BYTES$2 = 50 * 1024 * 1024;
function readBody$2(req, maxBodyBytes) {
  return new Promise((resolve2, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > maxBodyBytes) {
        reject(new Error("Request body is too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve2(body));
    req.on("error", reject);
  });
}
function writeJson$2(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}
function isMotionComponent$1(value) {
  if (!value || typeof value !== "object") return false;
  const component = value;
  return typeof component.id === "string" && typeof component.name === "string" && typeof component.manifest === "object" && typeof component.source === "object" && Array.isArray(component.source?.files);
}
function createControlledGenerationHandler(input = {}) {
  const maxBodyBytes = input.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES$2;
  return async function controlledGenerationHandler(req, res) {
    if (req.method !== "POST") {
      writeJson$2(res, 405, { error: "Method not allowed" });
      return;
    }
    try {
      const raw = await readBody$2(req, maxBodyBytes);
      const parsed = JSON.parse(raw || "{}");
      if (typeof parsed.brief !== "string" || !Array.isArray(parsed.components)) {
        writeJson$2(res, 400, { error: "brief and components are required" });
        return;
      }
      const {
        buildControlledGenerationRequest,
        compileSemanticPatch,
        createGeneratedComponentFromPatch
      } = await import("./assets/index-B99Dvm39.js");
      const components = parsed.components.filter(isMotionComponent$1);
      const request = buildControlledGenerationRequest({ brief: parsed.brief, components });
      const patch = compileSemanticPatch(request);
      const baseComponent = components.find((component) => component.id === patch.baseComponentId);
      const candidate = request.plan.candidates.find((item) => item.componentId === patch.baseComponentId);
      if (!baseComponent || !candidate) {
        writeJson$2(res, 422, { error: "没有可用于受控生成的候选组件", plan: request.plan });
        return;
      }
      const generated = createGeneratedComponentFromPatch({
        brief: request.brief,
        baseComponent,
        candidate,
        patch
      });
      const response = { ...generated, plan: request.plan };
      writeJson$2(
        res,
        generated.validation.valid ? 200 : 422,
        generated.validation.valid ? response : { ...response, error: "生成未通过门禁" }
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("too large")) {
        writeJson$2(res, 413, { error: error.message });
        return;
      }
      if (error instanceof Error && error.message.includes("没有可用于受控生成")) {
        writeJson$2(res, 422, { error: error.message });
        return;
      }
      if (error instanceof Error && error.message.includes("没有生成有效差异")) {
        writeJson$2(res, 422, { error: error.message });
        return;
      }
      writeJson$2(res, 500, {
        error: error instanceof Error ? error.message : "Failed to generate controlled component."
      });
    }
  };
}
const DEFAULT_MAX_BODY_BYTES$1 = 50 * 1024 * 1024;
const DEFAULT_API_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL_TIMEOUT_MS = 12e3;
const sourceDraftSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    html: { type: "string" },
    css: { type: "string" },
    js: { type: "string" }
  },
  required: ["html", "css", "js"]
};
const semanticIntentV2ResponseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    version: { type: "number", enum: [2] },
    target: {
      type: "object",
      additionalProperties: false,
      properties: {
        kind: {
          type: "string",
          enum: ["button", "card", "text", "badge", "loader", "page-transition", "mobile-page", "modal", "unknown"]
        },
        label: { type: ["string", "null"] }
      },
      required: ["kind", "label"]
    },
    layers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          role: {
            type: "string",
            enum: [
              "foreground",
              "background",
              "text",
              "image",
              "button",
              "screen",
              "card",
              "badge",
              "loader",
              "modal",
              "unknown"
            ]
          },
          label: { type: ["string", "null"] }
        },
        required: ["role", "label"]
      }
    },
    motions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: {
            type: "string",
            enum: ["scale", "slide", "fade", "bounce", "elastic", "rotate", "pulse", "glow", "float", "transition"]
          },
          target: {
            type: ["string", "null"],
            enum: [
              "foreground",
              "background",
              "text",
              "image",
              "button",
              "screen",
              "card",
              "badge",
              "loader",
              "modal",
              "unknown",
              null
            ]
          },
          trigger: { type: ["string", "null"], enum: ["load", "hover", "click", "loop", null] },
          direction: {
            type: ["string", "null"],
            enum: ["left-to-right", "right-to-left", "top-to-bottom", "bottom-to-top", null]
          },
          speed: { type: ["string", "null"], enum: ["fast", "normal", "slow", null] },
          description: { type: ["string", "null"] }
        },
        required: ["type", "target", "trigger", "direction", "speed", "description"]
      }
    },
    colors: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          target: { type: "string", enum: ["background", "text", "border", "accent"] },
          label: { type: "string" },
          value: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" }
        },
        required: ["target", "label", "value"]
      }
    },
    text: { type: ["string", "null"] },
    trigger: { type: "string", enum: ["load", "hover", "click", "loop"] },
    speed: { type: "string", enum: ["fast", "normal", "slow"] },
    motionCategory: { type: ["string", "null"], enum: ["entrance", "feedback", "transition", "loop", null] },
    targetRoles: {
      type: "array",
      items: {
        type: "string",
        enum: [
          "foreground",
          "background",
          "text",
          "image",
          "button",
          "screen",
          "card",
          "badge",
          "loader",
          "modal",
          "unknown"
        ]
      }
    },
    composition: { type: "string", enum: ["single", "sequence", "parallel"] },
    migrationIntent: { type: "boolean" },
    referenceRecipeHints: { type: "array", items: { type: "string" } },
    negativeConstraints: { type: "array", items: { type: "string" } },
    referenceHints: { type: "array", items: { type: "string" } },
    source: { type: "string", enum: ["model"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    raw: { type: "string" }
  },
  required: [
    "version",
    "target",
    "layers",
    "motions",
    "colors",
    "text",
    "trigger",
    "speed",
    "motionCategory",
    "targetRoles",
    "composition",
    "migrationIntent",
    "referenceRecipeHints",
    "negativeConstraints",
    "referenceHints",
    "source",
    "confidence",
    "raw"
  ]
};
function readBody$1(req, maxBodyBytes) {
  return new Promise((resolve2, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > maxBodyBytes) {
        reject(new Error("Request body is too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve2(body));
    req.on("error", reject);
  });
}
function writeJson$1(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}
function outputText(payload) {
  if (!payload || typeof payload !== "object") return null;
  const response = payload;
  if (typeof response.output_text === "string") return response.output_text;
  if (!Array.isArray(response.output)) return null;
  for (const item of response.output) {
    if (!item || typeof item !== "object") continue;
    const content = item.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = part.text;
      if (typeof text === "string") return text;
    }
  }
  return null;
}
function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}
function responseEndpointCandidates(apiBaseUrl) {
  const base = trimTrailingSlash(apiBaseUrl?.trim() || DEFAULT_API_BASE_URL);
  const candidates = [base];
  if (!base.endsWith("/v1")) {
    candidates.push(`${base}/v1`);
  }
  return [...new Set(candidates)].map((candidate) => `${candidate}/responses`);
}
function isReferenceGuidedSourceDraft(value) {
  if (!value || typeof value !== "object") return false;
  const draft = value;
  return typeof draft.html === "string" && typeof draft.css === "string" && typeof draft.js === "string";
}
function parseOpenAISourceDraftResponse(payload) {
  const text = outputText(payload);
  if (!text) return void 0;
  try {
    const parsed = JSON.parse(text);
    return isReferenceGuidedSourceDraft(parsed) ? parsed : void 0;
  } catch {
    return void 0;
  }
}
async function generateSemanticIntentV2(input) {
  const brief = input.brief.trim();
  if (!brief || !input.apiKey) return void 0;
  const { parseSemanticIntentV2Payload } = await import("./assets/index-B99Dvm39.js");
  const requestBody = JSON.stringify({
    model: input.model ?? "gpt-5.5",
    input: [
      {
        role: "system",
        content: "Parse the user's natural-language motion component request into SemanticIntentV2 JSON. Infer intent from ordinary language, not exact keywords. Output a structured motion recipe request: motionCategory, targetRoles, composition, migrationIntent, and referenceRecipeHints must be filled. Preserve negative constraints. Do not invent a button when the user asks for a page, layer, transition, modal, image, card, or unknown target. Treat motion-controlled layers as replaceable targets and expose motion parameters through recipe intent. Use source='model'. Return JSON only."
      },
      {
        role: "user",
        content: JSON.stringify({ brief })
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "semantic_intent_v2",
        strict: true,
        schema: semanticIntentV2ResponseSchema
      }
    }
  });
  const fetcher = input.fetchImpl ?? fetch;
  const timeoutMs = input.modelTimeoutMs ?? DEFAULT_MODEL_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;
  for (const endpoint of responseEndpointCandidates(input.apiBaseUrl)) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), remainingMs);
    try {
      const response = await fetcher(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          "Content-Type": "application/json"
        },
        body: requestBody,
        signal: controller.signal
      });
      if (!response.ok) continue;
      const payload = await response.json();
      const text = outputText(payload);
      if (!text) continue;
      const parsed = JSON.parse(text);
      const intent = parseSemanticIntentV2Payload(parsed, brief);
      if (intent) return { ...intent, source: "model" };
    } catch {
    } finally {
      clearTimeout(timeout);
    }
  }
  return void 0;
}
function isMotionComponent(value) {
  if (!value || typeof value !== "object") return false;
  const component = value;
  return typeof component.id === "string" && typeof component.name === "string" && typeof component.manifest === "object" && typeof component.source === "object" && Array.isArray(component.source?.files);
}
function referenceSnippet(component) {
  return component.source.files.slice(0, 3).map((file) => `${file.path}
${file.content.slice(0, 1600)}`).join("\n\n");
}
async function generateReferenceGuidedSourceDraft(input) {
  const brief = input.brief.trim();
  if (!brief || !input.apiKey) return void 0;
  const requestBody = JSON.stringify({
    model: input.model ?? "gpt-5.5",
    input: [
      {
        role: "system",
        content: "Generate a fresh HTML/CSS/JS motion component from the user's natural-language brief. Use retrieved components only as visual and structural references; do not copy their code wholesale. Return complete source files only. The HTML must contain data-motion-root and source/index.html must load ./style.css and ./script.js. The JS must define window.motionReplay, window.motionPause, and window.motionSeek. Avoid network calls, cookies, eval, new Function, external assets, and inline event handlers."
      },
      {
        role: "user",
        content: JSON.stringify({
          brief,
          intent: input.semanticIntent,
          intentV2: input.semanticIntentV2,
          sourceFiles: ["source/index.html", "source/style.css", "source/script.js"],
          references: input.references.slice(0, 3).map((component) => ({
            id: component.id,
            name: component.name,
            tags: component.tags,
            snippet: referenceSnippet(component)
          }))
        })
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "reference_guided_source_draft",
        strict: true,
        schema: sourceDraftSchema
      }
    }
  });
  const fetcher = input.fetchImpl ?? fetch;
  const timeoutMs = input.modelTimeoutMs ?? DEFAULT_MODEL_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;
  for (const endpoint of responseEndpointCandidates(input.apiBaseUrl)) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), remainingMs);
    try {
      const response = await fetcher(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          "Content-Type": "application/json"
        },
        body: requestBody,
        signal: controller.signal
      });
      if (!response.ok) continue;
      const payload = await response.json();
      const draft = parseOpenAISourceDraftResponse(payload);
      if (draft) return draft;
    } catch {
    } finally {
      clearTimeout(timeout);
    }
  }
  return void 0;
}
function createReferenceGuidedGenerationHandler(input = {}) {
  const maxBodyBytes = input.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES$1;
  return async function referenceGuidedGenerationHandler(req, res) {
    if (req.method !== "POST") {
      writeJson$1(res, 405, { error: "Method not allowed" });
      return;
    }
    try {
      const raw = await readBody$1(req, maxBodyBytes);
      const parsed = JSON.parse(raw || "{}");
      if (typeof parsed.brief !== "string" || !Array.isArray(parsed.components)) {
        writeJson$1(res, 400, { error: "brief and components are required" });
        return;
      }
      const {
        createReferenceGuidedComponent,
        parseSemanticGenerationIntent,
        parseSemanticIntentV2Fallback,
        semanticIntentV2ToLegacyIntent
      } = await import("./assets/index-B99Dvm39.js");
      const components = parsed.components.filter(isMotionComponent);
      const semanticIntentV2 = await generateSemanticIntentV2({
        brief: parsed.brief,
        apiKey: input.apiKey,
        apiBaseUrl: input.apiBaseUrl,
        model: input.model,
        fetchImpl: input.fetchImpl,
        modelTimeoutMs: input.modelTimeoutMs
      }) ?? parseSemanticIntentV2Fallback(parsed.brief);
      const semanticIntent = semanticIntentV2.source === "model" ? semanticIntentV2ToLegacyIntent(semanticIntentV2) : parseSemanticGenerationIntent(parsed.brief);
      const sourceDraft = await generateReferenceGuidedSourceDraft({
        brief: parsed.brief,
        references: components,
        apiKey: input.apiKey,
        apiBaseUrl: input.apiBaseUrl,
        model: input.model,
        fetchImpl: input.fetchImpl,
        modelTimeoutMs: input.modelTimeoutMs,
        semanticIntent,
        semanticIntentV2
      });
      const result = createReferenceGuidedComponent(
        sourceDraft ? { brief: parsed.brief, references: components, sourceDraft, intentV2: semanticIntentV2 } : { brief: parsed.brief, references: components, intentV2: semanticIntentV2 }
      );
      writeJson$1(res, result.validation.valid ? 200 : 422, result.validation.valid ? result : { ...result, error: "生成未通过门禁" });
    } catch (error) {
      if (error instanceof Error && error.message.includes("too large")) {
        writeJson$1(res, 413, { error: error.message });
        return;
      }
      writeJson$1(res, 500, {
        error: error instanceof Error ? error.message : "Failed to generate reference-guided component."
      });
    }
  };
}
const execFile = promisify(execFile$1);
function safeExtension(fileName) {
  const extension = extname(fileName).toLowerCase();
  if (/^\.[a-z0-9]+$/.test(extension)) return extension;
  return ".mp4";
}
function parsePositiveNumber(value, fallback) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function parseFrameRate(value) {
  if (typeof value !== "string" || value === "0/0") return 30;
  const [numeratorRaw, denominatorRaw] = value.split("/");
  const numerator = Number.parseFloat(numeratorRaw ?? "");
  const denominator = Number.parseFloat(denominatorRaw ?? "");
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 30;
  return Math.round(numerator / denominator * 100) / 100;
}
function emptyMotionHints() {
  return {
    direction: "none",
    confidence: 0,
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0
  };
}
function dominantDirection(dx, dy) {
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return "none";
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "down" : "up";
}
function estimateMotionHints(input) {
  const first = input.frames[0];
  const last = input.frames.at(-1);
  if (!first || !last) return emptyMotionHints();
  const dx = last.centerX - first.centerX;
  const dy = last.centerY - first.centerY;
  const width = parsePositiveNumber(input.width, 1);
  const height = parsePositiveNumber(input.height, 1);
  return {
    direction: dominantDirection(dx, dy),
    confidence: Math.round(Math.max(Math.abs(dx) / width, Math.abs(dy) / height) * 100) / 100,
    startX: -Math.round(dx / 2),
    startY: -Math.round(dy / 2),
    endX: Math.round(dx / 2),
    endY: Math.round(dy / 2)
  };
}
function measureRgbFrameCenter(input) {
  const expectedLength = input.width * input.height * 3;
  if (input.rgb.length < expectedLength) return void 0;
  let total = 0;
  let weightedX = 0;
  let weightedY = 0;
  for (let pixelIndex = 0; pixelIndex < input.width * input.height; pixelIndex += 1) {
    const offset = pixelIndex * 3;
    const luminance = (input.rgb[offset] ?? 0) * 0.299 + (input.rgb[offset + 1] ?? 0) * 0.587 + (input.rgb[offset + 2] ?? 0) * 0.114;
    if (luminance <= 0) continue;
    const x = pixelIndex % input.width;
    const y = Math.floor(pixelIndex / input.width);
    total += luminance;
    weightedX += (x + 0.5) * luminance;
    weightedY += (y + 0.5) * luminance;
  }
  if (total <= 0) return void 0;
  return {
    id: input.id,
    timestampMs: input.timestampMs,
    centerX: weightedX / total,
    centerY: weightedY / total
  };
}
function parseFfprobeMetadata(raw) {
  const payload = JSON.parse(raw);
  const videoStream = payload.streams?.find((stream) => stream.codec_type === "video");
  const fps = parseFrameRate(videoStream?.avg_frame_rate || videoStream?.r_frame_rate);
  return {
    width: Math.round(parsePositiveNumber(videoStream?.width, 390)),
    height: Math.round(parsePositiveNumber(videoStream?.height, 844)),
    durationMs: Math.round(parsePositiveNumber(payload.format?.duration, 1.2) * 1e3),
    fps
  };
}
function hasFormatDuration(raw) {
  const payload = JSON.parse(raw);
  const duration = Number.parseFloat(String(payload.format?.duration ?? ""));
  return Number.isFinite(duration) && duration > 0;
}
function parsePacketTiming(raw) {
  const payload = JSON.parse(raw);
  let endTime = 0;
  let lastFrameTimestamp = 0;
  for (const packet of payload.packets ?? []) {
    const startSeconds = parsePositiveNumber(packet.pts_time, 0);
    const durationSeconds = parsePositiveNumber(packet.duration_time, 0);
    endTime = Math.max(endTime, startSeconds + durationSeconds);
    lastFrameTimestamp = Math.max(lastFrameTimestamp, startSeconds);
  }
  return endTime > 0 ? {
    durationMs: Math.round(endTime * 1e3),
    lastFrameTimestampMs: Math.round(lastFrameTimestamp * 1e3)
  } : void 0;
}
function parseDataUrl(dataUrl) {
  const match = dataUrl.match(/^data:([^;,]+);base64,([\s\S]+)$/);
  if (!match) {
    if (dataUrl.startsWith("data:")) throw new Error("Only base64 data URLs are supported");
    throw new Error("Invalid data URL");
  }
  return {
    mimeType: match[1] ?? "application/octet-stream",
    buffer: Buffer.from(match[2] ?? "", "base64")
  };
}
async function runExecFile(command, args) {
  const result = await execFile(command, args, { maxBuffer: 16 * 1024 * 1024 });
  return result.stdout;
}
async function analyzeVideoUpload(input) {
  const parsed = parseDataUrl(input.dataUrl);
  const run = input.execFile ?? runExecFile;
  const readFile$1 = input.readFile ?? readFile;
  const dir = await mkdtemp(join(tmpdir(), "ai-motion-video-"));
  const inputPath = join(dir, `input${safeExtension(input.fileName)}`);
  const frameSpecs = [
    { id: "start", ratio: 0 },
    { id: "middle", ratio: 0.5 },
    { id: "end", ratio: 1 }
  ];
  const contactSheetPath = join(dir, "contact-sheet.png");
  try {
    await writeFile(inputPath, parsed.buffer);
    const metadataRaw = await run("ffprobe", [
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_streams",
      "-show_format",
      inputPath
    ]);
    const metadata = parseFfprobeMetadata(metadataRaw);
    let lastFrameTimestampMs;
    if (!hasFormatDuration(metadataRaw)) {
      const packetRaw = await run("ffprobe", [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_packets",
        "-show_entries",
        "packet=pts_time,duration_time",
        "-print_format",
        "json",
        inputPath
      ]);
      const packetTiming = parsePacketTiming(packetRaw);
      metadata.durationMs = packetTiming?.durationMs ?? metadata.durationMs;
      lastFrameTimestampMs = packetTiming?.lastFrameTimestampMs;
    }
    const lastTimestampMs = Math.max(
      0,
      lastFrameTimestampMs ?? metadata.durationMs - Math.round(1e3 / Math.max(metadata.fps, 1))
    );
    const frames = [];
    const motionFrameCenters = [];
    for (const spec of frameSpecs) {
      const timestampMs = Math.round(lastTimestampMs * spec.ratio);
      const outputPath = join(dir, `${spec.id}.png`);
      const motionPath = join(dir, `${spec.id}-motion.rgb`);
      await run("ffmpeg", [
        "-y",
        "-ss",
        String(timestampMs / 1e3),
        "-i",
        inputPath,
        "-frames:v",
        "1",
        "-vf",
        "scale=iw:ih",
        outputPath
      ]);
      await run("ffmpeg", [
        "-y",
        "-ss",
        String(timestampMs / 1e3),
        "-i",
        inputPath,
        "-frames:v",
        "1",
        "-vf",
        "scale=32:32",
        "-pix_fmt",
        "rgb24",
        "-f",
        "rawvideo",
        motionPath
      ]);
      frames.push({
        id: spec.id,
        timestampMs,
        dataUrl: `data:image/png;base64,${(await readFile$1(outputPath)).toString("base64")}`
      });
      const center = measureRgbFrameCenter({
        id: spec.id,
        timestampMs,
        width: 32,
        height: 32,
        rgb: await readFile$1(motionPath)
      });
      if (center) motionFrameCenters.push(center);
    }
    await run("ffmpeg", [
      "-y",
      "-i",
      inputPath,
      "-vf",
      "fps=3,scale=160:-1,tile=3x1",
      "-frames:v",
      "1",
      contactSheetPath
    ]);
    return {
      ...metadata,
      posterDataUrl: frames[0]?.dataUrl ?? "",
      frames,
      contactSheetDataUrl: `data:image/png;base64,${(await readFile$1(contactSheetPath)).toString("base64")}`,
      motionHints: estimateMotionHints({
        width: 32,
        height: 32,
        frames: motionFrameCenters
      })
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
const DEFAULT_MAX_BODY_BYTES = 25 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 3e4;
function readBody(req, maxBodyBytes) {
  return new Promise((resolve2, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > maxBodyBytes) {
        reject(new Error("Request body is too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve2(body));
    req.on("error", reject);
  });
}
function writeJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}
function withTimeout(promise, timeoutMs) {
  return new Promise((resolve2, reject) => {
    const timer = setTimeout(() => reject(new Error("Video analysis timed out")), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve2(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}
function createVideoAnalyzeHandler(input = {}) {
  const analyze = input.analyze ?? analyzeVideoUpload;
  const maxBodyBytes = input.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return async function videoAnalyzeHandler(req, res) {
    if (req.method !== "POST") {
      writeJson(res, 405, { error: "Method not allowed" });
      return;
    }
    try {
      const raw = await readBody(req, maxBodyBytes);
      const parsed = JSON.parse(raw || "{}");
      if (typeof parsed.fileName !== "string" || typeof parsed.dataUrl !== "string") {
        writeJson(res, 400, { error: "fileName and dataUrl are required" });
        return;
      }
      const result = await withTimeout(
        analyze({ fileName: parsed.fileName, dataUrl: parsed.dataUrl }),
        timeoutMs
      );
      writeJson(res, 200, result);
    } catch (error) {
      if (error instanceof Error && error.message.includes("too large")) {
        writeJson(res, 413, { error: error.message });
        return;
      }
      if (error instanceof Error && error.message.includes("timed out")) {
        writeJson(res, 504, { error: error.message });
        return;
      }
      writeJson(res, 500, {
        error: error instanceof Error ? error.message : "Failed to analyze video."
      });
    }
  };
}
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};
function requestPath(req) {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  return decodeURIComponent(url.pathname);
}
function sendFile(res, filePath) {
  res.statusCode = 200;
  res.setHeader("Content-Type", MIME_TYPES[extname(filePath)] ?? "application/octet-stream");
  createReadStream(filePath).pipe(res);
}
function distFile(distDir2, pathName) {
  const normalizedPath = normalize(pathName).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = resolve(distDir2, `.${sep}${normalizedPath}`);
  const root = resolve(distDir2);
  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) return void 0;
  try {
    return statSync(filePath).isFile() ? filePath : void 0;
  } catch {
    return void 0;
  }
}
function createProductionServer(input) {
  const distDir2 = resolve(input.distDir);
  const indexPath = join(distDir2, "index.html");
  const videoAnalyzeHandler = createVideoAnalyzeHandler(input.analyze ? { analyze: input.analyze } : {});
  const controlledGenerationHandler = createControlledGenerationHandler();
  const referenceGuidedGenerationHandler = createReferenceGuidedGenerationHandler(input.generation);
  return createServer((req, res) => {
    const pathName = requestPath(req);
    if (pathName === "/api/video/analyze") {
      void videoAnalyzeHandler(req, res);
      return;
    }
    if (pathName === "/api/generation/controlled") {
      void controlledGenerationHandler(req, res);
      return;
    }
    if (pathName === "/api/generation/reference-guided") {
      void referenceGuidedGenerationHandler(req, res);
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.statusCode = 405;
      res.end("Method not allowed");
      return;
    }
    const staticFile = distFile(distDir2, pathName);
    sendFile(res, staticFile ?? indexPath);
  });
}
const host = process.env.HOST || "0.0.0.0";
const port = Number.parseInt(process.env.PORT || "4173", 10);
const distDir = resolve(process.cwd(), "dist");
if (!Number.isFinite(port) || port <= 0) {
  throw new Error("PORT must be a positive number");
}
createProductionServer({
  distDir,
  generation: {
    apiKey: process.env.OPENAI_API_KEY,
    apiBaseUrl: process.env.OPENAI_BASE_URL,
    model: process.env.OPENAI_GENERATION_MODEL
  }
}).listen(port, host, () => {
  console.log(`ai-motion web server listening on http://${host}:${port}`);
});
