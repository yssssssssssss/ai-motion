import type { IncomingMessage, ServerResponse } from "node:http";
import type {
  MotionComponent,
  ReferenceGuidedGenerationResult,
  ReferenceGuidedSourceDraft,
  SemanticGenerationIntent,
  SemanticIntentV2
} from "@motion-tool/core";

const DEFAULT_MAX_BODY_BYTES = 50 * 1024 * 1024;
const DEFAULT_API_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL_TIMEOUT_MS = 12_000;

export type ReferenceGuidedGenerationResponse = ReferenceGuidedGenerationResult;

export type CreateReferenceGuidedGenerationHandlerInput = {
  maxBodyBytes?: number;
  apiKey?: string | undefined;
  apiBaseUrl?: string | undefined;
  model?: string | undefined;
  fetchImpl?: typeof fetch | undefined;
  modelTimeoutMs?: number | undefined;
};

type GenerateReferenceGuidedSourceDraftInput = {
  brief: string;
  references: MotionComponent[];
  apiKey?: string | undefined;
  apiBaseUrl?: string | undefined;
  model?: string | undefined;
  fetchImpl?: typeof fetch | undefined;
  modelTimeoutMs?: number | undefined;
  semanticIntent?: SemanticGenerationIntent | undefined;
  semanticIntentV2?: SemanticIntentV2 | undefined;
};

type GenerateSemanticIntentV2Input = {
  brief: string;
  apiKey?: string | undefined;
  apiBaseUrl?: string | undefined;
  model?: string | undefined;
  fetchImpl?: typeof fetch | undefined;
  modelTimeoutMs?: number | undefined;
};

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

