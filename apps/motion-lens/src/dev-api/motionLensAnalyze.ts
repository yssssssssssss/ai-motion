// Loaded only by the MotionLens Vite dev/preview server.
// The browser app never receives OPENAI_API_KEY.
import {
  createBlueprintFromVision,
  type DesignElement,
  type DesignSource,
  type MotionBlueprint,
  type VisionAnalyzerRequest
} from "@motion-lens/core";
import { retrieveMotionKnowledge, type KnowledgeSearchHit } from "@motion-knowledge/base";
import { withQualityDiagnostics } from "../quality";

type MotionLensRequest = {
  method?: string | undefined;
  setEncoding(encoding: "utf8"): void;
  on(event: "data", listener: (chunk: string) => void): void;
  on(event: "end", listener: () => void): void;
  on(event: "error", listener: (error: Error) => void): void;
  destroy(): void;
};

type MotionLensResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body: string): void;
};

type AnalyzeMotionLensInput = {
  source?: unknown;
  analysisSource?: unknown;
  imageDataUrl?: unknown;
  analysisImageDataUrl?: unknown;
  seedElements?: unknown;
  goalText?: unknown;
  pageType?: unknown;
};

type AnalyzeMotionLensOptions = {
  apiKey?: string | undefined;
  apiBaseUrl?: string | undefined;
  model?: string | undefined;
  modelTimeoutMs?: number | undefined;
  fetchImpl?: typeof fetch;
  maxBodyBytes?: number;
};

type AnalyzeMotionLensResult = {
  mode: "llm" | "fallback";
  message: string;
  blueprint: MotionBlueprint;
};

type SeedElementHint = {
  id: string;
  kind: string;
  label: string;
  manualAnnotation?: string;
};

const DEFAULT_API_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL_TIMEOUT_MS = 90_000;
const DEFAULT_MAX_BODY_BYTES = 12 * 1024 * 1024;

function readBody(req: MotionLensRequest, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > maxBytes) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function writeJson(res: MotionLensResponse, statusCode: number, value: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(value));
}

function isDesignSource(value: unknown): value is DesignSource {
  if (!value || typeof value !== "object") return false;
  const source = value as Partial<DesignSource>;
  return (
    typeof source.kind === "string" &&
    typeof source.id === "string" &&
    typeof source.name === "string" &&
    typeof source.width === "number" &&
    Number.isFinite(source.width) &&
    source.width > 0 &&
    typeof source.height === "number" &&
    Number.isFinite(source.height) &&
    source.height > 0
  );
}

function isDesignElement(value: unknown): value is DesignElement {
  if (!isRecord(value)) return false;
  const bounds = value.bounds;
  return (
    typeof value.id === "string" &&
    typeof value.kind === "string" &&
    typeof value.label === "string" &&
    isRecord(bounds) &&
    typeof bounds.x === "number" &&
    typeof bounds.y === "number" &&
    typeof bounds.width === "number" &&
    typeof bounds.height === "number"
  );
}

function seedElementsFrom(value: unknown): DesignElement[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isDesignElement).slice(0, 12);
}

function manualAnnotationFromText(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const match = text.match(/人工标注类型[:：]\s*([^；;\n]+)/);
  return match?.[1]?.trim() || undefined;
}

function seedElementHintsFrom(seedElements: DesignElement[]): SeedElementHint[] {
  return seedElements.map((element) => {
    const manualAnnotation = manualAnnotationFromText(element.text);
    return {
      id: element.id,
      kind: element.kind,
      label: element.label,
      ...(manualAnnotation ? { manualAnnotation } : {})
    };
  });
}

function outputContractFor(seedElements: DesignElement[] | undefined): string {
  const base =
    "Return { candidates: [...], opportunities: [...] }. Bounds must use source.width/source.height pixels. Opportunities must cite knowledgeContext through knowledgeRefs. Each opportunity must include reviewEvidence answering: 为什么选这个动效、为什么不是其他动效、是否不推荐动效、与同屏其他机会点的差异、建议触发时机. Each opportunity must include alternativeRecommendations as 0-3 viable alternatives with different patternName, reason, recommendedParams and risks; use [] when no alternative is appropriate.";
  if (!seedElements || seedElements.length === 0) return base;
  return `${base} Manual mode: 只围绕 seedElements 输出机会点，不要额外扩展整图机会点；整张图只作为上下文判断层级、触发时机和风险。`;
}