function readBody(req: IncomingMessage, maxBodyBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > maxBodyBytes) {
        reject(new Error("Request body is too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function writeJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function outputText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const response = payload as { output_text?: unknown; output?: unknown };
  if (typeof response.output_text === "string") return response.output_text;
  if (!Array.isArray(response.output)) return null;

  for (const item of response.output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") return text;
    }
  }

  return null;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function responseEndpointCandidates(apiBaseUrl?: string): string[] {
  const base = trimTrailingSlash(apiBaseUrl?.trim() || DEFAULT_API_BASE_URL);
  const candidates = [base];

  if (!base.endsWith("/v1")) {
    candidates.push(`${base}/v1`);
  }

  return [...new Set(candidates)].map((candidate) => `${candidate}/responses`);
}

function isReferenceGuidedSourceDraft(value: unknown): value is ReferenceGuidedSourceDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<ReferenceGuidedSourceDraft>;
  return typeof draft.html === "string" && typeof draft.css === "string" && typeof draft.js === "string";
}

export function parseOpenAISourceDraftResponse(payload: unknown): ReferenceGuidedSourceDraft | undefined {
  const text = outputText(payload);
  if (!text) return undefined;

  try {
    const parsed = JSON.parse(text) as unknown;
    return isReferenceGuidedSourceDraft(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export async function generateSemanticIntentV2(
  input: GenerateSemanticIntentV2Input
): Promise<SemanticIntentV2 | undefined> {
  const brief = input.brief.trim();
  if (!brief || !input.apiKey) return undefined;

  const { parseSemanticIntentV2Payload } = await import("@motion-tool/core");
  const requestBody = JSON.stringify({
    model: input.model ?? "gpt-5.5",
    input: [
      {
        role: "system",
        content:
          "Parse the user's natural-language motion component request into SemanticIntentV2 JSON. Infer intent from ordinary language, not exact keywords. Output a structured motion recipe request: motionCategory, targetRoles, composition, migrationIntent, and referenceRecipeHints must be filled. Preserve negative constraints. Do not invent a button when the user asks for a page, layer, transition, modal, image, card, or unknown target. Treat motion-controlled layers as replaceable targets and expose motion parameters through recipe intent. Use source='model'. Return JSON only."
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
      const payload = (await response.json()) as unknown;
      const text = outputText(payload);
      if (!text) continue;
      const parsed = JSON.parse(text) as unknown;
      const intent = parseSemanticIntentV2Payload(parsed, brief);
      if (intent) return { ...intent, source: "model" };
    } catch {
      // Semantic parsing falls back to deterministic local parsing.
    } finally {
      clearTimeout(timeout);
    }
  }

  return undefined;
}

function isMotionComponent(value: unknown): value is MotionComponent {
  if (!value || typeof value !== "object") return false;
  const component = value as Partial<MotionComponent>;
  return (
    typeof component.id === "string" &&
    typeof component.name === "string" &&
    typeof component.manifest === "object" &&
    typeof component.source === "object" &&
    Array.isArray(component.source?.files)
  );
}

function referenceSnippet(component: MotionComponent): string {
  return component.source.files
    .slice(0, 3)
    .map((file) => `${file.path}\n${file.content.slice(0, 1600)}`)
    .join("\n\n");
}

export async function generateReferenceGuidedSourceDraft(
  input: GenerateReferenceGuidedSourceDraftInput
): Promise<ReferenceGuidedSourceDraft | undefined> {
  const brief = input.brief.trim();
  if (!brief || !input.apiKey) return undefined;

  const requestBody = JSON.stringify({
    model: input.model ?? "gpt-5.5",
    input: [
      {
        role: "system",
        content:
          "Generate a fresh HTML/CSS/JS motion component from the user's natural-language brief. Use retrieved components only as visual and structural references; do not copy their code wholesale. Return complete source files only. The HTML must contain data-motion-root and source/index.html must load ./style.css and ./script.js. The JS must define window.motionReplay, window.motionPause, and window.motionSeek. Avoid network calls, cookies, eval, new Function, external assets, and inline event handlers."
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
      const payload = (await response.json()) as unknown;
      const draft = parseOpenAISourceDraftResponse(payload);
      if (draft) return draft;
    } catch {
      // Generation has a deterministic fallback, so model failures stay non-fatal.
    } finally {
      clearTimeout(timeout);
    }
  }

  return undefined;
}

export function createReferenceGuidedGenerationHandler(input: CreateReferenceGuidedGenerationHandlerInput = {}) {
  const maxBodyBytes = input.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;

  return async function referenceGuidedGenerationHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== "POST") {
      writeJson(res, 405, { error: "Method not allowed" });
      return;
    }

    try {
      const raw = await readBody(req, maxBodyBytes);
      const parsed = JSON.parse(raw || "{}") as { brief?: unknown; components?: unknown };
      if (typeof parsed.brief !== "string" || !Array.isArray(parsed.components)) {
        writeJson(res, 400, { error: "brief and components are required" });
        return;
      }

      const {
        createReferenceGuidedComponent,
        parseSemanticGenerationIntent,
        parseSemanticIntentV2Fallback,
        semanticIntentV2ToLegacyIntent
      } = await import("@motion-tool/core");
      const components = parsed.components.filter(isMotionComponent);
      const semanticIntentV2 =
        (await generateSemanticIntentV2({
          brief: parsed.brief,
          apiKey: input.apiKey,
          apiBaseUrl: input.apiBaseUrl,
          model: input.model,
          fetchImpl: input.fetchImpl,
          modelTimeoutMs: input.modelTimeoutMs
        })) ?? parseSemanticIntentV2Fallback(parsed.brief);
      const semanticIntent =
        semanticIntentV2.source === "model"
          ? semanticIntentV2ToLegacyIntent(semanticIntentV2)
          : parseSemanticGenerationIntent(parsed.brief);
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
        sourceDraft
          ? { brief: parsed.brief, references: components, sourceDraft, intentV2: semanticIntentV2 }
          : { brief: parsed.brief, references: components, intentV2: semanticIntentV2 }
      );

      writeJson(res, result.validation.valid ? 200 : 422, result.validation.valid ? result : { ...result, error: "生成未通过门禁" });
    } catch (error) {
      if (error instanceof Error && error.message.includes("too large")) {
        writeJson(res, 413, { error: error.message });
        return;
      }
      writeJson(res, 500, {
        error: error instanceof Error ? error.message : "Failed to generate reference-guided component."
      });
    }
  };
}