function scaleBlueprintToSource(blueprint: MotionBlueprint, source: DesignSource): MotionBlueprint {
  if (blueprint.source.width === source.width && blueprint.source.height === source.height) {
    return { ...blueprint, source };
  }

  const scaleX = source.width / blueprint.source.width;
  const scaleY = source.height / blueprint.source.height;
  return {
    ...blueprint,
    source,
    elements: blueprint.elements.map((element) => ({
      ...element,
      bounds: {
        x: Math.round(element.bounds.x * scaleX),
        y: Math.round(element.bounds.y * scaleY),
        width: Math.round(element.bounds.width * scaleX),
        height: Math.round(element.bounds.height * scaleY)
      }
    }))
  };
}

function scaleElementsToSource(
  elements: DesignElement[],
  fromSource: DesignSource,
  toSource: DesignSource
): DesignElement[] {
  if (fromSource.width === toSource.width && fromSource.height === toSource.height) return elements;

  const scaleX = toSource.width / fromSource.width;
  const scaleY = toSource.height / fromSource.height;
  return elements.map((element) => ({
    ...element,
    bounds: {
      x: Math.round(element.bounds.x * scaleX),
      y: Math.round(element.bounds.y * scaleY),
      width: Math.round(element.bounds.width * scaleX),
      height: Math.round(element.bounds.height * scaleY)
    }
  }));
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function responseEndpointCandidates(apiBaseUrl?: string): string[] {
  const base = trimTrailingSlash(apiBaseUrl?.trim() || DEFAULT_API_BASE_URL);
  if (base.endsWith("/responses")) return [base];

  const candidates = [base];

  if (!base.endsWith("/v1")) {
    candidates.push(`${base}/v1`);
  }

  return [...new Set(candidates)].map((candidate) => `${candidate}/responses`);
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

function parseVisionResponse(payload: unknown): unknown | undefined {
  const text = outputText(payload);
  if (!text) return undefined;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function errorMessageFromPayload(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;
  const error = payload.error;
  if (!isRecord(error)) return undefined;
  const message = (error as { message?: unknown }).message;
  const cause = (error as { cause?: unknown }).cause;
  if (typeof cause === "string" && cause.trim()) {
    try {
      const parsed = JSON.parse(cause) as unknown;
      return errorMessageFromPayload(parsed);
    } catch {
      return cause.slice(0, 240);
    }
  }
  if (typeof message === "string" && message.trim()) return message.trim();
  return undefined;
}

async function modelFailureMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as unknown;
    const message = errorMessageFromPayload(payload);
    if (message) return `AI 视觉接口返回 ${response.status}：${message}`;
  } catch {
    // Fall through to status-only message.
  }
  return `AI 视觉接口返回 ${response.status}。`;
}

type KnowledgeContextItem = {
  id: string;
  type: string;
  title: string;
  summary: string;
  source: string;
  pageRange: string;
};

function knowledgeContextFor(input: { pageType: string; goalText: string }): Array<{
  id: string;
  type: string;
  title: string;
  summary: string;
  source: string;
  pageRange: string;
}> {
  const query = [input.pageType, input.goalText, "按钮 卡片 弹窗 内容 导航 反馈 加购 支付 物流 搜索"]
    .filter(Boolean)
    .join(" ");
  const hits = retrieveMotionKnowledge({
    query,
    ...(input.pageType ? { pageType: input.pageType } : {}),
    limit: 10
  });

  return hits.map((hit: KnowledgeSearchHit) => {
    const firstRef = hit.item.sourceRefs[0];
    return {
      id: hit.item.id,
      type: hit.item.type,
      title: hit.item.title,
      summary: hit.item.summary,
      source: firstRef?.sourceTitle ?? "未知来源",
      pageRange: firstRef?.pageRange ?? "未标注"
    };
  });
}

function filterKnowledgeRefs(raw: unknown, knowledgeContext: KnowledgeContextItem[]): unknown {
  if (!isRecord(raw) || !Array.isArray(raw.opportunities)) return raw;
  const contextById = new Map(knowledgeContext.map((item) => [item.id, item]));
  const originalOpportunityCount = raw.opportunities.length;
  let droppedOpportunityCount = 0;
  const existingWarnings = Array.isArray(raw.warnings)
    ? raw.warnings.filter((warning) => typeof warning === "string")
    : [];
  const opportunities = raw.opportunities
    .map((opportunity) => {
      if (!isRecord(opportunity) || !Array.isArray(opportunity.knowledgeRefs)) {
        droppedOpportunityCount += 1;
        return undefined;
      }
      const knowledgeRefs = opportunity.knowledgeRefs
        .filter((ref) => isRecord(ref) && typeof ref.id === "string" && contextById.has(ref.id))
        .map((ref) => {
          const context = contextById.get((ref as { id: string }).id);
          return {
            id: context?.id ?? "",
            title: context?.title ?? "",
            source: context?.source ?? "",
            pageRange: context?.pageRange ?? ""
          };
        });
      if (knowledgeRefs.length === 0) {
        droppedOpportunityCount += 1;
        return undefined;
      }
      return {
        ...opportunity,
        knowledgeRefs
      };
    })
    .filter(
      (
        opportunity
      ): opportunity is Record<string, unknown> & {
        knowledgeRefs: Array<{ id: string; title: string; source: string; pageRange: string }>;
      } => Boolean(opportunity)
    );
  const warnings = [...existingWarnings];
  if (droppedOpportunityCount > 0) {
    warnings.push(
      `知识依据不足：${droppedOpportunityCount}/${originalOpportunityCount} 个模型机会点缺少有效知识引用，已丢弃。`
    );
  }
  if (hasHomogeneousRecommendations(opportunities)) {
    warnings.push("推荐同质化：多个不同元素使用了相同动效，请结合页面语境复核。");
  }
  return {
    ...raw,
    warnings,
    opportunities
  };
}

function hasHomogeneousRecommendations(opportunities: Array<Record<string, unknown>>): boolean {
  if (opportunities.length < 3) return false;
  const elementIds = new Set(
    opportunities.map((item) => item.elementId).filter((id) => typeof id === "string")
  );
  if (elementIds.size < 3) return false;
  const patternKeys = new Set(
    opportunities
      .map((item) => {
        const patternId = typeof item.patternId === "string" ? item.patternId : "";
        const patternName = typeof item.patternName === "string" ? item.patternName : "";
        return `${patternId}::${patternName}`.trim();
      })
      .filter(Boolean)
  );
  return patternKeys.size === 1;
}

function systemPrompt(): string {
  return [
    "你是面向设计师评审的动效机会点分析助手。",
    "只返回 JSON。识别静态 UI 设计稿中可添加动效的具体元素：按钮、卡片组、弹窗、表单、内容区、反馈/toast、导航或未知元素。",
    "如果用户输入包含 seedElements，必须优先分析这些人工框选区域，并保留可用的 seed element id。",
    "优先选择与任务目标相关、可交互、可解释的元素。装饰插画、背景图、纯视觉氛围元素必须标记 isDecorative=true。",
    "必须参考用户输入中的 knowledgeContext 判断机会点，避免为了动而动、循环吸睛、多处同时动效或高性能消耗动效。",
    "不要只按元素类型套用同一个推荐。必须结合页面语境、元素层级、触发时机、业务目标和知识依据选择不同 patternName。",
    "同一份输出中，除非两个元素承担完全相同任务，否则不要让所有卡片、内容区或按钮使用同一个 patternName。",
    "按钮优先区分吸引点击、压感反馈、加购联动、收藏反馈、提交确认；卡片优先区分分组入场、焦点强调、热卖状态、内容揭示。",
    "弹窗、支付、删除、确认类场景应更克制，优先稳定、可预测，不使用夸张回弹或循环强调。",
    "opportunities 必须引用 candidates 中真实存在的 elementId，并给出推荐动效、理由、参数、风险、knowledgeRefs 和 reviewEvidence。",
    "reviewEvidence 必须说明：为什么选这个动效、为什么不是其他动效、是否不推荐动效、与同屏其他机会点的差异、建议触发时机。",
    "不要虚构图片外的元素。bounds 必须使用原图坐标系的像素值。",
    "候选保持克制，通常返回 3 到 8 个高价值候选。"
  ].join(" ");
}

function createOpenAIVisionAnalyzer(input: {
  imageDataUrl: string;
  apiKey: string;
  apiBaseUrl?: string | undefined;
  model?: string | undefined;
  modelTimeoutMs?: number | undefined;
  fetchImpl?: typeof fetch;
  seedElements?: DesignElement[];
}) {
  return async function openAIVisionAnalyzer(request: VisionAnalyzerRequest): Promise<unknown> {
    const fetcher = input.fetchImpl ?? fetch;
    const knowledgeContext = knowledgeContextFor({
      pageType: request.pageType,
      goalText: request.goalText
    });
    const requestBody = JSON.stringify({
      model: input.model ?? "gpt-5.5",
      input: [
        {
          role: "system",
          content: systemPrompt()
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                source: request.source,
                pageType: request.pageType,
                goalText: request.goalText,
                seedElements: input.seedElements ?? [],
                seedElementHints: input.seedElements ? seedElementHintsFrom(input.seedElements) : [],
                knowledgeContext,
                outputContract: outputContractFor(input.seedElements)
              })
            },
            {
              type: "input_image",
              image_url: input.imageDataUrl,
              detail: "high"
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "motion_lens_candidates",
          strict: true,
          schema: request.candidateJsonSchema
        }
      }
    });
    const timeoutMs = input.modelTimeoutMs ?? DEFAULT_MODEL_TIMEOUT_MS;
    const deadline = Date.now() + timeoutMs;
    let failureMessage = "AI 视觉接口未返回有效内容。";

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

        if (!response.ok) {
          failureMessage = await modelFailureMessage(response);
          continue;
        }
        const payload = (await response.json()) as unknown;
        const parsed = parseVisionResponse(payload);
        if (parsed) return filterKnowledgeRefs(parsed, knowledgeContext);
        failureMessage = "AI 视觉接口返回无效 JSON。";
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          failureMessage = `AI 视觉接口请求超时（${Math.round(timeoutMs / 1000)}s）。`;
        } else if (error instanceof Error && error.message) {
          failureMessage = `AI 视觉接口请求失败：${error.message}`;
        } else {
          failureMessage = "AI 视觉接口请求失败。";
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new Error(failureMessage);
  };
}

export async function analyzeMotionLensDraft(
  rawInput: AnalyzeMotionLensInput,
  options: AnalyzeMotionLensOptions = {}
): Promise<AnalyzeMotionLensResult> {
  if (!isDesignSource(rawInput.source)) {
    throw new Error("source 无效。");
  }
  const imageDataUrl =
    typeof rawInput.analysisImageDataUrl === "string" ? rawInput.analysisImageDataUrl : rawInput.imageDataUrl;
  const analysisSource = isDesignSource(rawInput.analysisSource) ? rawInput.analysisSource : rawInput.source;

  if (typeof imageDataUrl !== "string" || !imageDataUrl.startsWith("data:image/")) {
    throw new Error("imageDataUrl 无效。");
  }

  const goalText = typeof rawInput.goalText === "string" ? rawInput.goalText : "";
  const pageType = typeof rawInput.pageType === "string" ? rawInput.pageType : "";
  const seedElements = scaleElementsToSource(
    seedElementsFrom(rawInput.seedElements),
    rawInput.source,
    analysisSource
  );
  const analyzer =
    options.apiKey && imageDataUrl
      ? createOpenAIVisionAnalyzer({
          imageDataUrl,
          apiKey: options.apiKey,
          ...(options.apiBaseUrl ? { apiBaseUrl: options.apiBaseUrl } : {}),
          ...(options.model ? { model: options.model } : {}),
          ...(options.modelTimeoutMs ? { modelTimeoutMs: options.modelTimeoutMs } : {}),
          ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
          ...(seedElements.length > 0 ? { seedElements } : {})
        })
      : undefined;
  const blueprint = await createBlueprintFromVision({
    source: analysisSource,
    goalText,
    pageType,
    ...(options.apiKey ? { apiKey: options.apiKey } : {}),
    ...(analyzer ? { analyzer } : {})
  });
  const mode = blueprint.diagnostics.analysisMode === "fallback" ? "fallback" : "llm";
  const outputBlueprint = withQualityDiagnostics(scaleBlueprintToSource(blueprint, rawInput.source));

  return {
    mode,
    blueprint: outputBlueprint,
    message: mode === "llm" ? "AI 视觉分析完成。" : (blueprint.diagnostics.warnings[0] ?? "已使用 fallback。")
  };
}

export function createMotionLensAnalyzeHandler(options: AnalyzeMotionLensOptions = {}) {
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;

  return async function motionLensAnalyzeHandler(
    req: MotionLensRequest,
    res: MotionLensResponse
  ): Promise<void> {
    if (req.method !== "POST") {
      writeJson(res, 405, { error: "Method not allowed" });
      return;
    }

    try {
      const raw = await readBody(req, maxBodyBytes);
      const parsed = JSON.parse(raw || "{}") as AnalyzeMotionLensInput;
      const result = await analyzeMotionLensDraft(parsed, options);
      writeJson(res, 200, result);
    } catch (error) {
      writeJson(res, 400, {
        error: error instanceof Error ? error.message : "AI 分析失败。"
      });
    }
  };
}
